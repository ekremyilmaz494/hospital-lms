import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExamNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <h1
          className="text-7xl font-bold mb-4"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>
        <h2 className="text-xl font-bold mb-2">Sınav Bulunamadı</h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Aradığınız sınav mevcut değil veya erişim yetkiniz olmayabilir.
        </p>
        <Link href="/staff/my-trainings">
          <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
            <Home className="h-4 w-4" /> Eğitimlerime Dön
          </Button>
        </Link>
      </div>
    </div>
  );
}
