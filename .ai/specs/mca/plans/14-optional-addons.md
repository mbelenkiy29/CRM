# Optional Add-on Workflows Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-optional-addons-5aaa`.

**Goal:** Onboarding-configured add-ons using the shop’s own vendor accounts: SMS follow-ups, ACH-authorization e-sign, secure merchant document upload links.

**Architecture:** Provider-owned integrations (do not put vendor keys in core). Feature flags via `feature_toggles` or workspace settings. Upload links overlap feature 01 — extend, do not duplicate.

**Tech Stack:** `integrations` credentials, communication_channels SMS if present, existing e-sign only if a package exists (otherwise adapter interface + one example webhook).

## Global Constraints
- Ask before adding production npm dependencies.
- Ask before provider-specific preconfiguration outside the provider package.
- Soft-optional: missing provider → settings show “not configured”.

### Task 1: Adapter slots

**Files:**
- Create: `lib/addons/sms.ts`, `lib/addons/achEsign.ts`, `lib/addons/merchantUpload.ts`
- Create: settings cards on `backend/settings/page.tsx`
- Test: addons resolve null when integration disabled

- [ ] **Step 1:** SMS follow-up worker no-ops without credentials.
- [ ] **Step 2:** ACH e-sign stores envelope id on the deal (json snapshot), not raw bank numbers.
- [ ] **Step 3:** Upload links reuse feature 01 tokens.
- [ ] **Step 4:** Integration: settings page loads; sending without provider returns a typed error, not a 500.
