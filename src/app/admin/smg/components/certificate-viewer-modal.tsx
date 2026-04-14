'use client';

import { useEffect, useState } from 'react';
import { FileX, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  activityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CertificateResponse {
  url: string | null;
  type: 'pdf' | 'image' | null;
}

export function CertificateViewerModal({ activityId, open, onOpenChange }: Props) {
  const [data, setData] = useState<CertificateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !activityId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/smg/activities/${activityId}/certificate`)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ url: null, type: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activityId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Sertifika / Katılım Belgesi</DialogTitle>
        </DialogHeader>
        <div className="min-h-[40vh] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: 'var(--color-text-muted)' }}>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Yükleniyor...</p>
            </div>
          ) : !data?.url ? (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: 'var(--color-text-muted)' }}>
              <FileX className="h-12 w-12" />
              <p className="text-sm">Bu aktivite için sertifika yüklenmemiş.</p>
            </div>
          ) : data.type === 'pdf' ? (
            <iframe
              src={data.url}
              className="w-full h-[65vh] border-0 rounded-xl"
              title="Sertifika"
            />
          ) : data.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.url} className="max-w-full max-h-[65vh] object-contain mx-auto rounded-xl" alt="Sertifika" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: 'var(--color-text-muted)' }}>
              <FileX className="h-12 w-12" />
              <p className="text-sm">Dosya türü tanınmadı.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          {data?.url && (
            <Button
              variant="outline"
              onClick={() => window.open(data.url!, '_blank', 'noopener,noreferrer')}
              className="gap-1.5 rounded-xl"
            >
              <ExternalLink className="h-4 w-4" /> Dışarıda Aç
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} className="rounded-xl">
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
