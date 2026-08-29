# MCA CRM Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Open Mercato MCA Pilot parity via `merchant_advances`, with one worktree per feature.

**Architecture:** Hybrid — reuse `customers` for merchant/owner CRM, own MCA lifecycle in `merchant_advances`. Foundation declares all entities so feature worktrees do not collide.

**Tech Stack:** Open Mercato modules, MikroORM v7, zod, `makeCrudRoute`, commands, attachments, webhooks, AI assistant, queue workers.

## Global Constraints

- Module id `merchant_advances` (plural snake_case).
- No ORM relations to `customers` / `auth` / `attachments` entities — UUID + snapshot only.
- Every user-editable entity has `updated_at`; APIs return `updatedAt`.
- Reports require `merchant_advances.reports.view`; employee/rep/manager roles must not receive it.
- Never auto-submit funders; humans select.
- Stamp copies of statements; keep originals clean.
- Import result files exclude SSNs / full deal dumps.
- i18n keys only; `[internal]` prefix on throw/toast internals.
- Design-system tokens; no `text-red-*` / arbitrary px.
- Enable the module in both `apps/mercato/src/modules.ts` and `packages/create-app/template/src/modules.ts`.

Canonical feature plans: `.ai/specs/mca/plans/`.
