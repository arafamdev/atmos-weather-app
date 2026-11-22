# PR #14 device location audit

Audit date: 2026-11-22. Repository: arafamdev/atmos-weather-app.

## Verdict and publication boundary

No confirmed production defect was found in the reviewed implementation
(f58c6a4897adc590c60a45d1b6cc5bf53b330e4a). Only DOM regression coverage and
technical documentation were changed during this audit. No runtime files,
dependencies or CSS tokens were changed.

The implementation is ready for human review, but native GPS/permission behavior
is not fully validated. The user reported that no physical device is available
for this review. Do not present desktop simulation as iPhone/iPad/Android testing.
PR #14 remains open: merge requires explicit user approval. Squash merge,
post-merge synchronization, branch deletion and the separate screenshot PR have
not been performed.

## Repository and deployment evidence

- Initial branch: feat/automatic-user-location, working tree clean.
- Local feature HEAD and its remote matched; divergence was 0/0 after fetch.
- main and origin/main: 601debfdec5cb8bcd8334d640490fb065f289568,
  the squash merge of PR #13.
- PR #14: open, targeting main, mergeable. CI and Vercel checks succeeded for f58c6a4.
- Verified Preview: https://atmos-weather-qejw264kz-arafamdev.vercel.app,
  deployment dpl_5sF3Wfs9tKBzLM18vDpSNahqdvEv, Ready.
- Production alias: https://atmos-by-arafam.vercel.app, project atmos-weather-app,
  Ready, main commit 601debf. It does not yet contain the GPS feature.
- Vercel inspection used the authenticated CLI in the arafamdev scope. No
  deployment, promotion, protection-bypass creation or settings change was made.

## Reviewed behavior

| Requirement | Evidence and outcome |
| --- | --- |
| First visit | Permission prompt/denied states do not call GPS automatically. Explicit button starts the request. |
| Returning visit | A granted permission starts GPS after mounting. A new-mount regression verifies this without a button press. |
| Missing Permissions API | Skip auto retrieval, retain the explicit button. Unsupported descriptors are caught. |
| Immediate weather | A valid position publishes Current location with timezone auto before awaiting reverse geocoding. |
| Locality enrichment | BigDataCloud supplies only name, country and admin1. Exact GPS coordinates are preserved. |
| Lookup slowness/failure | Coordinate weather loads while lookup is pending and remains usable if lookup fails. |
| No name-only refetch | Stable GPS query identity plus observer select relabels the existing forecast. |
| Manual priority | Revision invalidation and HTTP abort prevent late permission/GPS/lookup results overriding manual selection. |
| GPS errors | Denied, unavailable, timeout and unsupported cases preserve the active city and provide guidance. |
| Duplicate requests | Busy phases prevent duplicate GPS requests. StrictMode startup replay is covered. |
| Disposal | Invalidate requests and abort lookup without publishing late location/status updates. |
| Privacy | No exact coordinate persistence to localStorage, analytics or application logs was found. In-memory state/cache and provider requests still contain coordinates. |

Automatic location depends on a browser-supported Permissions API reporting an
existing grant. When this is unavailable, an explicit action is intentionally
required even if the browser might already remember a permission. GPS accuracy,
OS-level authorization and provider availability are not guaranteed by this audit.

## Responsibilities and architecture

| File | Responsibility |
| --- | --- |
| src/App.jsx | Sole owner of activeLocation. Manual selection cancels pending device work before updating state. |
| hooks/useUserLocation.js | Connect the controller to React state, mount-time grant check and effect cleanup. |
| hooks/userLocationController.js | GPS request lifecycle, revision guards, busy-state deduplication, immediate coordinate publication and late label enrichment. |
| services/reverseGeocodingService.js | Client-only provider request, coordinate validation, five-second timeout, AbortSignal and locality-only output; reject IP-derived results. |
| hooks/useCityWeather.js | Location cache isolation, signal forwarding, five-minute freshness and GPS label selection without restarting forecast requests. |
| services/weatherService.js | Existing native fetch pipeline; send the original coordinates and timezone auto for GPS. |
| adapters/weatherAdapter.js | Validate the returned IANA timezone and reuse the existing Unix/DST/hourly/solar mapping. |
| utils/weatherLocation.js | Validate coordinates and labels; permit auto only for geolocation-marked locations. |
| components/UserLocationControl.jsx | Accessible button, busy/disabled feedback, status/alert messages, unique description IDs and privacy disclosure. |
| hooks/userLocationController.test.js | Deterministic permission/GPS, race, cancellation, duplicate and unmount coverage. |
| services/reverseGeocodingService.test.js | Mocked HTTP/JSON/network/timeout, metadata and abort cases. |
| hooks/useCityWeather.test.js | Coordinate/timezone parameters, cache keys and pending/completed forecast relabeling. |
| tests/user-location.browser.jsx | Eleven mounted App scenarios with simulated browser APIs and provider responses. |
| tests/city-search.browser.jsx | Twelve existing mounted search regressions, including focus, keyboard, pointer cancellation and consecutive selections. |

