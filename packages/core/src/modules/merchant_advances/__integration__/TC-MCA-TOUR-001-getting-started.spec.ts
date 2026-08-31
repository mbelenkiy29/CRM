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
