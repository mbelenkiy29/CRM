# MCA Getting Started Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After shop setup completes, land the user on Deals with a welcome dialog that plays a short getting-started video, then walk five anchored popovers so they know how to create a deal, use the pipeline, match/submit funders (never auto-submit), open the funder roster, and replay the tour from Settings.

**Architecture:** Persist tour dismiss/complete on the existing workspace `mca_workspace_settings.onboarding` JSON (no new entity, no new production dependency). Mount one client host (`McaPageChrome`) on MCA pages. First overlay is the existing `Dialog` primitive with an HTML `<video>`; later steps are a spotlight + popover card positioned from `[data-tour-id]` anchors. Wizard finish redirects to `/backend/merchant_advances?tour=getting-started`. Replay from Settings → Setup. Context7 monthly quota was exceeded; this plan uses in-repo Dialog/Popover/`NextStepCallout` plus Mobbin web-tour patterns ([Amplitude Launch tour](https://mobbin.com/flows/881b4177-a000-4707-8129-4467c1d14e36), [Upwork Take a quick tour](https://mobbin.com/flows/8de84d14-c69d-4164-8ce3-c6a0da4e1d00), [beehiiv Remind me later](https://mobbin.com/flows/2e01960d-3001-4150-9de1-f4e1fa95a825)).

**Tech Stack:** Existing `@open-mercato/ui` Dialog + Button + Alert, Radix `PopoverAnchor` only if an in-tree trigger exists (spotlight uses `getBoundingClientRect` when the target is a DataTable toolbar), MCA onboarding JSON + `onboardingSaveSchema`, `apiCall`/`readApiResultOrThrow`/`useGuardedMutation`, `useT` i18n, HTML5 video + WebVTT. **Do not add driver.js, Shepherd, intro.js, or any other tour library** (Ask First for production deps).

## Global Constraints

- Module id `merchant_advances`; no new module.
- No new ORM entity and no `yarn db:migrate`; tour state lives on `McaWorkspaceSettings.onboarding` JSON.
- Optimistic locking already exists on workspace settings; tour PATCH goes through `merchant_advances.onboarding.save` (same command as the wizard).
- Never auto-submit funders. Tour copy must say the human picks funders, then clicks submit.
- i18n keys only; `[internal]` prefix on throw/toast internals.
- Design-system tokens only; no `text-red-*`, no arbitrary `text-[13px]`, no `dark:` on semantic tokens. Inline `style` is allowed solely for spotlight coordinates (`top`/`left`/`width`/`height`).
- Dialog: Escape dismisses; Cmd/Ctrl+Enter starts the tour (primary action).
- Do not finish onboarding on the shared Railway demo tenant; that writes `completedAt` for everyone on that workspace.
- Video file must stay small (target ≤ 2 MB). Do not commit a huge screen capture. Serve it authenticated from the module, not S3 (`OM_ENABLE_STORAGE_S3=false`).
- Do not add code under `apps/mercato/src/` except generated registries. Public MCA video does **not** go in `apps/mercato/public/` (create-app template has no MCA). Serve via `/api/merchant_advances/getting-started/video`.
- Preserve wizard behavior except the post-complete redirect query string.

Companion spec: `.ai/specs/2026-08-31-mca-getting-started-tour.md`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/core/src/modules/merchant_advances/lib/onboarding/types.ts` | Add `McaGettingStartedState` on `McaOnboardingState`. |
| `packages/core/src/modules/merchant_advances/lib/onboarding/state.ts` | Parse/merge/reset tour JSON; re-arm tour on `completeOnboarding`. |
| `packages/core/src/modules/merchant_advances/lib/onboarding/gettingStarted.ts` | Pure helpers: `shouldLaunchGettingStarted`, step catalog, next/prev. |
| `packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/state.test.ts` | Persistence + complete/restart tour tests. |
| `packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts` | Launch rules + step routing tests. |
| `packages/core/src/modules/merchant_advances/data/validators.ts` | Additive `gettingStarted` on `onboardingSaveSchema`. |
| `packages/core/src/modules/merchant_advances/api/onboarding/status/route.ts` | Return tour flags for the chrome. |
| `packages/core/src/modules/merchant_advances/api/getting-started/video/route.ts` | Authenticated MP4 (+ optional VTT as `?kind=captions`). |
| `packages/core/src/modules/merchant_advances/assets/getting-started.mp4` | Compressed in-app clip (≤ 2 MB). |
| `packages/core/src/modules/merchant_advances/assets/getting-started.en.vtt` | Captions. |
| `packages/core/src/modules/merchant_advances/backend/components/McaPageChrome.tsx` | `SetupBanner` + `GettingStartedTour`. |
| `packages/core/src/modules/merchant_advances/backend/components/GettingStartedTour.tsx` | Dialog + spotlight steps + persist. |
| `packages/core/src/modules/merchant_advances/backend/components/OnboardingWizard.tsx` | Redirect `?tour=getting-started`. |
| `packages/core/src/modules/merchant_advances/backend/components/OnboardingSetupPanel.tsx` | Replay tour button. |
| `packages/core/src/modules/merchant_advances/backend/merchant_advances/page.tsx` | Chrome + `data-tour-id="deals-new"`. |
| `packages/core/src/modules/merchant_advances/backend/merchant_advances/pipeline/page.tsx` | Chrome + `data-tour-id="pipeline-board"`. |
| `packages/core/src/modules/merchant_advances/backend/merchant_advances/funders/page.tsx` | Chrome + `data-tour-id="funders-table"`. |
| `packages/core/src/modules/merchant_advances/backend/merchant_advances/[id]/page.tsx` | Chrome + `data-tour-id="match-submit"` on `FunderMatchList`. |
| `packages/core/src/modules/merchant_advances/backend/components/FunderMatchList.tsx` | `data-tour-id="match-submit"` on the submit row. |
| `packages/core/src/modules/merchant_advances/backend/merchant_advances/settings/page.tsx` | Chrome; setup panel already has replay. |
| `packages/core/src/modules/merchant_advances/i18n/en.json` | All user-facing strings. |
| `packages/core/src/modules/merchant_advances/__integration__/TC-MCA-TOUR-001-getting-started.spec.ts` | Playwright: force tour, skip, persist. |

---

## UX (locked)

Sequence after `complete: true`:

1. Redirect to `/backend/merchant_advances?tour=getting-started`.
2. **Welcome dialog** (Amplitude / Upwork): title, 20–40s `<video controls playsInline>` with captions, primary **Show me around**, secondary **Explore on my own**, tertiary **Remind me later**. X / Escape = same as explore (dismiss, persist `dismissedAt`).
3. **Anchored steps** (Upwork / beehiiv): progress `2 of 5`, Back / Next / Skip. Next may `router.push` to the step route, then wait for `[data-tour-id]`.
4. Last step: **Done** persists `completedAt`.
5. **Replay:** Settings → Setup → Launch getting started (`?tour=getting-started` even if dismissed).

Steps:

| id | route | anchor | Teaches |
|----|-------|--------|---------|
| `welcome` | `/backend/merchant_advances` | (dialog) | Video overview |
| `deals-new` | `/backend/merchant_advances` | `deals-new` | New deal |
| `pipeline-board` | `/backend/merchant_advances/pipeline` | `pipeline-board` | Kanban stages |
| `match-submit` | first deal detail if any, else stay on deals empty-state | `match-submit` or `deals-new` | Ranked match; human submit; never auto-submit |
| `funders-table` | `/backend/merchant_advances/funders` | `funders-table` | Funder roster |
| `setup-replay` | `/backend/merchant_advances/settings` | `setup-replay` | Where to replay wizard + tour |

---

### Task 1: Persist getting-started JSON (TDD)

**Files:**
- Modify: `packages/core/src/modules/merchant_advances/lib/onboarding/types.ts`
- Modify: `packages/core/src/modules/merchant_advances/lib/onboarding/state.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/onboarding/gettingStarted.ts`
- Modify: `packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/state.test.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts`

**Interfaces:**
- Consumes: existing `McaOnboardingState`, `createEmptyOnboardingState`, `parseOnboardingState`, `mergeOnboardingState`, `completeOnboarding`, `restartOnboarding`
- Produces: `McaGettingStartedState`, `EMPTY_GETTING_STARTED`, `parseGettingStarted`, `shouldLaunchGettingStarted`, `GETTING_STARTED_STEPS`, `gettingStartedStepByIndex`

- [ ] **Step 1: Write the failing tests**

Append to `state.test.ts`:

```ts
import { EMPTY_GETTING_STARTED } from '../types'
import { shouldLaunchGettingStarted } from '../gettingStarted'

describe('merchant_advances getting started tour state', () => {
  it('re-arms the tour when onboarding completes', () => {
    const started = mergeOnboardingState(createEmptyOnboardingState(), {
      gettingStarted: {
        dismissedAt: '2026-08-01T00:00:00.000Z',
        completedAt: '2026-08-01T00:00:00.000Z',
        currentStep: 3,
      },
    })
    const completed = completeOnboarding(started, new Date('2026-08-31T12:00:00.000Z'))
    expect(completed.completedAt).toBe('2026-08-31T12:00:00.000Z')
    expect(completed.gettingStarted).toEqual(EMPTY_GETTING_STARTED)
  })

  it('round-trips gettingStarted through parseOnboardingState', () => {
    const saved = mergeOnboardingState(createEmptyOnboardingState(), {
      gettingStarted: {
        dismissedAt: null,
        completedAt: null,
        currentStep: 2,
      },
    })
    const reloaded = parseOnboardingState(JSON.parse(JSON.stringify(saved)))
    expect(reloaded.gettingStarted.currentStep).toBe(2)
    expect(reloaded.gettingStarted.dismissedAt).toBeNull()
  })

  it('clears the tour when the wizard is restarted', () => {
    const completed = completeOnboarding(createEmptyOnboardingState(), new Date('2026-08-31T12:00:00.000Z'))
    const dismissed = mergeOnboardingState(completed, {
      gettingStarted: { dismissedAt: '2026-08-31T13:00:00.000Z', completedAt: null, currentStep: 0 },
    })
    const restarted = restartOnboarding(dismissed)
    expect(restarted.completedAt).toBeNull()
    expect(restarted.gettingStarted).toEqual(EMPTY_GETTING_STARTED)
  })
})
```

Create `gettingStarted.test.ts`:

```ts
import { shouldLaunchGettingStarted, GETTING_STARTED_STEPS, gettingStartedStepByIndex } from '../gettingStarted'

describe('shouldLaunchGettingStarted', () => {
  it('does not launch before onboarding is complete', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: null,
      tour: { dismissedAt: null, completedAt: null, currentStep: 0 },
      queryTour: 'getting-started',
    })).toBe(false)
  })

  it('launches once after onboarding when the tour is untouched', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: null, completedAt: null, currentStep: 0 },
      queryTour: null,
    })).toBe(true)
  })

  it('does not auto-launch after dismiss or complete', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: '2026-08-31T13:00:00.000Z', completedAt: null, currentStep: 0 },
      queryTour: null,
    })).toBe(false)
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: null, completedAt: '2026-08-31T13:00:00.000Z', currentStep: 5 },
      queryTour: null,
    })).toBe(false)
  })

  it('relaunches when the query param is present', () => {
    expect(shouldLaunchGettingStarted({
      onboardingCompletedAt: '2026-08-31T12:00:00.000Z',
      tour: { dismissedAt: '2026-08-31T13:00:00.000Z', completedAt: '2026-08-31T13:00:00.000Z', currentStep: 5 },
      queryTour: 'getting-started',
    })).toBe(true)
  })
})

