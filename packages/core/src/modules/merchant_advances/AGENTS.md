# Merchant Advances Module — Agent Guidelines

MCA broker/ISO CRM: applications, underwriting, funder match, submissions, offers, renewals, and commissions.

Design of record: [`.ai/specs/2026-08-29-mca-crm-platform.md`](../../../../../.ai/specs/2026-08-29-mca-crm-platform.md). Feature plans: [`.ai/specs/mca/`](../../../../../.ai/specs/mca/).

## Always

1. MUST treat `mca_deals` as the MCA source of truth. Optional `customer_deal_id` is a UUID snapshot link, never an ORM relation to `customers`.
2. MUST keep `data/entities.ts` stable for feature worktrees unless the plan names a new column.
3. MUST NOT auto-submit funders. Matching only writes `mca_funder_matches`.
4. MUST stamp statement copies; never overwrite `mca_documents.attachment_id`.
5. MUST hide reports behind `merchant_advances.reports.view`.
6. MUST use `findWithDecryption` for EIN, legal address, and reply bodies.
7. MUST run money math through `lib/money.ts` and `lib/paidIn.ts`.

## Ask First

- Ask before adding a production dependency or a provider-specific funder API package.
- Ask before changing pipeline statuses or ACL feature IDs.

## Never

- Never import `customers` / `auth` ORM entities.
- Never guard pages with `requireRoles`.
- Never put SSNs in import result CSVs.

## Validation Commands

```bash
yarn workspace @open-mercato/core test -- merchant_advances
yarn generate
yarn workspace @open-mercato/core build
```
