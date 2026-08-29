# Merchant Advances

MCA broker CRM module. Foundation CRUD, pipeline math, and seeded funders live here. Feature PRs stack on `cursor/mca-crm-platform-5aaa`.

## How to demo this PR (deal workspace)

1. Sign in as `admin@acme.com` / `secret` (or the tenant admin you already have).
2. Open **MCA → Deals** (`/backend/merchant_advances`) and create **Sunset Diner** (or open it if it already exists).
3. Confirm the deal workspace tabs: Overview, Statements, Matches, Submissions, Replies, Offers, Funding, Renewals, Activity.
4. On **Offers**, keep the defaults (`75000` × `1.32` × `6` months, `10` points, daily). Click **Add offer**.
   - The compare table should show payback math as payment `785.71`.
   - Creating the offer walks the deal along legal hops to **Offers in** (`offered`) so Accept is legal. Matching and submit are still empty-state stubs.
5. Click **Accept**. The **Funding** tab should show funded amount `75000.00`, payback `99000.00`, payment `785.71`, points `10` → commission `7500.00`, and the default owner 100% split.
6. A renewal watch row appears on the **Renewals** tab. Use Contacted / Renewed / Lost to write status back.
7. Open **MCA → Pipeline**. Search/filter stages, move a card only to a legal next stage, and confirm funded cards show paid-in %.

Manual fallback also on the deal: paste a reply, mark declined, add stips. Nothing auto-submits funders from this PR.

## How to demo this PR (funder matching)

1. Open Sunset Diner (or create it) with industry `Auto repair`, state `TX`, AMR `142000`, TIB `36`, position `1`, requested `75000`.
2. Open the **Matches** tab and click **Re-score funders**.
3. Harbor Advance and Northstar Capital should appear ranked, with why-it-matched chips (industry, state, position, revenue, NSF, ADB, and the rest of the 20+ appetite fields).
4. Check two funders. Nothing is sent — the pick list is stored for the later submit PR.
5. Re-score is also hooked to `merchant_advances.statement.analyzed` so underwriting can refresh matches without submitting.

## How to demo this PR (submit + stamps + duplicates)

1. On Sunset Diner, re-score matches and check Harbor Advance and Northstar Capital.
2. Click **Submit selected funders**.
3. Submissions tab shows two rows (email queued or webhook sent / API deferred). Protected copies are extra `mca_documents` rows with `is_original=false`; originals stay clean.
4. Click submit again for the same funders: the API returns 409 `duplicate_funder_submission` and no extra send happens.
5. A funder with `requiresUnstampedStatements` skips the stamp. Live HTTP APIs stay `api_deferred`.
