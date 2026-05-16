import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
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
        <h2 className="text-xl font-bold mb-2">Sayfa Bulunamadı</h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/admin/dashboard">
            <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
              <Home className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <Link href="/admin/staff">
            <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft className="h-4 w-4" /> Geri Dön
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
