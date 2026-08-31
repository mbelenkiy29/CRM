"use client"

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import {
  buildOptimisticLockHeader,
  extractOptimisticLockConflict,
  extractRecordLockConflict,
} from '@open-mercato/ui/backend/utils/optimisticLock'
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
  canAdminister?: boolean
  completedAt?: string | null
  gettingStarted?: McaGettingStartedState & { shouldLaunch?: boolean }
  updatedAt?: string | null
}

type PersistResult = {
  result?: { updatedAt?: string | null }
  updatedAt?: string | null
}

async function loadStatus(): Promise<StatusResult> {
  const body = await readApiResultOrThrow<{ result?: StatusResult } & StatusResult>(
    '/api/merchant_advances/onboarding/status',
  )
  return body.result ?? body
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
  const [canAdminister, setCanAdminister] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [onboardingCompletedAt, setOnboardingCompletedAt] = React.useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null)
  const busyRef = React.useRef(false)
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
        const result = await loadStatus()
        if (cancelled) return
        const isAdmin = result.canAdminister === true
        const nextTour = {
          dismissedAt: result.gettingStarted?.dismissedAt ?? null,
          completedAt: result.gettingStarted?.completedAt ?? null,
          currentStep: result.gettingStarted?.currentStep ?? 0,
        }
        setCanAdminister(isAdmin)
        setOnboardingCompletedAt(result.completedAt ?? null)
        setUpdatedAt(typeof result.updatedAt === 'string' ? result.updatedAt : null)
        setTour(nextTour)
        const launch = isAdmin
          && shouldLaunchGettingStarted({
            onboardingCompletedAt: result.completedAt ?? null,
            tour: nextTour,
            queryTour,
          })
        setOpen(launch)
        if (launch) {
          setStepIndex(queryTour === 'getting-started' ? 0 : nextTour.currentStep)
          if (queryTour !== 'getting-started') {
            const resumedStep = gettingStartedStepByIndex(nextTour.currentStep)
            if (resumedStep.route !== pathname) {
              router.push(resumedStep.route)
            }
          }
        }
      } catch {
        if (!cancelled) {
          setCanAdminister(false)
          setOpen(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, queryTour, router])

  const persist = React.useCallback(async (next: McaGettingStartedState) => {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    try {
      const body = await runMutation({
        operation: () => withScopedApiRequestHeaders(
          buildOptimisticLockHeader(updatedAt),
          () => readApiResultOrThrow<PersistResult>('/api/merchant_advances/onboarding', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ gettingStarted: next }),
          }),
        ),
        context: {
          formId: 'merchant-advances-tour',
          resourceKind: 'merchant_advances.onboarding',
          retryLastMutation,
        },
        mutationPayload: next,
      })
      const persistedUpdatedAt = body.result?.updatedAt ?? body.updatedAt
      if (typeof persistedUpdatedAt === 'string') {
        setUpdatedAt(persistedUpdatedAt)
      } else {
        const status = await loadStatus()
        setUpdatedAt(typeof status.updatedAt === 'string' ? status.updatedAt : null)
      }
      setTour(next)
      return true
    } catch (err) {
      setOpen(true)
      if (extractOptimisticLockConflict(err) || extractRecordLockConflict(err)) {
        throw err
      }
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [retryLastMutation, runMutation, updatedAt])

  const clearQuery = React.useCallback(() => {
    if (queryTour !== 'getting-started') return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tour')
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname)
  }, [pathname, queryTour, router, searchParams])

  const dismiss = React.useCallback(async (completed: boolean) => {
    const now = new Date().toISOString()
    try {
      const persisted = await persist({
        dismissedAt: completed ? tour.dismissedAt : now,
        completedAt: completed ? now : tour.completedAt,
        currentStep: completed ? GETTING_STARTED_STEPS.length - 1 : stepIndex,
      })
      if (!persisted) {
        flash(t('merchant_advances.errors.tourSaveFailed'), 'error')
        return
      }
      clearQuery()
      setOpen(false)
    } catch {
      setOpen(true)
    }
  }, [clearQuery, persist, stepIndex, t, tour])

  const go = React.useCallback(async (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(GETTING_STARTED_STEPS.length - 1, nextIndex))
    const step = gettingStartedStepByIndex(clamped)
    try {
      const persisted = await persist({ ...tour, currentStep: clamped, dismissedAt: null, completedAt: null })
      if (!persisted) {
        flash(t('merchant_advances.errors.tourSaveFailed'), 'error')
        return
      }
      setStepIndex(clamped)
      if (step.route !== pathname) {
        router.push(step.route)
      } else {
        clearQuery()
      }
    } catch {
      setOpen(true)
    }
  }, [clearQuery, pathname, persist, router, t, tour])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!open || busy) return
      if (event.key === 'Escape' && gettingStartedStepByIndex(stepIndex).kind === 'anchor') {
        event.preventDefault()
        void dismiss(false)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (stepIndex === 0) void go(1)
        else if (stepIndex >= GETTING_STARTED_STEPS.length - 1) void dismiss(true)
        else void go(stepIndex + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, dismiss, go, open, stepIndex])

  const step = gettingStartedStepByIndex(stepIndex)
  const anchorId = step.id === 'match-submit' && typeof document !== 'undefined'
    ? (document.querySelector('[data-tour-id="match-submit"]') ? 'match-submit' : 'deals-new')
    : step.anchorId
  const rect = useAnchorRect(anchorId, open && step.kind === 'anchor')

  if (!canAdminister || !open || !onboardingCompletedAt) return null

  if (step.kind === 'dialog') {
    return (
      <Dialog open onOpenChange={(next) => { if (!next && !busy) void dismiss(false) }}>
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
              label={t('merchant_advances.tour.welcome.captions')}
              src="/api/merchant_advances/getting-started/video?kind=captions"
              default
            />
          </video>
          <DialogFooter layout="equal">
            <Button type="button" variant="secondary" onClick={() => void dismiss(false)} disabled={busy}>
              {t('merchant_advances.tour.welcome.explore')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void dismiss(false)} disabled={busy}>
              {t('merchant_advances.tour.welcome.later')}
            </Button>
            <Button type="button" onClick={() => void go(1)} disabled={busy}>
              {t('merchant_advances.tour.welcome.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-modal bg-black/50 backdrop-blur-sm" aria-hidden />
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
          <Button type="button" variant="ghost" onClick={() => void dismiss(false)} disabled={busy}>
            {t('merchant_advances.tour.skip')}
          </Button>
          {stepIndex > 1 ? (
            <Button type="button" variant="secondary" onClick={() => void go(stepIndex - 1)} disabled={busy}>
              {t('merchant_advances.tour.back')}
            </Button>
          ) : null}
          {stepIndex >= GETTING_STARTED_STEPS.length - 1 ? (
            <Button type="button" onClick={() => void dismiss(true)} disabled={busy}>
              {t('merchant_advances.tour.done')}
            </Button>
          ) : (
            <Button type="button" onClick={() => void go(stepIndex + 1)} disabled={busy}>
              {t('merchant_advances.tour.next')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
