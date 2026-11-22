# Responsive previews and post-merge record

Recorded on 22 November 2026. This change contains documentation and images only.

## Production source

[PR #14](https://github.com/arafamdev/atmos-weather-app/pull/14) was explicitly
authorized for squash merge after its checks passed. Its reviewed head was
`1747e81bf4cd3a5a44851f18a98958d2c218cf7d`; the resulting main commit is
`6e052806c470409251dc38cdebc6329ada5981fd`.

GitHub Actions passed on main (run 44982450729). The Vercel production deployment
`atmos-weather-hj25bc2s1-arafamdev.vercel.app` was Ready and its metadata matched
that main commit. [The public domain](https://atmos-by-arafam.vercel.app) was opened
and used for the screenshots. Ready confirms deployment, not physical GPS behavior.

## Images and capture method

All six images capture the actual production interface with live Open-Meteo data
for Lisbon, selected through CitySearch. No mock weather, GPS requests, device
coordinates, permission prompts, developer tools or credentials appear in them.
The app's normal privacy notice remains visible.

The in-app desktop browser used representative viewport overrides, not physical
devices. Classic scrollbars reduce the content width by 15 pixels. Its screenshot
API exported JPEGs at 1425 × 891 (desktop), 753 × 1004 (tablet) and 375 × 812
(mobile). A local browser canvas converted them to WebP at quality 0.96 and
normalized the output to the requested dimensions (at most 4% enlargement).
No UI elements were composited, invented, removed or retouched. The local helper
and JPEG intermediates stayed outside the repository; no dependency was installed.

Mobile captures were scrolled approximately 30 CSS pixels to keep the complete
current-weather card in view. Desktop/tablet show the top of the page; lower
forecast sections naturally continue below the viewport. These are viewport
previews, not full-page screenshots.

| File | Output dimensions | Bytes |
| --- | --- | ---: |
| [screenshot/desktop-dark.webp](screenshots/desktop-dark.webp) | 1440 × 900 | 63,006 |
| [screenshot/desktop-light.webp](screenshots/desktop-light.webp) | 1440 × 900 | 62,098 |
| [screenshot/tablet-dark.webp](screenshots/tablet-dark.webp) | 768 × 1024 | 47,120 |
| [screenshot/tablet-light.webp](screenshots/tablet-light.webp) | 768 × 1024 | 45,212 |
| [screenshot/mobile-dark.webp](screenshots/mobile-dark.webp) | 390 × 844 | 39,222 |
| [screenshot/mobile-light.webp](screenshots/mobile-light.webp) | 390 × 844 | 37,192 |

Each final WebP was opened for visual inspection, and its signature, dimensions
and README path were checked. Both themes loaded without alerts/loading states;
city heading and current card agreed on Lisbon. The document scroll width equalled
its client width at each viewport. No production console warnings/errors were
observed in the capture tabs. Images are public portfolio assets, not test fixtures.

## Validation and limits

- `npm test`: 212 passed, 0 failed, cancelled, skipped or todo.
- `npm run lint`: passed.
- `npm run build`: passed; Vite 8.3.8, 2169 transformed modules.
- `git diff --check`: passed.
- Mounted DOM CitySearch suite: 12 passed in the in-app browser.
- Mounted DOM user-location suite: 11 passed in the in-app browser.

The DOM suites use mocked permission/GPS and provider responses. They cover an
existing grant on a return visit, no first-visit prompt, immediate coordinate
weather during slow reverse lookup, name-only enrichment without refetch, manual
selection priority, cancellation, failures, and consecutive manual/GPS selections.
They do not exercise physical GPS, native permission dialogs, mobile keyboards
or actual iOS touch synthesis. No new physical-device validation was available.

The real production screenshot checks cover live weather, city selection, themes
and responsive presentation in a desktop browser. Firefox/Edge, native iOS/Android,
screen readers and GPS accuracy remain manual validation items. See
[location architecture and manual checklist](USER_LOCATION.md) and
[the detailed PR #14 audit](USER_LOCATION_AUDIT.md).

## Safe branch cleanup

The working tree was clean before merge/cleanup. Every deleted branch matched the
complete file tree of its associated merged PR's squash commit, and that squash
commit was an ancestor of updated main. Branch tips matched PR heads; no open PR
or unpublished local work was found. Full comparisons against current main were
also reviewed: later features explain differences for historical branches. Squash
history alone was not used as evidence of preservation.

| Branch | PR | Previous tip | Files differing from current main | Deleted |
| --- | --- | --- | ---: | --- |
| `chore/remove-unused-files` | #12 | `33bc148c01a995f417c9d89968f259eb011c8a9a` | 20 | Local and remote |
| `feat/automatic-user-location` | #14 | `1747e81bf4cd3a5a44851f18a98958d2c218cf7d` | 0 | Local and remote |
| `fix/cross-browser-city-selection` | #13 | `2f258d658a15beb4d7cd24790a52ca2bfd266872` | 17 | Local and remote |
| `chore/github-actions-ci` | #4 | `442cd7b86b5e4c80c2618a07de605d55b968af80` | 61 | Remote (no local branch existed) |
| `feat/open-meteo-integration` | #3 | `58af6d87a4d13c67e42612f8bebfd79b1078ba31` | 62 | Remote (no local branch existed) |
| `feat/weather-dashboard` | #2 | `d9eb32d94b24ca4266c6aadc3ac44797f3b44f0f` | 62 | Remote (no local branch existed) |

Local deletions succeeded with `git branch -d`; `-D` was unnecessary. Main and its
remote were preserved. `origin/HEAD` is a symbolic default-branch reference, not
an obsolete branch. No other old branches remained. The new
`docs/add-responsive-previews` branch is intentionally preserved for review.

## Git commands and purpose

```bash
git fetch origin --prune
# Verify PR state, head, checks and conflicts before the authorized merge:
gh pr merge 14 --repo arafamdev/atmos-weather-app --squash --match-head-commit 1747e81bf4cd3a5a44851f18a98958d2c218cf7d
git switch main
git fetch origin --prune
git pull --ff-only origin main
git rev-list --left-right --count main...origin/main
```

Fetch updates remote references; prune removes stale tracking refs. The merge
command pins the reviewed PR head. Fast-forward-only pull refuses divergent main
history. The divergence check returned 0/0.

Full-tree comparisons used `git diff --exit-code`, tree SHAs from `git rev-parse`,
and `git merge-base --is-ancestor` for the already verified squash commit.
An empty tree diff confirms contents; ancestry confirms that squash is in main.

```bash
git branch -d chore/remove-unused-files feat/automatic-user-location fix/cross-browser-city-selection
git push origin --delete chore/github-actions-ci chore/remove-unused-files feat/automatic-user-location feat/open-meteo-integration feat/weather-dashboard fix/cross-browser-city-selection
git fetch origin --prune
git branch -a
git switch -c docs/add-responsive-previews
```

Deletion was performed only after the content checks above. The documentation
branch starts at the production squash commit. Only README, this record and six
images are staged for `docs: add responsive application previews`, then published
with `git push -u origin docs/add-responsive-previews` and a separate PR to main.
That PR must remain open for manual review; no application code is changed.
