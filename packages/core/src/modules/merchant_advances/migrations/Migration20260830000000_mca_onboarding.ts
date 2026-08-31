import { Migration } from '@mikro-orm/migrations'

export class Migration20260830000000_mca_onboarding extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "mca_workspace_settings" add column "onboarding" jsonb null;`)
    this.addSql(`alter table "mca_workspace_settings" add column "plan" text null;`)
    this.addSql(`alter table "mca_workspace_settings" add column "trial_ends_at" timestamptz null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "mca_workspace_settings" drop column "onboarding";`)
    this.addSql(`alter table "mca_workspace_settings" drop column "plan";`)
    this.addSql(`alter table "mca_workspace_settings" drop column "trial_ends_at";`)
  }
}
