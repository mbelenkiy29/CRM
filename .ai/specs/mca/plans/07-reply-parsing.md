# Auto-Parsed Funder Replies Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-reply-parsing-5aaa`.

**Goal:** Watch connected inbox; classify offer / decline / stip; extract amount, factor, term, payment, fees, stips; create offer; attach decline reasons; flag missing docs; advance pipeline.

**Architecture:** Subscriber on communication-channel inbound messages + API status write-back. Match deal by funder + merchant name / funder reference. Manual fallback already exists via offers CRUD.

**Tech Stack:** `inbox_ops` extraction worker pattern, `channel_gmail` / `channel_imap`, `defineAiTool`.

## Global Constraints
- Works for any email funder, not only APIs.
- API funders can create offers from status payloads.
- Do not auto-fund.
- Target quality (case study, not a test assertion): ~74% parsed, ~88% offers in a mature shop.

### Task 1: Parser + inbox worker

**Files:**
- Create: `lib/replies/classifyReply.ts`, `lib/replies/matchDeal.ts`
- Create: `subscribers/funder-email-received.ts`
- Create: `workers/parse-funder-reply.ts`
- Test: `lib/replies/__tests__/classifyReply.test.ts` with the MCA Pilot sample (“Approved. $75,000 at 1.32 for 6 months, daily $585. 10 points… Need 4 months bank statements and driver's license”)

**Interfaces:**
- Produces: `{ classification, amount, factor, termMonths, paymentAmount, paymentFrequency, commissionPoints, stips[] }`

- [ ] **Step 1:** Fixture-based tests (no network).
- [ ] **Step 2:** Create `mca_funder_replies` + `mca_offers` on offer class; decline reason on submission; stips listed.
- [ ] **Step 3:** Advance deal to `offered` / `declined` via pipeline helper.
- [ ] **Step 4:** Integration: inject parsed email body, assert offer row and stage.
