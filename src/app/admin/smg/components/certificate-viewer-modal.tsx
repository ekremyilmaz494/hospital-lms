'use client';

import { useEffect, useState } from 'react';
import { FileX, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!open || !activityId) {
      setData(null);
      setImageError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setImageError(false);
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
          <DialogTitle style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>
            Sertifika / Katılım Belgesi
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-[40vh] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: K.TEXT_MUTED }}>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Yükleniyor...</p>
            </div>
          ) : !data?.url ? (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: K.TEXT_MUTED }}>
              <FileX className="h-12 w-12" />
              <p className="text-sm">Bu aktivite için sertifika yüklenmemiş.</p>
            </div>
          ) : data.type === 'pdf' ? (
            <iframe
              src={data.url}
              className="w-full h-[65vh] rounded-xl"
              style={{ border: `1.5px solid ${K.BORDER}` }}
              title="Sertifika"
              sandbox=""
              referrerPolicy="no-referrer"
            />
          ) : data.type === 'image' ? (
            imageError ? (
              <div className="flex flex-col items-center gap-3 py-12" style={{ color: K.TEXT_MUTED }}>
                <FileX className="h-12 w-12" />
                <p className="text-sm">Görüntü yüklenemedi. Dosya taşınmış veya erişilemiyor olabilir.</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.url}
                className="max-w-full max-h-[65vh] object-contain mx-auto rounded-xl"
                style={{ border: `1.5px solid ${K.BORDER_LIGHT}` }}
                alt="Sertifika"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 py-12" style={{ color: K.TEXT_MUTED }}>
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
              style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
            >
              <ExternalLink className="h-4 w-4" /> Dışarıda Aç
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            style={{ background: K.PRIMARY, color: '#ffffff' }}
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
