# City Search interaction regression checks

Run the existing Node suite with `npm test`. It covers reducers, keyboard handlers,
query isolation, cancellation and dashboard integration, but does not mount a DOM
or synthesize browser gestures.

For the mounted React checks, run `npm run dev`, open
`http://localhost:5173/tests/city-search.html` and choose **Run regression tests**.
All five checks should report `PASS`. This page uses the real `CitySearch`
controller, React DOM and a seeded React Query cache; it makes no API requests.
Vite's production build does not include this test page.

The checks dispatch DOM events rather than call React handlers directly. They
cover an uncancelled touch pointerdown followed by a compatibility click, mouse
focus retention, cancelled touch gestures, outside blur, keyboard selection,
duplicate Enter/click and stale suggestions after the debounce clears. Because
`dispatchEvent` does not execute browser focus default actions, the mouse test
explicitly models focus transfer when mousedown is not cancelled.

These are deterministic event-contract tests, not native touch end-to-end tests.
They are run separately in a browser and are not part of `npm test` or CI.
They cannot establish the event ordering of an arbitrary iOS release, reproduce
its keyboard or prove how it synthesizes click from a physical tap.

## Diagnosis

Selection depends on `click`, while input blur synchronously closes and unmounts
the suggestions. The previous option handler cancelled every `pointerdown` to
retain input focus. This couples click delivery and focus retention to browser
compatibility-event behavior.

The [Pointer Events specification](https://www.w3.org/TR/pointerevents/)
distinguishes click from compatibility mouse events: cancelling pointerdown
should not suppress click. However, WebKit has documented a regression where
doing exactly that suppresses synthetic clicks on iOS:
[WebKit fix 7ac1727](https://github.com/WebKit/WebKit/commit/7ac1727cb827b51dc695c8d95b82ea74abc10d6b).
This is evidence for the failure mechanism, not confirmation that the reporter's
iPhone runs that affected WebKit version.

The fix leaves pointerdown/touchend untouched and prevents the focus default
action on mousedown instead. Selection still happens only on click (or the
existing keyboard Enter path), never on pointerdown, pointerup or touchend.
Scrolling/cancelled gestures therefore do not intentionally select a city, and
there is no second touch-specific selection path to deduplicate.

## Physical iPhone validation and remaining coverage

PR #9 was squash-merged into main as
`8bd7902805d7c91e52b5617ec360071a730f843a`. The project owner confirmed that
city search and selection work on Safari on a physical iPhone in production
after Vercel deployed the correction. This is user-reported device validation,
not a native iOS test performed by the automated DOM suite. The exact iOS/Safari
version and native event sequence were not recorded.

The following checklist remains useful for future regressions and broader
gesture/device coverage; it is not a list of checks all completed on that iPhone.

## Manual Safari iOS regression checklist

1. Open the PR preview on a physical iPhone in Safari. Record iOS/Safari version.
2. With the keyboard open, search for Lisbon and tap a valid suggestion once.
   Confirm the dashboard changes city, the input empties, its placeholder
   returns and suggestions close. Weather must not show Porto under Lisbon.
3. Repeat with Tokyo and Porto, tapping both the city name and its metadata.
4. Scroll a long list of suggestions and cancel a gesture. Neither should select
   a city. Tap outside the search: suggestions must close normally.
5. Repeat selection quickly, reopen the input, and check that no old suggestions
   reappear after 300 ms. Verify focus is usable for another search.
6. With a hardware keyboard, check ArrowUp/ArrowDown, Enter, held Enter, Escape
   and Tab. Check a desktop mouse click, both themes and a narrow viewport.
7. If failure remains, use Safari's remote Web Inspector to capture pointerdown,
   pointerup, touchend, mousedown, click and focusout on the input/list. Include
   pointerType, defaultPrevented and whether the option remains connected.
   Do not assume all browsers share one fixed event ordering.
