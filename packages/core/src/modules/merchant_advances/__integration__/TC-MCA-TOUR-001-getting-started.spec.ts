import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import { login } from '@open-mercato/core/helpers/integration/auth'
import { OPTIMISTIC_LOCK_HEADER_NAME } from '@open-mercato/shared/lib/crud/optimistic-lock-headers'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'

type StatusBody = {
  result?: {
    completedAt?: string | null
    gettingStarted?: {
      dismissedAt?: string | null
      completedAt?: string | null
      currentStep?: number
    }
    updatedAt?: string | null
  }
}

function optimisticLockHeaders(updatedAt: string | null | undefined): Record<string, string> {
  const headers = buildOptimisticLockHeader(updatedAt)
  const expectedUpdatedAt = headers[OPTIMISTIC_LOCK_HEADER_NAME]
  return expectedUpdatedAt ? { [OPTIMISTIC_LOCK_HEADER_NAME]: expectedUpdatedAt } : {}
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

    const previous = status.result?.gettingStarted
      ? {
          dismissedAt: status.result.gettingStarted.dismissedAt ?? null,
          completedAt: status.result.gettingStarted.completedAt ?? null,
          currentStep: status.result.gettingStarted.currentStep ?? 0,
        }
      : null
    try {
      const resetRes = await apiRequest(request, 'PUT', '/api/merchant_advances/onboarding', {
        token,
        headers: optimisticLockHeaders(status.result?.updatedAt),
        data: { gettingStarted: { dismissedAt: null, completedAt: null, currentStep: 0 } },
      })
      expect(resetRes.ok()).toBeTruthy()
      await login(page, 'admin')
      await page.goto('/backend/merchant_advances?tour=getting-started')
      await expect(page.getByRole('dialog')).toContainText('Your shop is ready')
      await page.getByRole('button', { name: 'Explore on my own' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.goto('/backend/merchant_advances')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } finally {
      if (previous) {
        const currentStatusRes = await apiRequest(
          request,
          'GET',
          '/api/merchant_advances/onboarding/status',
          { token },
        )
        expect(currentStatusRes.ok()).toBeTruthy()
        const currentStatus = await currentStatusRes.json() as StatusBody
        const restoreRes = await apiRequest(request, 'PUT', '/api/merchant_advances/onboarding', {
          token,
          headers: optimisticLockHeaders(currentStatus.result?.updatedAt),
          data: { gettingStarted: previous },
        })
        expect(restoreRes.ok()).toBeTruthy()
      }
    }
  })
})
