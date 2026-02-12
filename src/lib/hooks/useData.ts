import useSWR, { SWRConfiguration, KeyedMutator } from 'swr'

/**
 * Default fetcher for SWR
 */
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}

/**
 * Default SWR options for different data types
 */
const defaultOptions: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
}

// Slower-changing data (team, settings)
const slowOptions: SWRConfiguration = {
  ...defaultOptions,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  revalidateOnFocus: false,
}

// Faster-changing data (activity, notifications)
const fastOptions: SWRConfiguration = {
  ...defaultOptions,
  refreshInterval: 30 * 1000, // 30 seconds
}

// Real-time data (chat, live updates)
const realtimeOptions: SWRConfiguration = {
  ...defaultOptions,
  refreshInterval: 10 * 1000, // 10 seconds
}

/**
 * Hook for dashboard summary data
 */
export function useDashboardSummary() {
  return useSWR('/api/dashboard/summary', fetcher, {
    ...defaultOptions,
    refreshInterval: 60 * 1000, // 1 minute
  })
}

/**
 * Hook for team members
 */
export function useTeam() {
  return useSWR('/api/team', fetcher, slowOptions)
}

/**
 * Hook for calendar events
 */
export function useCalendarEvents(upcoming = true, limit = 20) {
  return useSWR(
    `/api/calendar?upcoming=${upcoming}&limit=${limit}`,
    fetcher,
    defaultOptions
  )
}

/**
 * Hook for vacation data
 */
export function useVacationSummary() {
  return useSWR('/api/vacation/summary', fetcher, defaultOptions)
}

/**
 * Hook for work items
 */
export function useWorkItems(limit = 20) {
  return useSWR(`/api/work?limit=${limit}`, fetcher, defaultOptions)
}

/**
 * Hook for notifications
 */
export function useNotifications() {
  return useSWR('/api/notifications', fetcher, fastOptions)
}

/**
 * Hook for activity feed
 */
export function useActivity(limit = 10) {
  return useSWR(`/api/activity?limit=${limit}`, fetcher, fastOptions)
}

/**
 * Hook for office attendance
 */
export function useOfficeAttendance(date?: string) {
  const dateParam = date || new Date().toISOString().split('T')[0]
  return useSWR(`/api/office-attendance?date=${dateParam}`, fetcher, defaultOptions)
}

/**
 * Hook for bonus calculations
 */
export function useBonusCalculations() {
  return useSWR('/api/bonus', fetcher, slowOptions)
}

/**
 * Hook for financial data
 */
export function useFinancialData() {
  return useSWR('/api/financien', fetcher, slowOptions)
}

/**
 * Hook for salary scales
 */
export function useSalaryScales() {
  return useSWR('/api/financien/salary-scales', fetcher, slowOptions)
}

/**
 * Hook for feedback
 */
export function useFeedback() {
  return useSWR('/api/feedback', fetcher, defaultOptions)
}

/**
 * Hook for parental leave
 */
export function useParentalLeave() {
  return useSWR('/api/parental-leave', fetcher, slowOptions)
}

/**
 * Hook for training sessions
 */
export function useTrainingSessions() {
  return useSWR('/api/training/sessions', fetcher, slowOptions)
}

/**
 * Hook for lustrum data
 */
export function useLustrum() {
  return useSWR('/api/lustrum', fetcher, slowOptions)
}

/**
 * Hook for birthdays
 */
export function useBirthdays() {
  return useSWR('/api/birthdays', fetcher, slowOptions)
}

/**
 * Generic hook for any API endpoint
 */
export function useApi<T>(
  endpoint: string | null,
  options?: SWRConfiguration
): {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  mutate: KeyedMutator<T>
} {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    endpoint,
    fetcher,
    { ...defaultOptions, ...options }
  )

  return { data, error, isLoading, isValidating, mutate }
}

/**
 * Mutation helper for POST/PUT/DELETE operations
 */
export async function mutateApi<T>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  data?: any
): Promise<T> {
  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return res.json()
}

export default {
  useDashboardSummary,
  useTeam,
  useCalendarEvents,
  useVacationSummary,
  useWorkItems,
  useNotifications,
  useActivity,
  useOfficeAttendance,
  useBonusCalculations,
  useFinancialData,
  useSalaryScales,
  useFeedback,
  useParentalLeave,
  useTrainingSessions,
  useLustrum,
  useBirthdays,
  useApi,
  mutateApi,
}
