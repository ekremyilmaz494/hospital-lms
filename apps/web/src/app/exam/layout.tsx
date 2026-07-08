import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ExamAuthGuard } from './exam-auth-guard';
import { BRAND } from '@/lib/brand';
import { shouldRedirectToLicense } from '@/lib/license/enforcement';

export const metadata: Metadata = {
  title: `Sinav | ${BRAND.fullName}`,
  description: 'Personel egitim sinav modulu',
};

/** Sinav layout - fullscreen, sidebar yok. Server component → on-prem lisans
 * kilidinde sunucu tarafında /license'a yönlendirir (defense-in-depth; API
 * kapısı zaten tüm sınav veri yazmalarını 403'ler). Bulutta no-op. */
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  if (await shouldRedirectToLicense()) {
    redirect('/license');
  }
  return <ExamAuthGuard>{children}</ExamAuthGuard>;
}
