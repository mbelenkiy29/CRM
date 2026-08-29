# Reporting and Analytics Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-reporting-5aaa`.

**Goal:** Admin/Super Admin only: rep performance, team performance, funder analytics, lead analytics (conversion, avg commission, CAC, ROI, cost per funded), role-based CSV exports.

**Architecture:** Read APIs gated by `merchant_advances.reports.view`. Pages already exist as a shell — fill them. Managers/Reps must not see the nav item (page.meta feature).

**Tech Stack:** query engine / raw scoped SQL via EM, DataTable export, dashboard widgets optional.

## Global Constraints
- Profit-by-user is admin-only.
- Admins can bulk-export all deals + owners, or all funded deals.
- Filtered Deals/Offers CSV also available on those list pages (feature 08).

### Task 1: Report APIs + UI

**Files:**
- Create: `api/reports/rep/route.ts`, `team/route.ts`, `funders/route.ts`, `leads/route.ts`, `exports/route.ts`
- Modify: `backend/reports/page.tsx`
- Test: `lib/reports/__tests__/aggregates.test.ts`

**Interfaces:**
- Rep: deals in, submitted, approved, funded, funded amount, distributions, stage conversion
- Team: stage output, payments, distributions, profit by user
- Funder: funded, approved, earned, submitted, commissions
- Lead: conversion/value by source and batch, avg commission, CAC, ROI, cost per funded

- [ ] **Step 1:** All queries filter tenant+org.
- [ ] **Step 2:** Employee token cannot GET report routes (403).
- [ ] **Step 3:** Integration: seed two reps, assert aggregates; export CSV has no SSN.
