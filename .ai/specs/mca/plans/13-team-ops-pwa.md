# Team, Roles, Ops, and PWA Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-team-ops-pwa-5aaa`.

**Goal:** Seat-based team management, assignment/sending-address oversight, role-based report access (already ACL), custom notifications, custom event webhooks, installable web app.

**Architecture:** Roles stay feature-based. Seed custom role names Super Admin (existing), Admin (existing), Manager, Rep via `setup.ts` **role records** if the auth API allows custom roles — still guard pages with features, never `requireRoles`.

**Tech Stack:** `staff` assignable roster, `notifications.ts`, `@open-mercato/webhooks` outbound, Next.js PWA (webmanifest + service worker).

## Global Constraints
- Editing `apps/mercato/src/app/**` MUST mirror `packages/create-app/template/src/app/**`.
- PWA is installable web (phone + desktop), not a native store app.

### Task 1: Roles + notifications + webhooks

**Files:**
- Modify: `setup.ts` employee vs a new `manager` custom role feature set (no reports)
- Create: `notifications.ts` types for deal created, submission failed, offer created, renewal due
- Document outbound event ids for shop webhooks (existing webhooks package)

### Task 2: PWA

**Files:**
- Create/mirror: `apps/mercato/src/app/manifest.ts` or `public/manifest.webmanifest`
- Create/mirror: service worker registration in layout (template sync required)
- Settings: sending addresses + assignment oversight page

- [ ] **Step 1:** Manifest name “MCA”, start_url `/backend/merchant_advances`, display standalone.
- [ ] **Step 2:** Integration: GET manifest 200; manager user has no Reports nav.
