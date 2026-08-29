import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { CacheStrategy } from '@open-mercato/cache'
import type { IntakeCommandInput } from '../../data/validators'
import type { IntakeCommandResult } from '../../commands/intake'
import { loadIntakeWorkspaceConfig } from '../../commands/settings'
import { issueUploadToken, persistUploadTokenHash } from './uploadLinks'
import { tryResolve } from './tryResolve'

export type IntakeExecutionResult = IntakeCommandResult & {
  uploadToken: string | null
  uploadExpiresAt: string | null
}

export async function executeDealIntake(input: {
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  commandInput: IntakeCommandInput
}): Promise<IntakeExecutionResult> {
  const { result } = await input.commandBus.execute<IntakeCommandInput, IntakeCommandResult>(
    'merchant_advances.deal.intake',
    { input: input.commandInput, ctx: input.ctx },
  )
  const config = await loadIntakeWorkspaceConfig(input.ctx.container, {
    tenantId: input.commandInput.tenantId,
    organizationId: input.commandInput.organizationId,
  })
  if (!config.uploadLinksEnabled) {
    return { ...result, uploadToken: null, uploadExpiresAt: null }
  }
  const issued = issueUploadToken({
    dealId: result.dealId,
    tenantId: input.commandInput.tenantId,
    organizationId: input.commandInput.organizationId,
    classification: 'statement',
    ttlHours: config.uploadLinkTtlHours,
  })
  const cache = tryResolve<CacheStrategy>(input.ctx.container, 'cache')
  await persistUploadTokenHash(cache ?? null, issued)
  return {
    ...result,
    uploadToken: issued.token,
    uploadExpiresAt: issued.expiresAt.toISOString(),
  }
}