describe('GETTING_STARTED_STEPS', () => {
  it('starts with a dialog step then five anchored steps', () => {
    expect(GETTING_STARTED_STEPS[0]).toMatchObject({ id: 'welcome', kind: 'dialog' })
    expect(GETTING_STARTED_STEPS.map((step) => step.id)).toEqual([
      'welcome',
      'deals-new',
      'pipeline-board',
      'match-submit',
      'funders-table',
      'setup-replay',
    ])
    expect(gettingStartedStepByIndex(0).route).toBe('/backend/merchant_advances')
    expect(gettingStartedStepByIndex(2).route).toBe('/backend/merchant_advances/pipeline')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
yarn workspace @open-mercato/core test -- src/modules/merchant_advances/lib/onboarding/__tests__/state.test.ts src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts
```

Expected: FAIL (`gettingStarted` / `shouldLaunchGettingStarted` not defined).

- [ ] **Step 3: Write minimal implementation**

Add to `types.ts` (after `McaOnboardingFirstDeal`):

```ts
export type McaGettingStartedState = {
  dismissedAt: string | null
  completedAt: string | null
  currentStep: number
}

export const EMPTY_GETTING_STARTED: McaGettingStartedState = {
  dismissedAt: null,
  completedAt: null,
  currentStep: 0,
}
```

Add `gettingStarted: McaGettingStartedState` to `McaOnboardingState`.

Create `gettingStarted.ts`:

```ts
import type { McaGettingStartedState } from './types'

export type GettingStartedStepKind = 'dialog' | 'anchor'

export type GettingStartedStep = {
  id: 'welcome' | 'deals-new' | 'pipeline-board' | 'match-submit' | 'funders-table' | 'setup-replay'
  kind: GettingStartedStepKind
  route: string
  anchorId: string | null
  titleKey: string
  bodyKey: string
}

export const GETTING_STARTED_STEPS: readonly GettingStartedStep[] = [
  {
    id: 'welcome',
    kind: 'dialog',
    route: '/backend/merchant_advances',
    anchorId: null,
    titleKey: 'merchant_advances.tour.welcome.title',
    bodyKey: 'merchant_advances.tour.welcome.body',
  },
  {
    id: 'deals-new',
    kind: 'anchor',
    route: '/backend/merchant_advances',
    anchorId: 'deals-new',
    titleKey: 'merchant_advances.tour.deals.title',
    bodyKey: 'merchant_advances.tour.deals.body',
  },
  {
    id: 'pipeline-board',
    kind: 'anchor',
    route: '/backend/merchant_advances/pipeline',
    anchorId: 'pipeline-board',
    titleKey: 'merchant_advances.tour.pipeline.title',
    bodyKey: 'merchant_advances.tour.pipeline.body',
  },
  {
    id: 'match-submit',
    kind: 'anchor',
    route: '/backend/merchant_advances',
    anchorId: 'match-submit',
    titleKey: 'merchant_advances.tour.match.title',
    bodyKey: 'merchant_advances.tour.match.body',
  },
  {
    id: 'funders-table',
    kind: 'anchor',
    route: '/backend/merchant_advances/funders',
    anchorId: 'funders-table',
    titleKey: 'merchant_advances.tour.funders.title',
    bodyKey: 'merchant_advances.tour.funders.body',
  },
  {
    id: 'setup-replay',
    kind: 'anchor',
    route: '/backend/merchant_advances/settings',
    anchorId: 'setup-replay',
    titleKey: 'merchant_advances.tour.setup.title',
    bodyKey: 'merchant_advances.tour.setup.body',
  },
] as const

export function gettingStartedStepByIndex(index: number): GettingStartedStep {
  const clamped = Math.max(0, Math.min(GETTING_STARTED_STEPS.length - 1, index))
  return GETTING_STARTED_STEPS[clamped]
}

export function shouldLaunchGettingStarted(input: {
  onboardingCompletedAt: string | null
  tour: McaGettingStartedState
  queryTour: string | null
}): boolean {
  if (!input.onboardingCompletedAt) return false
  if (input.queryTour === 'getting-started') return true
  if (input.tour.completedAt || input.tour.dismissedAt) return false
  return true
}
```

In `state.ts`:

- Import `EMPTY_GETTING_STARTED` and `McaGettingStartedState`.
- Add `gettingStarted: { ...EMPTY_GETTING_STARTED }` in `createEmptyOnboardingState`.
- Add:

```ts
export function parseGettingStarted(value: unknown, fallback = EMPTY_GETTING_STARTED): McaGettingStartedState {
  if (!isRecord(value)) return { ...fallback }
  const rawStep = value.currentStep
  const currentStep = typeof rawStep === 'number' && Number.isInteger(rawStep)
    ? Math.max(0, Math.min(20, rawStep))
    : fallback.currentStep
  return {
    dismissedAt: asText(value.dismissedAt, 40),
    completedAt: asText(value.completedAt, 40),
    currentStep,
  }
}
```

- In `parseOnboardingState` return, add `gettingStarted: parseGettingStarted(value.gettingStarted)`.
- In `mergeOnboardingState` return, add:

```ts
gettingStarted: parseGettingStarted(
  (patch as { gettingStarted?: unknown }).gettingStarted ?? current.gettingStarted,
  current.gettingStarted,
),
```

- Change `completeOnboarding` and `restartOnboarding`:

```ts
export function completeOnboarding(state: McaOnboardingState, now = new Date()): McaOnboardingState {
  return {
    ...state,
    completedAt: now.toISOString(),
    step: 'first_deal',
    gettingStarted: { ...EMPTY_GETTING_STARTED },
  }
}

export function restartOnboarding(state: McaOnboardingState): McaOnboardingState {
  return {
    ...state,
    step: 'welcome',
    completedAt: null,
    gettingStarted: { ...EMPTY_GETTING_STARTED },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Same yarn command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/modules/merchant_advances/lib/onboarding
git commit -m "feat(mca): persist getting-started tour on onboarding JSON"
```

---

### Task 2: Save schema + status API

**Files:**
- Modify: `packages/core/src/modules/merchant_advances/data/validators.ts:371-389`
- Modify: `packages/core/src/modules/merchant_advances/api/onboarding/status/route.ts`
- Modify: `packages/core/src/modules/merchant_advances/commands/onboarding.ts` only if merge does not already pick up `gettingStarted` from the parsed input (it will, via `mergeOnboardingState(previous, input)` once the schema allows the field)

**Interfaces:**
- Consumes: `McaGettingStartedState`, `shouldLaunchGettingStarted`
- Produces: `onboardingSaveSchema.gettingStarted`; status `result.gettingStarted`

- [ ] **Step 1: Write a failing validator test**

There is no dedicated validators test file. Add assertions to `gettingStarted.test.ts` instead, importing the schema:

```ts
import { onboardingSaveSchema } from '../../../data/validators'

it('accepts a gettingStarted patch on onboardingSaveSchema', () => {
  const parsed = onboardingSaveSchema.parse({
    organizationId: '018f1a2b-3c4d-4000-8000-000000000001',
    tenantId: '018f1a2b-3c4d-4000-8000-000000000002',
    gettingStarted: { dismissedAt: '2026-08-31T13:00:00.000Z', currentStep: 1 },
  })
  expect(parsed.gettingStarted?.dismissedAt).toBe('2026-08-31T13:00:00.000Z')
  expect(parsed.gettingStarted?.currentStep).toBe(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn workspace @open-mercato/core test -- src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts
```

Expected: FAIL (unrecognized key or `gettingStarted` undefined).

- [ ] **Step 3: Write minimal implementation**

In `onboardingSaveSchema` add:

```ts
gettingStarted: z.object({
  dismissedAt: z.string().max(40).nullable().optional(),
  completedAt: z.string().max(40).nullable().optional(),
  currentStep: z.number().int().min(0).max(20).optional(),
}).optional(),
```

In `status/route.ts` import `shouldLaunchGettingStarted` and extend the JSON result:

```ts
gettingStarted: {
  dismissedAt: state.gettingStarted.dismissedAt,
  completedAt: state.gettingStarted.completedAt,
  currentStep: state.gettingStarted.currentStep,
  shouldLaunch: shouldLaunchGettingStarted({
    onboardingCompletedAt: state.completedAt,
    tour: state.gettingStarted,
    queryTour: null,
  }),
},
```

Client still ORs `?tour=getting-started` locally; status `shouldLaunch` is the auto-open flag without the query.

- [ ] **Step 4: Run tests**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/modules/merchant_advances/data/validators.ts packages/core/src/modules/merchant_advances/api/onboarding/status/route.ts packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts
git commit -m "feat(mca): accept getting-started patches on onboarding save"
```

---

### Task 3: i18n + authenticated video route

**Files:**
- Modify: `packages/core/src/modules/merchant_advances/i18n/en.json`
- Create: `packages/core/src/modules/merchant_advances/api/getting-started/video/route.ts`
- Create: `packages/core/src/modules/merchant_advances/assets/getting-started.en.vtt`
- Create: `packages/core/src/modules/merchant_advances/assets/getting-started.mp4` (Task 7 encodes the real clip; this task may land a tiny placeholder so the route is testable)

**Interfaces:**
- Consumes: `merchant_advances.deal.view`
- Produces: `GET /api/merchant_advances/getting-started/video` (`video/mp4`) and `?kind=captions` (`text/vtt`)

- [ ] **Step 1: Add locale keys**

Append to `en.json` (values are the source of truth; no hardcoded UI strings):

```json
  "merchant_advances.tour.welcome.title": "Your shop is ready",
  "merchant_advances.tour.welcome.body": "Watch this short walkthrough, then we will point at the buttons you will use every day.",
  "merchant_advances.tour.welcome.start": "Show me around",
  "merchant_advances.tour.welcome.explore": "Explore on my own",
  "merchant_advances.tour.welcome.later": "Remind me later",
  "merchant_advances.tour.welcome.videoLabel": "Getting started with MCA deals",
  "merchant_advances.tour.deals.title": "Start from Deals",
  "merchant_advances.tour.deals.body": "New applications land in this list. Use New deal for a manual file.",
  "merchant_advances.tour.pipeline.title": "Move the file on the board",
  "merchant_advances.tour.pipeline.body": "Pipeline is the same deals in stages. Drag only when the file actually moved.",
  "merchant_advances.tour.match.title": "Match, then you submit",
  "merchant_advances.tour.match.body": "Open a deal, pick funders from the ranked list, then submit. The app never sends a file on its own.",
  "merchant_advances.tour.funders.title": "Keep the roster honest",
  "merchant_advances.tour.funders.body": "Funders is the list the matcher uses. Add, edit, or retire shops here.",
  "merchant_advances.tour.setup.title": "Replay anytime",
  "merchant_advances.tour.setup.body": "Settings → Setup reopens shop setup and this tour.",
  "merchant_advances.tour.progress": "{current} of {total}",
  "merchant_advances.tour.next": "Next",
  "merchant_advances.tour.back": "Back",
  "merchant_advances.tour.skip": "Skip tour",
  "merchant_advances.tour.done": "Done",
  "merchant_advances.tour.replay": "Launch getting started",
  "merchant_advances.tour.replayFlash": "Getting started tour opened.",
  "merchant_advances.errors.tourSaveFailed": "Failed to save getting started progress."
```

- [ ] **Step 2: Write the video route**

```ts
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['merchant_advances.deal.view'] },
}

const ASSETS = path.join(
  process.cwd(),
  'packages/core/src/modules/merchant_advances/assets',
)

function assetPath(kind: string | null): { file: string; type: string } {
  if (kind === 'captions') {
    return { file: path.join(ASSETS, 'getting-started.en.vtt'), type: 'text/vtt; charset=utf-8' }
  }
  return { file: path.join(ASSETS, 'getting-started.mp4'), type: 'video/mp4' }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { file, type } = assetPath(url.searchParams.get('kind'))
  if (!existsSync(file)) {
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('merchant_advances.errors.tourSaveFailed', 'Getting started media is missing.') },
      { status: 404 },
    )
  }
  const info = await stat(file)
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      'content-type': type,
      'content-length': String(info.size),
      'cache-control': 'private, max-age=3600',
    },
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Merchant Advances',
  summary: 'MCA getting-started media',
  methods: {
    GET: {
      summary: 'Stream the getting-started video or captions',
      responses: [{ status: 200, description: 'MP4 or VTT.' }],
    },
  },
}
```

Captions file `getting-started.en.vtt`:

```text
WEBVTT

00:00:00.000 --> 00:00:08.000
Deals is the inbox. New applications land here from intake, import, or New deal.

00:00:08.000 --> 00:00:16.000
Open a file, pick funders from the ranked match, then submit. The app never auto-submits.

00:00:16.000 --> 00:00:24.000
Pipeline is the same files in stages. Funders is the roster the matcher uses.

00:00:24.000 --> 00:00:32.000
Settings → Setup replays shop setup and this tour.
```

If `getting-started.mp4` is not encoded yet, generate a silent placeholder (≤ 200 KB) so the route is not 404:

```bash
ffmpeg -y -f lavfi -i color=c=0x111827:s=1280x720:d=8 -f lavfi -i anullsrc=r=44100:cl=stereo \
  -vf "drawtext=text='MCA getting started':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart \
  packages/core/src/modules/merchant_advances/assets/getting-started.mp4
```

Replace that placeholder in Task 7 with the compressed walkthrough.

- [ ] **Step 3: `yarn generate`** if the generator does not auto-pick new `api/` files on next boot — new `api/getting-started/video/route.ts` is auto-discovered; run generate when the app registry is stale.

```bash
yarn generate
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/modules/merchant_advances/i18n/en.json \
  packages/core/src/modules/merchant_advances/api/getting-started \
  packages/core/src/modules/merchant_advances/assets
git commit -m "feat(mca): add getting-started copy and authenticated video route"
```

---

### Task 4: Tour host UI (dialog + spotlight)

**Files:**
- Create: `packages/core/src/modules/merchant_advances/backend/components/GettingStartedTour.tsx`
- Create: `packages/core/src/modules/merchant_advances/backend/components/McaPageChrome.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/components/SetupBanner.tsx` (keep as-is; chrome composes it)

**Interfaces:**
- Consumes: `GET /api/merchant_advances/onboarding/status`, `PUT /api/merchant_advances/onboarding` with `{ gettingStarted }`, `GETTING_STARTED_STEPS`, `shouldLaunchGettingStarted`
- Produces: `GettingStartedTour`, `McaPageChrome`

- [ ] **Step 1: Implement `McaPageChrome`**

```tsx
"use client"

import * as React from 'react'
import { SetupBanner } from './SetupBanner'
import { GettingStartedTour } from './GettingStartedTour'

export function McaPageChrome() {
  return (
    <>
      <SetupBanner />
      <GettingStartedTour />
    </>
  )
}
```

- [ ] **Step 2: Implement `GettingStartedTour`**

Full component (no placeholders). Persist with `useGuardedMutation` + `readApiResultOrThrow`. Strip `tour` from the URL after launch so refresh does not loop-replay unless the user hits Replay.

```tsx
"use client"

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  GETTING_STARTED_STEPS,
  gettingStartedStepByIndex,
  shouldLaunchGettingStarted,
} from '../../lib/onboarding/gettingStarted'
import type { McaGettingStartedState } from '../../lib/onboarding/types'

type StatusResult = {
  completedAt?: string | null
  gettingStarted?: McaGettingStartedState & { shouldLaunch?: boolean }
}

function useAnchorRect(anchorId: string | null, active: boolean): DOMRect | null {
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  React.useLayoutEffect(() => {
    if (!active || !anchorId) {
      setRect(null)
      return
    }
    const node = document.querySelector(`[data-tour-id="${anchorId}"]`)
    if (!(node instanceof HTMLElement)) {
      setRect(null)
      return
    }
    const update = () => setRect(node.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorId, active])
  return rect
}

export function GettingStartedTour() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryTour = searchParams.get('tour')
  const [open, setOpen] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [onboardingCompletedAt, setOnboardingCompletedAt] = React.useState<string | null>(null)
  const [tour, setTour] = React.useState<McaGettingStartedState>({
    dismissedAt: null,
    completedAt: null,
    currentStep: 0,
  })
  const { runMutation, retryLastMutation } = useGuardedMutation({
    contextId: 'merchant-advances-tour',
    blockedMessage: t('merchant_advances.errors.saveBlocked'),
  })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const body = await readApiResultOrThrow<{ result?: StatusResult } & StatusResult>(
          '/api/merchant_advances/onboarding/status',
        )
        const result = body.result ?? body
        if (cancelled) return
        const nextTour = {
          dismissedAt: result.gettingStarted?.dismissedAt ?? null,
          completedAt: result.gettingStarted?.completedAt ?? null,
          currentStep: result.gettingStarted?.currentStep ?? 0,
        }
        setOnboardingCompletedAt(result.completedAt ?? null)
        setTour(nextTour)
        const launch = shouldLaunchGettingStarted({
          onboardingCompletedAt: result.completedAt ?? null,
          tour: nextTour,
          queryTour,
        })
        setOpen(launch)
        if (launch) setStepIndex(queryTour === 'getting-started' ? 0 : nextTour.currentStep)
      } catch {
        if (!cancelled) setOpen(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [queryTour])

  const persist = React.useCallback(async (next: McaGettingStartedState) => {
    setTour(next)
    await runMutation({
      operation: () => readApiResultOrThrow('/api/merchant_advances/onboarding', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gettingStarted: next }),
      }),
      context: {
        formId: 'merchant-advances-tour',
        resourceKind: 'merchant_advances.onboarding',
        retryLastMutation,
      },
      mutationPayload: next,
    })
  }, [retryLastMutation, runMutation])

  const clearQuery = React.useCallback(() => {
    if (queryTour !== 'getting-started') return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tour')
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname)
  }, [pathname, queryTour, router, searchParams])

  const dismiss = async (completed: boolean) => {
    const now = new Date().toISOString()
    setOpen(false)
    clearQuery()
    await persist({
      dismissedAt: completed ? tour.dismissedAt : now,
      completedAt: completed ? now : tour.completedAt,
      currentStep: completed ? GETTING_STARTED_STEPS.length - 1 : stepIndex,
    })
  }

  const go = async (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(GETTING_STARTED_STEPS.length - 1, nextIndex))
    const step = gettingStartedStepByIndex(clamped)
    setStepIndex(clamped)
    await persist({ ...tour, currentStep: clamped, dismissedAt: null, completedAt: null })
    if (step.route !== pathname) router.push(`${step.route}?tour=getting-started`)
  }

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!open) return
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (stepIndex === 0) void go(1)
        else if (stepIndex >= GETTING_STARTED_STEPS.length - 1) void dismiss(true)
        else void go(stepIndex + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stepIndex])

  const step = gettingStartedStepByIndex(stepIndex)
  const rect = useAnchorRect(step.anchorId, open && step.kind === 'anchor')
  if (!open || !onboardingCompletedAt) return null

  if (step.kind === 'dialog') {
    return (
      <Dialog open onOpenChange={(next) => { if (!next) void dismiss(false) }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t(step.titleKey)}</DialogTitle>
            <DialogDescription>{t(step.bodyKey)}</DialogDescription>
          </DialogHeader>
          <video
            className="w-full rounded-md border border-border bg-muted"
            controls
            playsInline
            preload="metadata"
            aria-label={t('merchant_advances.tour.welcome.videoLabel')}
          >
            <source src="/api/merchant_advances/getting-started/video" type="video/mp4" />
            <track
              kind="captions"
              srcLang="en"
              label="English"
              src="/api/merchant_advances/getting-started/video?kind=captions"
              default
            />
          </video>
          <DialogFooter layout="equal">
            <Button type="button" variant="secondary" onClick={() => void dismiss(false)}>
              {t('merchant_advances.tour.welcome.explore')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void dismiss(false)}>
              {t('merchant_advances.tour.welcome.later')}
            </Button>
            <Button type="button" onClick={() => void go(1)}>
              {t('merchant_advances.tour.welcome.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-modal bg-black/50" aria-hidden />
      {rect ? (
        <div
          className="pointer-events-none fixed z-modal-elevated rounded-md ring-2 ring-primary"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : null}
      <div
        role="dialog"
        aria-labelledby="mca-tour-title"
        className="fixed z-modal-elevated w-80 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md"
        style={{
          top: rect ? Math.min(rect.bottom + 8, window.innerHeight - 220) : 96,
          left: rect ? Math.min(Math.max(16, rect.left), window.innerWidth - 336) : 16,
        }}
      >
        <p className="text-xs text-muted-foreground">
          {t('merchant_advances.tour.progress', {
            current: String(stepIndex),
            total: String(GETTING_STARTED_STEPS.length - 1),
          })}
        </p>
        <h2 id="mca-tour-title" className="mt-1 text-sm font-medium">{t(step.titleKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(step.bodyKey)}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => void dismiss(false)}>
            {t('merchant_advances.tour.skip')}
          </Button>
          {stepIndex > 1 ? (
            <Button type="button" variant="secondary" onClick={() => void go(stepIndex - 1)}>
              {t('merchant_advances.tour.back')}
            </Button>
          ) : null}
          {stepIndex >= GETTING_STARTED_STEPS.length - 1 ? (
            <Button type="button" onClick={() => void dismiss(true)}>
              {t('merchant_advances.tour.done')}
            </Button>
          ) : (
            <Button type="button" onClick={() => void go(stepIndex + 1)}>
              {t('merchant_advances.tour.next')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
```

If `match-submit` has no DOM node (no deal open), fall back: `GettingStartedTour` already renders the card at `top: 96` when `rect` is null; Task 5 puts `data-tour-id="match-submit"` on the deal match toolbar **and** on the deals empty-state create button as `data-tour-id="deals-new"` only. For the match step when pathname is deals list, change `gettingStarted.ts` `match-submit.anchorId` resolution in the component:

```ts
const anchorId = step.id === 'match-submit'
  ? (document.querySelector('[data-tour-id="match-submit"]') ? 'match-submit' : 'deals-new')
  : step.anchorId
```

Wire that inside `useAnchorRect` by passing the resolved id.

- [ ] **Step 3: Typecheck the new files**

```bash
yarn workspace @open-mercato/core exec tsc --noEmit --pretty false
```

If the package has no isolated tsc, run `yarn typecheck` from the repo (slow). Expected: no errors in the new components.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/modules/merchant_advances/backend/components/GettingStartedTour.tsx \
  packages/core/src/modules/merchant_advances/backend/components/McaPageChrome.tsx
git commit -m "feat(mca): add getting-started dialog and spotlight tour host"
```

---

### Task 5: Anchors, chrome, wizard redirect

**Files:**
- Modify: `packages/core/src/modules/merchant_advances/backend/components/OnboardingWizard.tsx` (both `router.push('/backend/merchant_advances')` → `router.push('/backend/merchant_advances?tour=getting-started')`)
- Modify: `packages/core/src/modules/merchant_advances/backend/merchant_advances/page.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/merchant_advances/pipeline/page.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/merchant_advances/funders/page.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/merchant_advances/settings/page.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/merchant_advances/[id]/page.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/components/FunderMatchList.tsx`
- Modify: `packages/core/src/modules/merchant_advances/backend/components/OnboardingSetupPanel.tsx`

**Interfaces:**
- Consumes: `McaPageChrome`, `data-tour-id` contract from Task 1 catalog
- Produces: finish → tour query; replay button

- [ ] **Step 1: Wizard redirect**

Replace both finish/skip-complete pushes:

```ts
.then(() => router.push('/backend/merchant_advances?tour=getting-started'))
```

- [ ] **Step 2: Deals page**

Replace `<SetupBanner />` with `<McaPageChrome />`. On the New deal toolbar button:

```tsx
<Button asChild>
  <Link href="/backend/merchant_advances/create" data-tour-id="deals-new">
    <Plus className="size-4" />
    {t('merchant_advances.deals.create')}
  </Link>
</Button>
```

Also set `data-tour-id="deals-new"` on `ListEmptyState` by wrapping createHref usage — `ListEmptyState` may not forward data attributes. If it does not, keep the toolbar button as the only anchor (empty state still has the toolbar when DataTable renders it).

- [ ] **Step 3: Pipeline**

Replace `<SetupBanner />` with `<McaPageChrome />`. Wrap `DealKanban`:

```tsx
<div data-tour-id="pipeline-board">
  <DealKanban deals={rows} loading={loading} onMove={onMove} />
</div>
```

- [ ] **Step 4: Funders**

Import chrome. Wrap `DataTable` in `<div data-tour-id="funders-table">`.

- [ ] **Step 5: Deal detail + match list**

On `FunderMatchList` outer `div.flex.flex-col.gap-4` add `data-tour-id="match-submit"`. Also add it on the empty-state wrapper so the step has a target before matches exist.

On `[id]/page.tsx` add `<McaPageChrome />` at the top of `PageBody`.

- [ ] **Step 6: Settings replay**

On `OnboardingSetupPanel` add `data-tour-id="setup-replay"` on the section, plus:

```tsx
<Button
  type="button"
  variant="outline"
  onClick={() => router.push('/backend/merchant_advances?tour=getting-started')}
>
  {t('merchant_advances.tour.replay')}
</Button>
```

Settings page: add `<McaPageChrome />` at the top of `PageBody`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/modules/merchant_advances/backend
git commit -m "feat(mca): wire getting-started anchors and post-onboarding redirect"
```

---

### Task 6: Playwright coverage

**Files:**
- Create: `packages/core/src/modules/merchant_advances/__integration__/TC-MCA-TOUR-001-getting-started.spec.ts`

**Interfaces:**
- Consumes: `login`, `getAuthToken`, `apiRequest`, status + save APIs
- Produces: skip persistence proof without leaving the shared tenant stuck in the wizard

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import { login } from '@open-mercato/core/helpers/integration/auth'

type StatusBody = {
  result?: {
    completedAt?: string | null
    gettingStarted?: { dismissedAt?: string | null; completedAt?: string | null }
  }
}

test.describe('TC-MCA-TOUR-001: getting started tour', () => {
  test('opens from query param after onboarding and skip persists', async ({ page, request }) => {
    test.slow()
    const token = await getAuthToken(request, 'admin')
    const statusRes = await apiRequest(request, 'GET', '/api/merchant_advances/onboarding/status', { token })
    expect(statusRes.ok()).toBeTruthy()
    const status = await statusRes.json() as StatusBody
    const completedAt = status.result?.completedAt ?? null
    test.skip(!completedAt, 'workspace onboarding is still incomplete; do not complete it from this spec')

    const previous = status.result?.gettingStarted ?? null
    try {
      await apiRequest(request, 'PUT', '/api/merchant_advances/onboarding', {
        token,
        data: { gettingStarted: { dismissedAt: null, completedAt: null, currentStep: 0 } },
      })
      await login(page, 'admin')
      await page.goto('/backend/merchant_advances?tour=getting-started')
      await expect(page.getByRole('dialog')).toContainText('Your shop is ready')
      await page.getByRole('button', { name: 'Explore on my own' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.goto('/backend/merchant_advances')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } finally {
      if (previous) {
        await apiRequest(request, 'PUT', '/api/merchant_advances/onboarding', {
          token,
          data: { gettingStarted: previous },
        })
      }
    }
  })
})
```

The dialog title comes from i18n English default; if the test locale is not `en`, assert `getByRole('dialog')` plus the video `aria-label` key rendered text `Getting started with MCA deals`.

- [ ] **Step 2: Run only if an integration server is up**

```bash
yarn test:integration -- merchant_advances/__integration__/TC-MCA-TOUR-001-getting-started.spec.ts
```

Expected: PASS when `completedAt` is set; skipped (not failed) when the workspace is still in the wizard.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/modules/merchant_advances/__integration__/TC-MCA-TOUR-001-getting-started.spec.ts
git commit -m "test(mca): cover getting-started tour skip persistence"
```

---

### Task 7: Encode the in-app video from the walkthrough capture

**Files:**
- Replace: `packages/core/src/modules/merchant_advances/assets/getting-started.mp4`
- Modify: `packages/core/src/modules/merchant_advances/assets/getting-started.en.vtt` if timings change

**Interfaces:**
- Consumes: screen capture artifact (this planning session records a walkthrough; do **not** git-add the raw capture)
- Produces: H.264 AAC MP4 ≤ 2 MB, 1280×720 or 960×540, +faststart

Recorded walkthrough (planning session, not git): `/opt/cursor/artifacts/mca-getting-started-walkthrough.mp4`. Script covered login → shop setup (not finished) → Pipeline → Funders → New deal form (not submitted) → Settings/Setup → back to wizard. Sidebar “Deals” currently opens `customers` deals; the MCA list is `/backend/merchant_advances` and is gated to the wizard until `completedAt` is set.

- [ ] **Step 1: Compress**

```bash
ffmpeg -y -i /opt/cursor/artifacts/mca-getting-started-walkthrough.mp4 \
  -vf "scale=1280:-2" -c:v libx264 -crf 28 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 64k -ac 1 -movflags +faststart \
  packages/core/src/modules/merchant_advances/assets/getting-started.mp4
ls -lh packages/core/src/modules/merchant_advances/assets/getting-started.mp4
```

If the file is still > 2 MB, raise CRF to 32 or cut to the 30s script: Deals list → New deal → Pipeline → open a deal match → Funders → Settings Setup.

Do **not** complete shop setup on the shared Railway tenant while recording.

- [ ] **Step 2: Commit only the compressed asset**

```bash
git add packages/core/src/modules/merchant_advances/assets/getting-started.mp4 \
  packages/core/src/modules/merchant_advances/assets/getting-started.en.vtt
git commit -m "feat(mca): add compressed getting-started walkthrough video"
```

---

## Validation (after all tasks)

Runner: **local** (`yarn …`) unless a compose `app` container is running, then `node scripts/docker-exec.mjs …`.

```bash
yarn workspace @open-mercato/core test -- src/modules/merchant_advances/lib/onboarding/__tests__/state.test.ts src/modules/merchant_advances/lib/onboarding/__tests__/gettingStarted.test.ts
yarn lint
yarn typecheck
```

Manual: complete wizard on a **throwaway** workspace → dialog with video → Show me around → five anchors → Skip/Done persists → Settings → Launch getting started replays. Cmd/Enter on the dialog starts the tour; Escape dismisses.

---

## Out of scope

- Per-user (vs per-workspace) tour state. v1 is workspace JSON; first admin who finishes setup sees it; replay is available to anyone with settings.
- Multi-locale captions beyond `en.vtt`.
- driver.js / Shepherd.
- Completing onboarding on the public Railway demo.
- Live funder APIs, S3-hosted video, Stripe.
