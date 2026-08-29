# Duplicate-Deal Protection Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-duplicate-protection-5aaa`.

**Goal:** Same-deal duplicate submission check before a rep submits again. Workspace-scoped.

**Architecture:** Foundation unique index + `assertUniqueSubmission`. Wire into send command (if submit worktree has not yet, add a command interceptor).

**Tech Stack:** `enforce` in `commands/submit.ts` or `api/interceptors.ts` targeting send.

## Global Constraints
- Prevents spraying the same merchant file to the same funder twice.
- Shop history is the source of truth (not a national stack list).

### Task 1: Guard + UI

**Files:**
- Create: `lib/duplicates/findSimilarDeals.ts` (same EIN or business name + state, warn only)
- Modify: send path to hard-block exact deal+funder open/sent submission
- Test: `lib/__tests__/duplicateCheck.test.ts`

- [ ] **Step 1:** 409 with i18n key when duplicate funder submit.
- [ ] **Step 2:** Soft warn when another open deal shares EIN.
- [ ] **Step 3:** Integration: second send to same funder fails; different funder succeeds.
