import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { resolveExamFlowState } from '@/lib/exam-flow-resolver'
import type { ExamRoute } from '@/lib/exam-state-machine'

/**
 * GET /api/exam/[id]/state — sınav akışı aşama senkronu.
 *
 * Sekme tekrar görünür olduğunda (visibilitychange/focus) client bu endpoint'i
 * çağırıp sunucunun bildiği aşamayla kendini hizalar. Bu olmadan: cron attempt'i
 * expire ettiğinde, başka sekme aşamayı ilerlettiğinde veya sınav süresi sekme
 * gizliyken dolduğunda kullanıcı bayat ekranda kalıyor; ilk POST 400 alınca
 * "Eğitim oturumu geçersiz" dead-end modalı açılıyordu. Artık sessizce doğru
 * aşamaya yönlendirilir (use-exam-stage-sync.ts).
 *
 * Salt-okunur, tek resolver çağrısı (2-3 hafif sorgu) — yalnız sekme-dönüşünde
 * tetiklenir, polling YOK.
 */
const VALID_ROUTES: readonly ExamRoute[] = [
  'pre-exam',
  'videos',
  'post-exam',
  'transition',
  'my-trainings',
  'my-training-detail',
]

export const GET = withStaffRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId }) => {
    const { id } = params
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const currentRoute = VALID_ROUTES.includes(from as ExamRoute) ? (from as ExamRoute) : undefined

    const state = await resolveExamFlowState(id, dbUser.id, organizationId, { currentRoute })

    // Aşama bilgisi bayatlamamalı — bu endpoint'in tek varlık sebebi tazelik.
    return jsonResponse(
      {
        stage: state.stage,
        attemptId: state.attempt?.id ?? null,
        attemptNumber: state.attempt?.attemptNumber ?? null,
        assignmentId: state.assignment?.id ?? null,
        redirect: state.redirect,
        noRequiredVideos: state.noRequiredVideos,
      },
      200,
      { 'Cache-Control': 'private, no-store' },
    )
  },
  { requireOrganization: true },
)
