import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center">
        <h1
          className="mb-4 text-7xl font-bold"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>
        <h2 className="mb-2 text-xl font-bold">Sayfa Bulunamadı</h2>
        <p
          className="mx-auto mb-8 max-w-sm text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/admin/scorm">
            <Button
              className="gap-2 font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              <Home className="h-4 w-4" /> SCORM Eğitimleri
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
