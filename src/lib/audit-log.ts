import { prisma } from './prisma'

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'SALARY_UPDATE'
  | 'VACATION_UPDATE'
  | 'BULK_UPDATE'

interface AuditLogParams {
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string
  description: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string
  userAgent?: string
}

/**
 * Log een admin actie naar de audit log
 */
export async function logAuditAction({
  userId,
  action,
  entityType,
  entityId,
  description,
  oldValue,
  newValue,
  ipAddress,
  userAgent,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        description,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    // Log naar console maar laat de hoofdactie niet falen
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Helper om IP adres uit request te halen
 */
export function getIpFromRequest(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || undefined
}

/**
 * Helper om user agent uit request te halen
 */
export function getUserAgentFromRequest(req: Request): string | undefined {
  return req.headers.get('user-agent') || undefined
}

/**
 * Haal audit logs op voor een bepaalde entity
 */
export async function getAuditLogs(params: {
  entityType?: string
  entityId?: string
  userId?: string
  action?: string
  limit?: number
  offset?: number
}) {
  const { entityType, entityId, userId, action, limit = 50, offset = 0 } = params

  const where: Record<string, unknown> = {}

  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (userId) where.userId = userId
  if (action) where.action = action

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}

/**
 * Verwijder oude audit logs (ouder dan X dagen)
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 365): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  return result.count
}
