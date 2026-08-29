# AI Funder Matching Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-funder-matching-5aaa`.

**Goal:** Score the deal against 20+ funder criteria and rank funders. Team reviews; no auto-submit.

**Architecture:** Use foundation `scoreFunder`. Persist `mca_funder_matches`. UI: “Best match 92%”, industry fit, 1st position OK.

**Tech Stack:** Existing `lib/funderScore.ts`, POST `/api/merchant_advances/matches/refresh`.

## Global Constraints
- Matching knowledge lives in `mca_funders.criteria`, not reps’ heads.
- Humans pick funders.

### Task 1: Refresh + UI

**Files:**
- Create: `api/matches/refresh/route.ts`
- Create: `commands/matches.ts`
- Create: `backend/components/FunderMatchList.tsx`
- Test: extend `lib/__tests__/funderScore.test.ts` with 20-criteria fixtures

**Interfaces:**
- Consumes: `scoreFunder(deal, funder) => { score, reasons[] }`
- Produces: ranked `mca_funder_matches` rows, `merchant_advances.funder.matched` event

- [ ] **Step 1:** Criteria keys: industry, state, min/max AMR, min TIB months, max position, min/max requested, NSF cap, negative-day cap, existing-position cap, credit (optional), bankruptcy, use of funds, entity type, time-to-fund, min deposits, weekend deposits, stacking, preferred industries, excluded SIC, max holdback, min ADB.
- [ ] **Step 2:** Widget on deal detail; checkboxes for later submit (does not send).
- [ ] **Step 3:** Integration: seed two funders, refresh, assert rank order.
