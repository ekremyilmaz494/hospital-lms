import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { resolveExamFlowState } from '@/lib/exam-flow-resolver';
import type { AttemptStatus } from '@/lib/exam-state-machine';

/**
 * FAZ 3-lite #1 — `/exam/[id]` direct URL entrypoint.
 *
 * Kullanıcı `/exam/{assignmentId}` URL'ini doğrudan açtığında (eski email
 * link, paylaşılan URL, manuel adres çubuğu), bu sayfa attempt status'a göre
 * doğru alt-sayfaya **server-side** redirect eder. Bu olmadan Next.js 404 verir
 * (alt route'lar `/pre-exam`, `/videos` vs. mevcut ama kök yok).
 *
 * VERİ KORUMA: Tüm sorgular SELECT only. Mutation YOK. POST /start hâlâ
 * sadece `pre-exam` ve `transition`'ın body'sinde tetiklenir — bu entrypoint
 * o "tek mutasyon noktası" garantisini bozmaz, sadece kullanıcıyı doğru
 * yere yönlendirir.
 */
export default async function ExamEntrypoint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Auth — yoksa login
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?from=/exam/${id}`);
  }

  // 2. dbUser + multi-tenant guard
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!dbUser?.isActive || !dbUser.organizationId) {
    redirect('/staff/my-trainings');
  }

  // 3. Atama + attempt + aşama: TEK doğruluk kaynağı resolveExamFlowState.
  // id assignmentId VEYA trainingId olabilir — resolver kanonikleştirir (eski
  // kod yalnız assignmentId kabul ediyordu; trainingId içeren eski/derin
  // linkler haksız yere listeye atılıyordu).
  const state = await resolveExamFlowState(id, dbUser.id, dbUser.organizationId);

  if (!state.assignment) {
    // Atanmamış eğitim — liste sayfası "atanmadı" durumunu zaten gösteriyor
    redirect('/staff/my-trainings');
  }

  // Alt sayfalara her zaman KANONİK assignmentId ile yönlendir — id trainingId
  // olarak geldiyse bile akışın geri kalanı tek id ailesiyle çalışsın.
  const examId = state.assignment.id;

  // 4. SCORM eğitimi: kendi sayfasına (pre/post exam akışı geçerli değil)
  // `scormEntryPoint` null değilse SCORM paketi yüklenmiş demektir
  // (scorm/page.tsx:91 ve content/[...path]/route.ts:51 ile aynı tespit pattern'i).
  const training = await prisma.training.findFirst({
    where: { id: state.assignment.trainingId, organizationId: dbUser.organizationId },
    select: { scormEntryPoint: true },
  });
  if (training?.scormEntryPoint) {
    redirect(`/exam/${examId}/scorm`);
  }

  // 5. Hiç attempt yoksa: pre-exam'a (tek mutasyon noktası — POST /start orada)
  const attempt = state.attempt;
  if (!attempt) {
    redirect(`/exam/${examId}/pre-exam`);
  }

  // 6. Aktif/son attempt status'una göre fazlanma
  // switch ile exhaustive narrowing — TS Record indexing alternatifinden temiz
  // ve missing-case durumunda compile-time'da yakalanır.
  const status = attempt.status as AttemptStatus;
  switch (status) {
    case 'pre_exam':
      redirect(`/exam/${examId}/pre-exam`);
    case 'watching_videos':
      redirect(`/exam/${examId}/videos`);
    case 'post_exam':
      redirect(`/exam/${examId}/post-exam`);
    case 'completed':
    case 'expired':
      // Terminal — eğitim detayında doğru CTA gösterilir (sertifika, yeniden dene,
      // kilit). Liste yerine detay kritik (2026-05-20 Devakent şikayeti dersi,
      // exam-state-machine.ts:255-261).
      redirect(`/staff/my-trainings/${examId}`);
    default: {
      // Bilinmeyen status — defensive fallback. Yeni status eklenirse compile
      // hata vermez ama prod'da kullanıcı en azından akıllı bir yere düşer.
      const _exhaustive: never = status;
      void _exhaustive;
      redirect('/staff/my-trainings');
    }
  }
}
