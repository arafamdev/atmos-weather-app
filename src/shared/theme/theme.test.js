import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { applyTheme, getInitialTheme, THEME_STORAGE_KEY } from "./theme.js";

const html = await readFile(new URL("../../../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../index.css", import.meta.url), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let server;
let Header;

before(async () => {
  server = await createServer({
    configFile: false,
    appType: "custom",
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ default: Header } = await server.ssrLoadModule("/src/shared/components/layout/Header.jsx"));
});
after(async () => { await server?.close(); });

function withBrowser(document, localStorage, run) {
  const descriptors = ["document", "localStorage"].map((name) =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)],
  );
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  try {
    return run();
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("bootstrap applies only valid saved themes before the application loads", () => {
  assert.ok(html.indexOf("<script>") < html.indexOf('src="/src/main.jsx"'));
  for (const saved of [null, "dark", "light", "system", "LIGHT", ""]) {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(bootstrap, {
      document,
      localStorage: { getItem(key) { assert.equal(key, THEME_STORAGE_KEY); return saved; } },
    });
    assert.equal(document.documentElement.dataset.theme, saved === "light" ? "light" : "dark");
  }
});

test("bootstrap defaults to dark when accessing storage is blocked", () => {
  const document = { documentElement: { dataset: {} } };
  runInNewContext(bootstrap, {
    document,
    get localStorage() { throw new Error("Storage blocked"); },
  });
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("bootstrap defaults to dark when reading the stored value fails", () => {
  const document = { documentElement: { dataset: {} } };
  runInNewContext(bootstrap, {
    document,
    localStorage: { getItem() { throw new Error("Read denied"); } },
  });
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("React initialization uses the bootstrap theme and defaults to dark without a document", () => {
  assert.equal(withBrowser(undefined, undefined, getInitialTheme), "dark");
  for (const theme of ["dark", "light", undefined, "invalid"]) {
    const document = { documentElement: { dataset: { theme } } };
    assert.equal(withBrowser(document, undefined, getInitialTheme), theme === "light" ? "light" : "dark");
  }
});

test("theme changes update the root and persist both preferences", () => {
  const document = { documentElement: { dataset: {} } };
  const writes = [];
  withBrowser(document, { setItem: (...args) => writes.push(args) }, () => {
    applyTheme("light");
    assert.equal(getInitialTheme(), "light");
    applyTheme("dark");
    assert.equal(getInitialTheme(), "dark");
  });
  assert.deepEqual(writes, [[THEME_STORAGE_KEY, "light"], [THEME_STORAGE_KEY, "dark"]]);
});

test("storage write failures do not prevent a theme change", () => {
  const document = { documentElement: { dataset: {} } };
  withBrowser(document, { setItem() { throw new Error("Quota exceeded"); } }, () => {
    assert.doesNotThrow(() => applyTheme("light"));
    assert.equal(getInitialTheme(), "light");
  });
});

test("blocked access to the storage property still updates the root theme", () => {
  const document = { documentElement: { dataset: { theme: "dark" } } };
  withBrowser(document, undefined, () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("Storage access denied"); },
    });
    assert.doesNotThrow(() => applyTheme("light"));
    assert.equal(getInitialTheme(), "light");
    assert.doesNotThrow(() => applyTheme("dark"));
    assert.equal(getInitialTheme(), "dark");
  });
});

test("Dark keeps the original palette and current weather card colors", () => {
  const dark = css.match(/:root\s*\{([^}]+)\}/)[1];
  const expected = {
    background: "#101014", surface: "#202024", "surface-hover": "#2b2b30",
    accent: "#b5d7ee", text: "#f5f5f7", "text-muted": "#a1a1aa", border: "#34343a",
    "weather-card": "#b5d7ee", "weather-card-text": "#101014",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(dark.includes(`--color-${name}: ${value};`), name);
    assert.ok(css.includes(`--color-app-${name === "text-muted" ? "muted" : name}: var(--color-${name});`));
  }
  assert.match(dark, /color-scheme: dark/);
  assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme: light/);
});

test("Header exposes a stable toggle name, state, focus styling and decorative icon", () => {
  for (const theme of ["dark", "light"]) {
    const markup = withBrowser({ documentElement: { dataset: { theme } } }, undefined, () =>
      renderToStaticMarkup(createElement(Header, { locationLabel: "Porto, Portugal" })),
    );
    assert.match(markup, /<button type="button" aria-label="Soft light mode"/);
    assert.ok(markup.includes(`aria-pressed="${theme === "light"}"`));
    assert.match(markup, /focus-visible:outline-app-accent/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /Porto, Portugal/);
  }
});

function rgb(hex) {
  return hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255);
}
function luminance(color) {
  return color.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("both token palettes maintain readable text, chart bars and focus contrast", () => {
  const palettes = [...css.matchAll(/:root(?:\[data-theme="light"\])?\s*\{([^}]+)\}/g)];
  assert.equal(palettes.length, 2);
  for (const [, body] of palettes) {
    const colors = Object.fromEntries([...body.matchAll(/--color-([\w-]+): (#[a-f\d]{6});/g)]
      .map(([, name, hex]) => [name, rgb(hex)]));
    for (const background of ["background", "surface", "surface-hover"]) {
      for (const text of ["text", "text-muted", "accent"]) {
        assert.ok(contrast(colors[text], colors[background]) >= 4.5, `${text} on ${background}`);
      }
    }
    const cardMuted = colors["weather-card-text"].map((value, index) =>
      value * 0.7 + colors["weather-card"][index] * 0.3,
    );
    assert.ok(contrast(cardMuted, colors["weather-card"]) >= 4.5);
    assert.ok(contrast(colors.accent, colors.background) >= 3);
  }
});
