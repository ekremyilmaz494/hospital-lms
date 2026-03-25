import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center px-6">
        <h1
          className="text-8xl font-bold mb-4"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>
        <h2 className="text-2xl font-bold mb-2">
          Sayfa Bulunamad&#305;
        </h2>
        <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Arad&#305;&#287;&#305;n&#305;z sayfa mevcut de&#287;il veya ta&#351;&#305;nm&#305;&#351; olabilir. Ana sayfaya d&#246;nerek devam edebilirsiniz.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
              <Home className="h-4 w-4" /> Ana Sayfa
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft className="h-4 w-4" /> Giri&#351; Yap
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
