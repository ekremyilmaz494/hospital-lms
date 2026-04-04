import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ── Types ──

export interface ActiveJob {
  id: string
  title: string
  artifactType: string
  status: 'queued' | 'processing' | 'downloading' | 'completed' | 'failed'
  progress: number
  error?: string
  createdAt: string
}

export interface CompletedNotification {
  id: string
  title: string
  artifactType: string
  completedAt: string
  viewed: boolean
}

interface AiGenerationState {
  activeJobs: Record<string, ActiveJob>
  completedNotifications: CompletedNotification[]

  addJob: (job: ActiveJob) => void
  updateJob: (id: string, updates: Partial<ActiveJob>) => void
  removeJob: (id: string) => void

  addNotification: (n: Omit<CompletedNotification, 'viewed'>) => void
  markAsViewed: (id: string) => void
  markAllAsViewed: () => void
  clearNotifications: () => void

  cleanupStaleJobs: () => void
}

// ── Selectors ──

export const selectUnviewedCount = (state: AiGenerationState) =>
  state.completedNotifications.filter(n => !n.viewed).length

export const selectActiveCount = (state: AiGenerationState) =>
  Object.values(state.activeJobs).filter(
    j => j.status === 'queued' || j.status === 'processing' || j.status === 'downloading',
  ).length

// ── Store ──

const STALE_JOB_MS = 24 * 60 * 60 * 1000
const STALE_NOTIFICATION_MS = 7 * 24 * 60 * 60 * 1000

export const useAiGenerationStore = create<AiGenerationState>()(
  persist(
    (set, get) => ({
      activeJobs: {},
      completedNotifications: [],

      addJob: (job) =>
        set((state) => ({
          activeJobs: { ...state.activeJobs, [job.id]: job },
        })),

      updateJob: (id, updates) =>
        set((state) => {
          if (!state.activeJobs[id]) return state
          return {
            activeJobs: {
              ...state.activeJobs,
              [id]: { ...state.activeJobs[id], ...updates },
            },
          }
        }),

      removeJob: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.activeJobs
          return { activeJobs: rest }
        }),

      addNotification: (n) =>
        set((state) => {
          if (state.completedNotifications.some(existing => existing.id === n.id)) {
            return state
          }
          return {
            completedNotifications: [
              { ...n, viewed: false },
              ...state.completedNotifications,
            ],
          }
        }),

      markAsViewed: (id) =>
        set((state) => ({
          completedNotifications: state.completedNotifications.map(n =>
            n.id === id ? { ...n, viewed: true } : n,
          ),
        })),

      markAllAsViewed: () =>
        set((state) => ({
          completedNotifications: state.completedNotifications.map(n => ({ ...n, viewed: true })),
        })),

      clearNotifications: () => set({ completedNotifications: [] }),

      cleanupStaleJobs: () => {
        const now = Date.now()
        const state = get()

        const activeJobs: Record<string, ActiveJob> = {}
        for (const [id, job] of Object.entries(state.activeJobs)) {
          if (now - new Date(job.createdAt).getTime() < STALE_JOB_MS) {
            activeJobs[id] = job
          }
        }

        const completedNotifications = state.completedNotifications.filter(
          n => now - new Date(n.completedAt).getTime() < STALE_NOTIFICATION_MS,
        )

        set({ activeJobs, completedNotifications })
      },
    }),
    {
      name: 'ai-generation-store-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeJobs: state.activeJobs,
        completedNotifications: state.completedNotifications,
      }),
      onRehydrateStorage: () => (state) => {
        state?.cleanupStaleJobs()
      },
    },
  ),
)
