import type { Metadata } from 'next';
import { ExamAuthGuard } from './exam-auth-guard';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Sinav | ${BRAND.fullName}`,
  description: 'Hastane personeli egitim sinav modulu',
};

/** Sinav layout - fullscreen, sidebar yok */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <ExamAuthGuard>{children}</ExamAuthGuard>;
}
