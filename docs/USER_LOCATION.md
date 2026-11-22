# Consent-based device location

## Ownership and flow

App still owns `activeLocation`. `useUserLocation(setActiveLocation)` owns only
permission/GPS request lifecycle and feedback. Manual `selectCity` first calls
`cancel`, then changes the active location. AppContent composes CitySearch and
UserLocationControl inside the existing Header. CitySearch is unchanged.

- `createUserLocationController` implements the asynchronous lifecycle separately
  from React, allowing deterministic cancellation/race tests without a DOM.
- `startIfGranted` queries the geolocation permission. Prompt, denied, unavailable
  API or unsupported descriptor never trigger an automatic permission prompt.
- `start` invokes getCurrentPosition once. Duplicate requests are ignored while
  locating/resolving. It uses maximumAge=0, a 10-second GPS timeout and does not
  request high accuracy; this is weather, not address-level positioning.
- Each request has a revision. Manual selection, cancellation and disposal advance
  the revision. GPS cannot be physically aborted with getCurrentPosition, so its
  obsolete callbacks are ignored. An AbortController cancels the HTTP lookup.
- `dispose` invalidates callbacks and aborts HTTP without updating React state.
  StrictMode's permission-query cleanup prevents duplicate startup GPS requests.
- `reverseGeocodePosition` calls BigDataCloud directly from the device, with a
  five-second timeout, AbortSignal, no credentials and no referrer. It returns only
  name/country/admin1; GPS coordinates can never be replaced by the label service.
- The reverse result must be coordinate-derived, not IP-derived. Missing city may
  use locality; missing optional region/country remains null. HTTP, JSON, network,
  timeout or malformed responses fall back to “Current location” with feedback.
- GPS errors (denied, unavailable, timeout, unsupported) preserve the active city
  and provide guidance. Porto is only the initial fallback, never substituted for
  valid GPS coordinates because reverse lookup failed.
- The button stays available after success/manual selection to return to GPS.

## Geographic timezone

Only locations marked `source: "geolocation"` may use `timezone: "auto"`.
City search still requires a supported IANA timezone; null/invalid values remain
errors. The existing fetchWeather sends the coordinate/timezone parameters.
useCityWeather retains independent cache keys, AbortSignal and native query states.

The adapter resolves auto from Open-Meteo's validated IANA response. Explicit
city timezones must still match that response. No browser timezone or fixed UTC
offset is guessed. Existing Unix timestamp, DST and solar-event paths are reused.
No separate timezone request or dependency is required.

## Provider terms and privacy

The [BigDataCloud client endpoint](https://www.bigdatacloud.com/docs/free-api/free-reverse-geocode-to-city-api)
needs no API key. Its [fair-use policy](https://www.bigdatacloud.com/docs/article/fair-use-policy-for-free-client-side-reverse-geocoding-api)
requires freshly obtained, consented current device coordinates and direct calls
from that same client. Never call this endpoint from server-side tests, with
stored coordinates, or with arbitrary searched cities. There is no polling or
automatic retry loop; one reverse lookup follows each accepted GPS result.

Latitude/longitude are sent to BigDataCloud and Open-Meteo over HTTPS. The UI
states this. These providers also receive network metadata and have their own
privacy/retention policies. BigDataCloud describes using GPS/IP pairs to improve
its geolocation service; Atmos does not claim those providers retain nothing.

Atmos does not persist exact coordinates to browser storage or emit them to
analytics/application logs. They remain in active React state, request URLs and
in-memory query keys/cache (including developer tools). Browser network history
and provider logs are outside this promise. Permissions are browser-managed.
There is no watchPosition, background tracking, server proxy or IP fallback.
A secure context (HTTPS, or localhost during development) is required.

## Automated validation

`npm test` covers permission states/absence, browser failures, GPS validation,
reverse HTTP/JSON/network failures and timeouts, cancellation, late callbacks,
manual priority, duplicate requests, disposal and auto-timezone forecast mapping.
All external requests are mocked in these tests.

Run `npm run dev`, open `/tests/user-location.html` and choose **Run regression
tests** for eight mounted React DOM scenarios using the real App, controller,
services and query. The page mocks browser permissions/GPS and HTTP, requests no
physical location and sends no coordinates externally. **Show mocked dashboard**
after the suite provides a styled, interactive preview; reload before re-running.
Run `/tests/city-search.html` separately for the twelve existing search scenarios.
These DOM suites are not part of Node's test command or CI.

Synthetic tests cannot prove native permission prompts, GPS accuracy, mobile
keyboards, native autofill/touch synthesis, provider availability or every browser.
Real-device verification remains required before claiming broad compatibility.

## Manual device checklist

Test the PR preview over HTTPS in iPhone Safari/Chrome, iPadOS Safari/Chrome,
Android Chrome and desktop Chrome/Firefox/Edge, recording OS/browser versions.

1. Reset site permission to prompt: no unsolicited dialog on load. Activate the
   keyboard-focusable button; verify one browser prompt, busy status and no double
   submission. Denial leaves the current city and announces guidance.
2. Grant permission and reload: automatic retrieval only when Permissions API
   reports granted; otherwise explicit button works. Test approximate location
   settings, GPS disabled, timeout and unavailable positioning.
3. Confirm forecast latitude/longitude are the browser coordinates, timezone is
   auto and the response IANA zone drives hourly/day boundaries. Do not paste
   precise coordinates or network traces into public issues.
4. Search Lisbon while GPS/lookup is pending. Even a late GPS response must not
   replace it. Repeat Tokyo/Porto; then use the location button to return to GPS.
5. Block BigDataCloud: “Current location” and a lookup warning appear, while the
   coordinate forecast still loads. Block Open-Meteo: retain its normal error and
   Retry states without falling back to Porto weather under the GPS title.
6. Test city selection by touch/mouse/keyboard, scroll/cancel, Escape/Tab and
   re-opening after selection. Repeat both themes at 375, 768 and 1440 px.
7. Check focus visibility, announcements, wrapping/overflow and privacy wording.
   Verify no coordinate persistence in localStorage or analytics/application logs.
8. Navigate away while locating/resolving: no updates after unmount. Repeat the
   explicit button to obtain a fresh position; there must be no polling.
