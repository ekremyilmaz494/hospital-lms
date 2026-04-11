import type { Metadata } from 'next';
import { ExamAuthGuard } from './exam-auth-guard';

export const metadata: Metadata = {
  title: 'Sinav | Devakent Hastanesi',
  description: 'Hastane personeli egitim sinav modulu',
};

/** Sinav layout - fullscreen, sidebar yok */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <ExamAuthGuard>{children}</ExamAuthGuard>;
}
