import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let Footer;
before(async () => {
  server = await createServer({
    configFile: false, appType: "custom", esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ default: Footer } = await server.ssrLoadModule("/src/shared/components/layout/Footer.jsx"));
});
after(async () => { await server?.close(); });

function renderFooter() {
  return renderToStaticMarkup(createElement(Footer));
}

test("Footer credits the full developer name and current year within semantic landmarks", () => {
  const html = renderFooter();
  assert.match(html, /<footer /);
  assert.match(html, /Developed by Arafam Mussa Silla\./);
  assert.ok(html.includes(`© ${new Date().getFullYear()} Atmos.`));
  assert.match(html, /<nav aria-label="Social links">/);
  assert.match(html, /Weather, beautifully simplified\./);
});

test("social links have accurate destinations, accessible names and safe new-tab attributes", () => {
  const html = renderFooter();
  const links = [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 2);
  for (const [index, href, label, icon] of [
    [0, "https://github.com/arafamdev", "GitHub profile", "github-icon"],
    [1, "https://www.linkedin.com/in/arafam-mussa-silla-5a7866446/", "LinkedIn profile", "linkedin-icon"],
  ]) {
    const [, attributes, content] = links[index];
    assert.ok(attributes.includes(`href="${href}"`));
    assert.ok(attributes.includes(`aria-label="${label} (opens in a new tab)"`));
    assert.match(attributes, /target="_blank"/);
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.match(attributes, /focus-visible:outline-app-accent/);
    assert.match(content, /aria-hidden="true" focusable="false"/);
    assert.ok(content.includes(`icons.svg#${icon}`));
  }
  assert.match(links[1][2], /LinkedIn$/);
  assert.doesNotMatch(html, /temporary/i);
});

test("both existing SVG catalog symbols inherit theme colors rather than hard-coded fills", async () => {
  const svg = await readFile(new URL("../../../../public/icons.svg", import.meta.url), "utf8");
  for (const id of ["github-icon", "linkedin-icon"]) {
    const symbol = svg.match(new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`))[1];
    assert.match(symbol, /currentColor/);
    assert.doesNotMatch(symbol, /#[0-9a-fA-F]{3,8}/);
  }
});
