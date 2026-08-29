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
