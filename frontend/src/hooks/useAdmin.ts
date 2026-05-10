import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import adminService, {
  type AdminUser,
  type AuditRow,
  type MetricsSnapshot,
  type OverviewStats,
} from '@/services/AdminService'

export const useAdminOverview = () =>
  useQuery<OverviewStats>({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminService.getOverview(),
    staleTime: 30 * 1000,
  })

export const useAdminUsers = (params: {
  cursor?: string
  limit?: number
  q?: string
  plan?: 'FREE' | 'PRO'
  role?: string
}) =>
  useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.listUsers(params),
    staleTime: 30 * 1000,
  })

export const useAdminUser = (id: string | undefined) =>
  useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminService.getUser(id!),
    enabled: !!id,
  })

export const useSetUserRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminUser['role'] }) =>
      adminService.setUserRole(id, role),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] })
    },
  })
}

export const useAdminAudit = (params: {
  cursor?: string
  limit?: number
  action?: string
  userId?: string
}) =>
  useQuery<{ items: AuditRow[]; nextCursor: string | null }>({
    queryKey: ['admin', 'audit', params],
    queryFn: () => adminService.listAudit(params),
    staleTime: 15 * 1000,
  })

export const useAdminMetrics = () =>
  useQuery<MetricsSnapshot>({
    queryKey: ['admin', 'metrics'],
    queryFn: () => adminService.getMetrics(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
