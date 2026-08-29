# Commissions and Money Math Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-commissions-5aaa`.

**Goal:** Auto-calculate payback, scheduled payments, commission splits; track funded amount and distributions. Profit-by-user is admin-only (reports feature).

**Architecture:** Foundation `lib/money.ts`. On `merchant_advances.deal.funded` / offer accept, write `mca_fundings`, `mca_commissions`, `mca_commission_splits`.

**Tech Stack:** commands, events, deal funding action endpoint.

## Global Constraints
- Team profit view is `reports.view` only.
- Use decimal string helpers; no float UI math.

### Task 1: Funding + splits

**Files:**
- Create: `commands/funding.ts`, `api/fundings/route.ts`
- Create: `backend/components/CommissionSplits.tsx`
- Test: `lib/__tests__/money.test.ts` already covers formulas; add split remainder test

**Interfaces:**
- Produces: `createFundingFromOffer(offer)` → funding + commission + splits
- Payback = amount × factor; payment = payback / period count; commission = funded × (points/100)

- [ ] **Step 1:** Default split = deal owner 100% of points; extra split rows must sum to parent points.
- [ ] **Step 2:** Distributions stored on splits; funded amount on funding.
- [ ] **Step 3:** Integration: accept offer, assert payback 99000, daily 585, commission 7500 for the marketing example.
