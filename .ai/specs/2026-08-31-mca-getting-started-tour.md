# MCA Getting Started Tour

## TLDR
**Key Points:**
- After shop setup (`complete: true`), the first landing on Deals must teach the user how to run the shop: a welcome **dialog with a short video**, then **anchored popovers** on Deals, Pipeline, match/submit, Funders, and Settings.
- Persist dismiss/complete on existing `mca_workspace_settings.onboarding` JSON. No new entity, no tour library, no S3.

**Scope:**
- `merchant_advances` only: types/state/validators/status API, Dialog+spotlight host, `data-tour-id` anchors, wizard redirect `?tour=getting-started`, Settings replay, authenticated MP4+VTT, unit tests + one Playwright spec.

**Concerns:**
- Do not complete onboarding on the shared Railway demo tenant.
- Never auto-submit funders; tour copy must say the human selects then submits.
- Video ≤ 2 MB in git; raw screen captures stay out of the repo.

## Problem Statement
The shop-setup wizard explains how this ISO works (intake, people, funders, first deal). After Finish, the user lands on an empty Deals list with no teaching of the daily chrome: New deal, pipeline stages, ranked match, funder roster, and where to replay setup. Users can finish onboarding and still not know how to use the app.

## Proposed Solution
Follow SaaS getting-started patterns ([Amplitude video modal + Launch tour](https://mobbin.com/flows/881b4177-a000-4707-8129-4467c1d14e36), [Upwork Take a quick tour / Explore on your own](https://mobbin.com/flows/8de84d14-c69d-4164-8ce3-c6a0da4e1d00), [beehiiv Remind me later](https://mobbin.com/flows/2e01960d-3001-4150-9de1-f4e1fa95a825)):

1. Wizard finish/skip-complete → `/backend/merchant_advances?tour=getting-started`.
2. `Dialog` (`size="lg"`) with HTML `<video controls>` + captions, actions: Show me around / Explore on my own / Remind me later. Escape dismisses; Cmd/Ctrl+Enter starts the tour.
3. Spotlight popovers on `[data-tour-id]` targets. Next may change route.
4. Persist `gettingStarted: { dismissedAt, completedAt, currentStep }` on onboarding JSON. Completing the wizard **re-arms** the tour. Restarting the wizard clears it.
5. Replay from Settings → Setup without resetting shop setup.

Implementation plan: `docs/superpowers/plans/2026-08-31-mca-getting-started-tour.md`.

## Decisions
- **No new production dependency.** Use `Dialog`, `Button`, `Alert`/`SetupBanner`, DS tokens. Spotlight uses `getBoundingClientRect` (inline coordinates only).
- **Workspace-scoped v1**, not per-user. Replay is available to anyone who can open Settings.
- **Query param `tour=getting-started`** forces replay even after dismiss/complete.
- **Media** via `GET /api/merchant_advances/getting-started/video` (`requireAuth` + `merchant_advances.deal.view`), not `apps/mercato/public`.
- **Match step never auto-submits.** Copy: pick funders, then submit.

## Integration coverage
- Unit: `lib/onboarding/__tests__/state.test.ts`, `gettingStarted.test.ts` (launch rules, complete re-arms, schema patch).
- Playwright: `packages/core/src/modules/merchant_advances/__integration__/TC-MCA-TOUR-001-getting-started.spec.ts` — force query, skip, persist. Skips if `completedAt` is null (must not complete a shared tenant from the spec).
- UI paths: Deals, Pipeline, deal detail match list, Funders, Settings Setup.

## Migration & Backward Compatibility
Additive JSON fields and additive status API fields. Existing onboarding documents parse to `EMPTY_GETTING_STARTED`. No deprecation.

## Changelog
- 2026-08-31: Implemented tour JSON persistence, dialog and spotlight steps, authenticated video route, and Settings replay.
