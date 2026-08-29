import { randomUUID } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  McaDeal,
  McaDocument,
  McaImportJob,
  McaImportMapping,
  McaLeadBatch,
  McaLeadSource,
  McaWorkspaceSettings,
} from '../../data/entities'
import { toNullableDecimal, toNullableText } from '../crudScope'
import { commitReviewedImport } from './commitImport'
import type {
  ColumnMap,
  CommitReviewedImportInput,
  CommitReviewedImportResult,
  ImportPersistence,
  ImportPersistenceDealInput,
} from './types'

export function createEntityImportPersistence(
  em: EntityManager,
  scope: { organizationId: string; tenantId: string },
): ImportPersistence {
  return {
    async createLeadSource(name) {
      const row = em.create(McaLeadSource, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name,
        isActive: true,
      })
      em.persist(row)
      await em.flush()
      return { id: row.id }
    },
    async createLeadBatch(input) {
      const row = em.create(McaLeadBatch, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: input.name,
        leadSourceId: input.leadSourceId,
        importJobId: input.importJobId,
        leadCount: input.leadCount,
        purchasedAt: new Date(),
      })
      em.persist(row)
      await em.flush()
      return { id: row.id }
    },
    async saveMapping(providerName, columnMap) {
      const existing = await em.findOne(McaImportMapping, {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        providerName,
        deletedAt: null,
      })
      if (existing) {
        existing.columnMap = columnMap as Record<string, unknown>
        em.persist(existing)
        await em.flush()
        return { id: existing.id }
      }
      const row = em.create(McaImportMapping, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        providerName,
        columnMap: columnMap as Record<string, unknown>,
      })
      em.persist(row)
      await em.flush()
      return { id: row.id }
    },
    async createImportJob(input) {
      const row = em.create(McaImportJob, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        source: input.source,
        status: input.status,
        dealCount: input.dealCount,
        failureCount: input.failureCount,
        columnMap: input.columnMap as Record<string, unknown>,
      })
      em.persist(row)
      await em.flush()
      return { id: row.id }
    },
    async completeImportJob(id, input) {
      const row = await em.findOne(McaImportJob, {
        id,
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        deletedAt: null,
      })
      if (!row) throw new Error('[internal] import job not found after create')
      row.status = input.status
      row.dealCount = input.dealCount
      row.failureCount = input.failureCount
      em.persist(row)
      await em.flush()
    },
    async createDeal(input: ImportPersistenceDealInput) {
      const row = em.create(McaDeal, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        businessName: input.businessName ?? '',
        merchantNameSnapshot: toNullableText(input.merchantNameSnapshot),
        merchantStateSnapshot: toNullableText(input.merchantStateSnapshot),
        ownerUserId: input.ownerUserId,
        pipelineStatus: 'new_app',
        requestedAmount: toNullableDecimal(input.requestedAmount),
        avgMonthlyRevenue: toNullableDecimal(input.avgMonthlyRevenue),
        timeInBusinessMonths: input.timeInBusinessMonths,
        position: input.position,
        industry: toNullableText(input.industry),
        state: toNullableText(input.state),
        ein: toNullableText(input.ein),
        legalAddress: toNullableText(input.legalAddress),
        startDate: input.startDate ? new Date(input.startDate) : null,
        leadSourceId: input.leadSourceId,
        leadBatchId: input.leadBatchId,
        assignmentMethod: input.assignmentMethod,
      })
      em.persist(row)
      await em.flush()
      return { id: row.id }
    },
    async createDocument(input) {
      const row = em.create(McaDocument, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        dealId: input.dealId,
        classification: input.classification,
        attachmentId: input.attachmentId,
        isOriginal: true,
      })
      em.persist(row)
      await em.flush()
    },
    async updateRoundRobinCursor(userId) {
      let settings = await em.findOne(McaWorkspaceSettings, {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        deletedAt: null,
      })
      if (!settings) {
        settings = em.create(McaWorkspaceSettings, {
          id: randomUUID(),
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          roundRobinCursorUserId: userId,
          renewalPaidInThreshold: 80,
        })
      } else {
        settings.roundRobinCursorUserId = userId
      }
      em.persist(settings)
      await em.flush()
    },
  }
}

export async function commitReviewedImportWithOrm(
  em: EntityManager,
  scope: { organizationId: string; tenantId: string },
  input: CommitReviewedImportInput,
): Promise<CommitReviewedImportResult> {
  return commitReviewedImport(input, createEntityImportPersistence(em, scope))
}

export type { ColumnMap }
