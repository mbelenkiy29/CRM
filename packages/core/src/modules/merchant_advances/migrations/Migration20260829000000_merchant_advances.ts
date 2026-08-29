import { Migration } from '@mikro-orm/migrations'

export class Migration20260829000000_merchant_advances extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`create table "mca_lead_sources" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "cost_amount" numeric(14,2) null, "cost_currency" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_lead_sources_org_tenant_idx" on "mca_lead_sources" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_lead_batches" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "lead_source_id" uuid null, "name" text not null, "purchased_at" timestamptz null, "lead_count" int null, "cost_amount" numeric(14,2) null, "cost_currency" text null, "import_job_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_lead_batches_org_tenant_idx" on "mca_lead_batches" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_intake_addresses" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "email_address" text not null, "default_owner_user_id" uuid null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_intake_addresses_org_tenant_idx" on "mca_intake_addresses" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_deals" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "business_name" text not null, "merchant_company_id" uuid null, "merchant_name_snapshot" text null, "merchant_state_snapshot" text null, "primary_person_id" uuid null, "customer_deal_id" uuid null, "owner_user_id" uuid null, "pipeline_status" text not null default 'new_app', "requested_amount" numeric(14,2) null, "avg_monthly_revenue" numeric(14,2) null, "time_in_business_months" int null, "position" int null, "industry" text null, "state" text null, "ein" text null, "legal_address" text null, "start_date" timestamptz null, "lead_source_id" uuid null, "lead_batch_id" uuid null, "assignment_method" text not null default 'manual', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_deals_org_tenant_idx" on "mca_deals" ("organization_id", "tenant_id");`)
    this.addSql(`create index "mca_deals_status_idx" on "mca_deals" ("organization_id", "tenant_id", "pipeline_status");`)
    this.addSql(`create index "mca_deals_owner_idx" on "mca_deals" ("organization_id", "tenant_id", "owner_user_id");`)

    this.addSql(`create table "mca_documents" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "classification" text not null, "attachment_id" uuid not null, "stamped_attachment_id" uuid null, "destination_funder_id" uuid null, "is_original" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_documents_deal_idx" on "mca_documents" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_statement_analyses" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "attachment_id" uuid null, "avg_monthly_revenue" numeric(14,2) null, "avg_daily_balance" numeric(14,2) null, "deposit_count" int null, "nsf_count" int null, "negative_days" int null, "existing_positions" int null, "model" text null, "confidence" numeric(5,2) null, "notes" text null, "reviewed_by_user_id" uuid null, "reviewed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_statement_analyses_deal_idx" on "mca_statement_analyses" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_funders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text null, "submit_method" text not null default 'email', "submit_email" text null, "portal_url" text null, "webhook_url" text null, "api_provider_key" text null, "requires_unstamped_statements" boolean not null default false, "supports_status_poll" boolean not null default false, "criteria" jsonb null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_funders_org_tenant_idx" on "mca_funders" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_funder_matches" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "funder_id" uuid not null, "score" numeric(5,2) not null, "reasons" jsonb null, "rank" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_funder_matches_deal_idx" on "mca_funder_matches" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_submissions" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "funder_id" uuid not null, "method" text not null, "status" text not null default 'draft', "funder_reference" text null, "decline_reason" text null, "validation_errors" jsonb null, "payload_snapshot" jsonb null, "sent_from_address" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_submissions_deal_idx" on "mca_submissions" ("deal_id", "organization_id", "tenant_id");`)
    this.addSql(`create unique index "mca_submissions_deal_funder_unique" on "mca_submissions" ("tenant_id", "organization_id", "deal_id", "funder_id") where "deleted_at" is null;`)

    this.addSql(`create table "mca_funder_replies" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "submission_id" uuid null, "deal_id" uuid not null, "raw_source" text not null, "classification" text not null, "raw_body" text null, "parsed_payload" jsonb null, "confidence" numeric(5,2) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_funder_replies_deal_idx" on "mca_funder_replies" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_offers" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "submission_id" uuid null, "funder_id" uuid null, "amount" numeric(14,2) null, "factor" numeric(8,4) null, "term_months" int null, "payment_amount" numeric(14,2) null, "payment_frequency" text null, "fees_amount" numeric(14,2) null, "commission_points" numeric(8,4) null, "stips" jsonb null, "status" text not null default 'open', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_offers_deal_idx" on "mca_offers" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_fundings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "deal_id" uuid not null, "offer_id" uuid null, "funded_amount" numeric(14,2) not null, "funded_at" timestamptz not null, "term_months" int null, "payment_frequency" text null, "payment_amount" numeric(14,2) null, "payback_amount" numeric(14,2) null, "paid_in_pct" numeric(5,2) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_fundings_deal_idx" on "mca_fundings" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_commissions" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "funding_id" uuid not null, "deal_id" uuid not null, "points" numeric(8,4) null, "amount" numeric(14,2) null, "currency" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_commissions_deal_idx" on "mca_commissions" ("deal_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_commission_splits" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "commission_id" uuid not null, "user_id" uuid null, "role" text null, "points" numeric(8,4) null, "amount" numeric(14,2) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_commission_splits_commission_idx" on "mca_commission_splits" ("commission_id", "organization_id", "tenant_id");`)

    this.addSql(`create table "mca_renewals" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "funding_id" uuid not null, "deal_id" uuid not null, "merchant_company_id" uuid null, "paid_in_pct" numeric(5,2) null, "surfaced_at" timestamptz null, "status" text not null default 'watching', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_renewals_org_tenant_idx" on "mca_renewals" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_import_jobs" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "source" text not null, "status" text not null, "deal_count" int null, "failure_count" int null, "result_attachment_id" uuid null, "column_map" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_import_jobs_org_tenant_idx" on "mca_import_jobs" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_import_mappings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "provider_name" text not null, "column_map" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`create index "mca_import_mappings_org_tenant_idx" on "mca_import_mappings" ("organization_id", "tenant_id");`)

    this.addSql(`create table "mca_workspace_settings" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "round_robin_cursor_user_id" uuid null, "broker_logo_attachment_id" uuid null, "default_from_address" text null, "watermark_enabled" boolean not null default true, "renewal_paid_in_threshold" int not null default 80, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`)
    this.addSql(`alter table "mca_workspace_settings" add constraint "mca_workspace_settings_org_tenant_unique" unique ("organization_id", "tenant_id");`)
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "mca_workspace_settings" cascade;`)
    this.addSql(`drop table if exists "mca_import_mappings" cascade;`)
    this.addSql(`drop table if exists "mca_import_jobs" cascade;`)
    this.addSql(`drop table if exists "mca_renewals" cascade;`)
    this.addSql(`drop table if exists "mca_commission_splits" cascade;`)
    this.addSql(`drop table if exists "mca_commissions" cascade;`)
    this.addSql(`drop table if exists "mca_fundings" cascade;`)
    this.addSql(`drop table if exists "mca_offers" cascade;`)
    this.addSql(`drop table if exists "mca_funder_replies" cascade;`)
    this.addSql(`drop table if exists "mca_submissions" cascade;`)
    this.addSql(`drop table if exists "mca_funder_matches" cascade;`)
    this.addSql(`drop table if exists "mca_funders" cascade;`)
    this.addSql(`drop table if exists "mca_statement_analyses" cascade;`)
    this.addSql(`drop table if exists "mca_documents" cascade;`)
    this.addSql(`drop table if exists "mca_deals" cascade;`)
    this.addSql(`drop table if exists "mca_intake_addresses" cascade;`)
    this.addSql(`drop table if exists "mca_lead_batches" cascade;`)
    this.addSql(`drop table if exists "mca_lead_sources" cascade;`)
  }
}
