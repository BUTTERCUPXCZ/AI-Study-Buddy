import { api } from '@/lib/api'

export interface AdminUser {
  id: string
  email: string
  Fullname: string
  role: 'USER' | 'SUPPORT' | 'ADMIN' | 'SUPER_ADMIN'
  subscriptionStatus: 'FREE' | 'PRO'
  emailVerified: boolean
  attemptsUsed: number
  lastLoginAt: string | null
  stripeCustomerId: string | null
}

export interface OverviewStats {
  totalUsers: number
  proUsers: number
  freeUsers: number
  signupsToday: number
  activeLast7Days: number
  activeLast30Days: number
  totalNotes: number
  totalQuizzes: number
}

export interface AuditRow {
  id: string
  userId: string | null
  action: string
  target: string | null
  ip: string | null
  userAgent: string | null
  meta: unknown
  createdAt: string
}

export interface MetricsSnapshot {
  uptimeSeconds: number
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number }
  redis: { ok: boolean }
  db: { ok: boolean; latencyMs: number }
  queues: Record<
    string,
    | { waiting: number; active: number; completed: number; failed: number; delayed: number }
    | { error: string }
  >
  generatedInMs: number
  generatedAt: string
}

interface PageResponse<T> {
  items: T[]
  nextCursor: string | null
}

class AdminService {
  async getOverview(): Promise<OverviewStats> {
    const r = await api.get<OverviewStats>('/admin/overview')
    return r.data
  }

  async listUsers(params: {
    cursor?: string
    limit?: number
    q?: string
    plan?: 'FREE' | 'PRO'
    role?: string
  }): Promise<PageResponse<AdminUser>> {
    const r = await api.get<PageResponse<AdminUser>>('/admin/users', { params })
    return r.data
  }

  async getUser(id: string): Promise<AdminUser & { _count: Record<string, number> }> {
    const r = await api.get(`/admin/users/${id}`)
    return r.data as AdminUser & { _count: Record<string, number> }
  }

  async setUserRole(id: string, role: AdminUser['role']) {
    const r = await api.patch(`/admin/users/${id}/role`, { role })
    return r.data
  }

  async listAudit(params: {
    cursor?: string
    limit?: number
    action?: string
    userId?: string
  }): Promise<PageResponse<AuditRow>> {
    const r = await api.get<PageResponse<AuditRow>>('/admin/audit', { params })
    return r.data
  }

  async getMetrics(): Promise<MetricsSnapshot> {
    const r = await api.get<MetricsSnapshot>('/admin/metrics')
    return r.data
  }
}

export const adminService = new AdminService()
export default adminService