Paths abbreviated after src/features/weather/ in the table remain inside that
feature. The App remains the source of location truth; the controller's status is
not a second selected-location store.

UserLocationControl reuses semantic Tailwind tokens for background, surface,
border, text and muted text. min-h-11 gives the button a 44px minimum height;
focus-visible provides the existing accent outline. The loading icon is not
animated, and decorative icons are hidden from assistive technology. Status text
uses role=status or role=alert. Existing Header breakpoints and weather layouts
were retained; no CSS modifications were needed.

## Executed validation

- npm test: 212 passed, 0 failed, 0 skipped, using the Node test runner.
- npm run lint: passed.
- npm run build: passed.
- git diff --check: passed.
- Chromium in-app browser: 11 location and 12 CitySearch DOM cases passed.
- Native Safari 27.2 / WebKit desktop: the same 11 + 12 cases passed, with results
  read in the Safari page. These are synthetic events inside a real browser.
- Chromium console: no warnings or errors observed in either suite.
- Normal Chromium keyboard interaction: ArrowDown/Enter selected Lisbon and
  cleared the input; Tab reached Use my location with a visible 2px outline;
  Enter activated its simulated GPS request and busy/disabled state.
- Safari Responsive Design Mode: header/button and visible current/daily card
  layout inspected at 390x844, 768x1024 and 1440x900, in both themes. No overlap or
  horizontal page overflow was visually apparent in the inspected regions.
- The mocked preview uses fixed-date fixtures: the hourly area can show its
  out-of-range empty state. This was not an all-section live forecast visual audit.
- The Safari developer-menu option was enabled only temporarily and restored to
  its initial off state. Only the temporary test window was closed.

No native iOS/iPadOS/Android positioning, permission dialogs or actual return-visit
permission persistence were tested. Firefox, Edge and native Chrome were not
executed; Playwright/browser packages were not installed. Native Chrome had an
existing authentication dialog, which was left untouched. No real personal
coordinates were obtained or transmitted. BigDataCloud was mocked to respect its
client-only current-coordinate terms.

## Git commands and their purpose

- git status --short --branch: inspect local changes and branch before work.
- git branch -vv / git log -3 --oneline: inspect upstreams and recent history.
- git fetch origin: refresh remote refs without modifying source files.
- git rev-list --left-right --count HEAD...origin/feat/automatic-user-location:
  confirm zero divergence before editing.
- git diff --stat origin/main...HEAD: inspect the feature scope against its base.
- gh pr view 14: verify target, SHA, checks and mergeability without merging.
- Stage only the audit's DOM test and documentation files, check the staged diff,
  commit in English and push to the same feature branch; this updates PR #14.

No pull into the feature branch, reset, rebase, force push, merge or branch
removal was needed. main was already synchronized. Existing cleanup/search
branches were preserved. After an approved squash merge, fetch and fast-forward
main, verify production and compare complete trees before branch cleanup.

## Remaining gates

1. Perform the physical-device permission/GPS checklist in USER_LOCATION.md when
   a device is available. Record browser/OS and outcomes without publishing exact
   coordinates. Include granting once and reloading, denial and manual priority.
2. Review the final PR checks and obtain explicit approval before squash merging.
3. Verify the resulting production commit, synchronize main and compare full
   trees before deleting only the integrated branch.
4. Create docs/add-responsive-previews only afterward. Capture six real production
   views (1440x900, 768x1024, 390x844; both themes), without GPS prompts, sensitive
   location or developer tools; update README in a separate unmerged PR.

The screenshots of test fixtures used for this audit are not portfolio assets and
were not added to docs/screenshots or presented as real production weather.
