# City Search interaction regression checks

Run `npm test` for the Node suite: keyboard handlers, query isolation,
cancellation, forecast parameters and dashboard integration. It does not mount a DOM.

Run `npm run dev`, open `http://localhost:5173/tests/city-search.html` and choose
**Run regression tests** for the separate mounted DOM suite. All twelve checks
should report `PASS`. The harness mounts the real `AppContent`, CitySearch and
weather query. Geocoding is seeded in the query cache and forecast requests use
fixtures; no live API calls are made. It checks the selected city's latitude,
longitude, timezone, heading and absence of previous-city data.
The production build excludes this test page. These checks are not part of CI.

## Confirmed fragility and correction

Input blur previously closed and unmounted the list synchronously. When blur
occurred before the option click, the click target disappeared and no city was
selected. The DOM regression explicitly blurs the input after touch pointerdown,
before compatibility mouse events, and verifies one selection and restored focus.
This reproduces the code-level fragility, not the native event sequence on the
affected iPhone/iPad, which remains unconfirmed.

Dismissal now follows interaction outside the whole search component: document
pointerdown, click (including assistive activation) and focusin. Listeners are
removed on unmount. Escape and Tab still close the popup. Blur alone does not
remove an option while its click is pending. Selection restores input focus before
clearing search state, preventing focus from reopening stale suggestions.

Selection remains click/Enter only, with a synchronous guard against duplicate
callbacks. No pointerdown, touchstart or mousedown is cancelled. Native scroll
and cancelled gestures have no separate selection path. Touch/pen pointermove
does not activate options; only keyboard navigation triggers scrollIntoView.

The original eight DOM cases cover early touch blur, early mouse blur, normal compatibility
click, outside focus/pointer, Tab, touch scroll/cancellation, keyboard navigation,
Escape, repeated Enter/click, clearing and debounce completion. A scroll spy checks
that touch does not scroll programmatically and keyboard navigation does.

The lifecycle checks additionally cover consecutive Lisbon → Tokyo → Porto
selections in one mounted AppContent, refocus of an uncommitted query, empty
reopening after selection, a change-only autofill event, and a reentrant click
before React commits. Every case runs in StrictMode. Listener instrumentation
checks setup/cleanup replay and matching callback/capture removal on unmount.
Internal option child targets and input focus must not dismiss the popup.

Autofill coverage models a browser-delivered input/change event. It does not
verify native browser autofill UI or silent DOM value changes without events;
React cannot update the controlled search state from an unreported mutation.

## Historical Safari fix

PR #9 (`8bd7902805d7c91e52b5617ec360071a730f843a`) replaced pointerdown
cancellation with mousedown cancellation. The owner reported successful Safari
selection on a physical iPhone after deployment. Versions and event traces were
not recorded. That earlier result does not identify the newer Chrome iOS issue.
The current correction removes the dependency on cancelling focus defaults.

## Limits and manual browser checklist

Synthetic dispatchEvent does not synthesize native touch clicks, scrolling,
keyboard focus defaults or mobile keyboards. Tests model focus transfer explicitly.
Chromium desktop or WebKit desktop cannot prove iOS compatibility.

Run this checklist in iPhone Chrome and Safari, iPadOS, Android Chrome, desktop
Firefox and Edge; record device, OS/browser version and tested commit:

1. With keyboard open, search Lisbon; tap its name, then repeat using metadata.
   Heading and weather must change, input clear, placeholder return and popup
   close. Confirm one selection, without duplicate forecast submissions.
2. Repeat with keyboard dismissed, Tokyo, Porto and rapid city changes. No weather
   from the previous city may appear under the new heading.
3. Scroll a long suggestion list, stop/cancel a gesture and scroll the page. No
   city should be selected. A subsequent deliberate tap must work.
4. Click/tap outside, including non-focusable content. Move focus outside. The
   popup must close without changing city. Reopen and search again.
5. Use ArrowUp/Down, Enter, held Enter, Escape and Tab/Shift+Tab. Check input focus,
   screen-reader combobox announcements and unmatched/empty Enter behavior.
6. Repeat using a mouse and both themes at narrow and wide widths. Check visible
   focus, popup scrolling, console errors and stale suggestions after 300 ms.
7. If a device fails, collect pointer/touch, blur/focusout and click order with
   remote Web Inspector, along with option connectivity and loaded script URL.
   Input unchanged plus old heading indicates selection failure; cleared input
   plus new heading indicates downstream forecast loading/error instead.

## Device location integration

Open `/tests/user-location.html` for nine additional scenarios with App mounted,
mocked permission/GPS APIs and mocked provider responses. This tests manual city
priority and returning to GPS without requesting or transmitting physical location.
The slow-lookup case verifies weather is already visible before the locality
resolves and that updating its name sends no additional weather request.
See [device location architecture and manual checklist](../docs/USER_LOCATION.md).
