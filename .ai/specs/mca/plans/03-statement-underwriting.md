# AI Bank-Statement Underwriting Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-statement-underwriting-5aaa`.

**Goal:** When statements land, extract AMR, ADB, deposit count, NSFs, negative days, existing positions. Combine with industry, TIB, position, state, requested amount. Human remains the underwriter.

**Architecture:** Subscriber on `merchant_advances.deal.created` / attachment classified `statement` → queue worker → write `mca_statement_analyses`. AI tool for re-run.

**Tech Stack:** `attachments` `content` / OCR, `ai_assistant` `defineAiTool`, queue worker.

## Global Constraints
- Does not replace human underwriter; no auto-decline.
- Does not auto-submit.
- Encrypt free-text notes.

### Task 1: Extractor + worker

**Files:**
- Create: `lib/underwriting/extractStatement.ts`
- Create: `workers/analyze-statements.ts`
- Create: `subscribers/statement-landed.ts`
- Test: `lib/underwriting/__tests__/extractStatement.test.ts`

**Interfaces:**
- Produces: `extractStatementMetrics(markdown) => { avgMonthlyRevenue, avgDailyBalance, depositCount, nsfCount, negativeDays, existingPositions }`

- [ ] **Step 1:** Unit-test against fixture statement markdown (no network).
- [ ] **Step 2:** Worker updates analysis row + may copy AMR onto deal if deal.avgMonthlyRevenue is null (sheet wins).
- [ ] **Step 3:** Deal detail panel shows analysis + “Mark reviewed”.
- [ ] **Step 4:** Integration: attach fixture PDF, wait for analysis row, assert fields.
