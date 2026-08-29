# MCA CRM feature worktrees

Master spec: [`.ai/specs/2026-08-29-mca-crm-platform.md`](../2026-08-29-mca-crm-platform.md)

Foundation branch: `cursor/mca-crm-platform-5aaa`  
Worktree root: `.worktrees/` (gitignored)

Created from foundation `4bcd7781c` (update after rebases):

| Branch | Path |
|--------|------|
| `cursor/mca-application-intake-5aaa` | `.worktrees/mca-application-intake` |
| `cursor/mca-bulk-import-5aaa` | `.worktrees/mca-bulk-import` |
| `cursor/mca-statement-underwriting-5aaa` | `.worktrees/mca-statement-underwriting` |
| `cursor/mca-funder-matching-5aaa` | `.worktrees/mca-funder-matching` |
| `cursor/mca-multi-funder-submit-5aaa` | `.worktrees/mca-multi-funder-submit` |
| `cursor/mca-document-protection-5aaa` | `.worktrees/mca-document-protection` |
| `cursor/mca-reply-parsing-5aaa` | `.worktrees/mca-reply-parsing` |
| `cursor/mca-pipeline-offers-5aaa` | `.worktrees/mca-pipeline-offers` |
| `cursor/mca-renewals-5aaa` | `.worktrees/mca-renewals` |
| `cursor/mca-commissions-5aaa` | `.worktrees/mca-commissions` |
| `cursor/mca-duplicate-protection-5aaa` | `.worktrees/mca-duplicate-protection` |
| `cursor/mca-reporting-5aaa` | `.worktrees/mca-reporting` |
| `cursor/mca-team-ops-pwa-5aaa` | `.worktrees/mca-team-ops-pwa` |
| `cursor/mca-optional-addons-5aaa` | `.worktrees/mca-optional-addons` |

Backend pages MUST live under `packages/core/src/modules/merchant_advances/backend/merchant_advances/` (`/backend/settings` is owned by auth).

**Rule:** Foundation owns `data/entities.ts`, `acl.ts`, `events.ts`, `encryption.ts`, and shared `lib/*` math. Feature worktrees MUST NOT edit those files unless the plan's Interfaces block names a new column. Add commands, APIs, workers, pages, and tests in feature-owned paths.

| # | Feature | Branch | Plan | Depends on |
|---|---------|--------|------|------------|
| 0 | Foundation (entities, CRUD, nav, math) | `cursor/mca-crm-platform-5aaa` | [plans/00-foundation.md](plans/00-foundation.md) | — |
| 1 | Application intake | `cursor/mca-application-intake-5aaa` | [plans/01-application-intake.md](plans/01-application-intake.md) | 0 |
| 2 | Bulk deal importing | `cursor/mca-bulk-import-5aaa` | [plans/02-bulk-import.md](plans/02-bulk-import.md) | 0 |
| 3 | AI bank-statement underwriting | `cursor/mca-statement-underwriting-5aaa` | [plans/03-statement-underwriting.md](plans/03-statement-underwriting.md) | 0 |
| 4 | AI funder matching | `cursor/mca-funder-matching-5aaa` | [plans/04-funder-matching.md](plans/04-funder-matching.md) | 0, 3 |
| 5 | One-click multi-funder submission | `cursor/mca-multi-funder-submit-5aaa` | [plans/05-multi-funder-submit.md](plans/05-multi-funder-submit.md) | 0, 4 |
| 6 | Document protection | `cursor/mca-document-protection-5aaa` | [plans/06-document-protection.md](plans/06-document-protection.md) | 0, 5 |
| 7 | Auto-parsed funder replies | `cursor/mca-reply-parsing-5aaa` | [plans/07-reply-parsing.md](plans/07-reply-parsing.md) | 0, 5 |
| 8 | Pipeline, deals, and offers UI | `cursor/mca-pipeline-offers-5aaa` | [plans/08-pipeline-offers.md](plans/08-pipeline-offers.md) | 0 |
| 9 | Renewals | `cursor/mca-renewals-5aaa` | [plans/09-renewals.md](plans/09-renewals.md) | 0 |
| 10 | Commissions | `cursor/mca-commissions-5aaa` | [plans/10-commissions.md](plans/10-commissions.md) | 0 |
| 11 | Duplicate-deal protection | `cursor/mca-duplicate-protection-5aaa` | [plans/11-duplicate-protection.md](plans/11-duplicate-protection.md) | 0, 5 |
| 12 | Reporting and analytics | `cursor/mca-reporting-5aaa` | [plans/12-reporting.md](plans/12-reporting.md) | 0, 9, 10 |
| 13 | Team, roles, PWA, notifications | `cursor/mca-team-ops-pwa-5aaa` | [plans/13-team-ops-pwa.md](plans/13-team-ops-pwa.md) | 0 |
| 14 | Optional add-ons | `cursor/mca-optional-addons-5aaa` | [plans/14-optional-addons.md](plans/14-optional-addons.md) | 0, 1 |

## Parallelism

Safe in parallel after Phase 0: 1, 2, 3, 8, 9, 10, 13, 14.  
Serialize onto 5: 6, 7, 11.  
12 after 9+10.

## Agent contract

Each worktree agent:

1. Reads the master spec + its plan file first.
2. Copies `customers` / `warranty_claims` patterns; no cross-module ORM.
3. Uses `useT` / `resolveTranslations`; DS tokens only.
4. Adds integration coverage listed in its plan.
5. Runs `yarn generate` if it adds auto-discovered files.
6. Does not enable extra production dependencies without asking.

Context7 quota was exhausted at planning time; agents should retry Context7 for Next.js / MikroORM / zod docs when available.
