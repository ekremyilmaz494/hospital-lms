'use client';

import { useRef, useState } from 'react';
import { Package, Upload, Trash2, Loader2, ShieldAlert, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

interface ScormTrainingItem {
  id: string;
  title: string;
  description: string | null;
  scormVersion: string | null;
  scormEntryPoint: string | null;
  isActive: boolean;
  publishStatus: string;
  createdAt: string;
  _count: { assignments: number; scormAttempts: number };
}

export default function AdminScormPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<ScormTrainingItem[]>('/api/admin/scorm');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteItem, setDeleteItem] = useState<ScormTrainingItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // GET 403 → planında SCORM yok (feature gate). Ayrı ekran göster.
  const featureDisabled = !!error && /403/.test(String(error));

  const resetDialog = () => {
    setTitle('');
    setFile(null);
    setProgress(null);
    setProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast('Lütfen bir .zip SCORM paketi seçin.', 'error');
      return;
    }
    if (title.trim().length < 3) {
      toast('Eğitim başlığı en az 3 karakter olmalıdır.', 'error');
      return;
    }
    try {
      // 1) Presigned URL al.
      const presignRes = await fetch('/api/admin/scorm/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        toast(err.error || 'Yükleme başlatılamadı', 'error');
        return;
      }
      const { uploadUrl, tempKey } = (await presignRes.json()) as { uploadUrl: string; tempKey: string };

      // 2) Zip'i doğrudan S3'e PUT et (progress).
      setProgress(0);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'application/zip');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('S3 PUT ' + xhr.status)));
        xhr.onerror = () => reject(new Error('bağlantı hatası'));
        xhr.send(file);
      });

      // 3) Sunucuda işle (aç + manifest parse + çıkar). Uzun sürebilir.
      setProgress(100);
      setProcessing(true);
      const procRes = await fetch('/api/admin/scorm/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempKey, title: title.trim() }),
      });
      if (!procRes.ok) {
        const err = await procRes.json().catch(() => ({}));
        toast(err.error || 'SCORM paketi işlenemedi', 'error');
        return;
      }
      const created = (await procRes.json()) as { scormVersion: string };
      toast(`SCORM eğitimi yüklendi (SCORM ${created.scormVersion})`, 'success');
      setDialogOpen(false);
      resetDialog();
      refetch();
    } catch (err) {
      toast(`Yükleme başarısız: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`, 'error');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/scorm/${deleteItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('SCORM eğitimi kaldırıldı', 'success');
        setDeleteItem(null);
        refetch();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Silinemedi', 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (featureDisabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="SCORM Eğitimleri" subtitle="SCORM paketlerini yükleyin ve yönetin" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">SCORM desteği planınızda etkin değil</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            SCORM paketi yükleyip yayınlamak için abonelik planınızda SCORM desteğinin açık olması gerekir.
            Yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="SCORM Eğitimleri"
        subtitle="SCORM 1.2 / 2004 paketlerini yükleyin, personele atayın ve tamamlanmayı izleyin"
        action={{ label: 'Paket Yükle', icon: Upload, onClick: () => setDialogOpen(true) }}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Henüz SCORM eğitimi yok</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Bir SCORM paketi (.zip) yükleyerek başlayın. Yükleme sonrası eğitim normal atama ve raporlama akışına girer.
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            İlk Paketi Yükle
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Eğitim</th>
                <th className="px-4 py-3 font-medium">Sürüm</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Atama</th>
                <th className="px-4 py-3 font-medium">Deneme</th>
                <th className="px-4 py-3 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                      <span className="line-clamp-1">{it.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">SCORM {it.scormVersion ?? '—'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {it.isActive ? (
                      <Badge>Yayında</Badge>
                    ) : (
                      <Badge variant="outline">Pasif</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{it._count.assignments}</td>
                  <td className="px-4 py-3 tabular-nums">{it._count.scormAttempts}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteItem(it)} aria-label="Sil">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yükleme diyaloğu */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!processing) { setDialogOpen(o); if (!o) resetDialog(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SCORM Paketi Yükle</DialogTitle>
            <DialogDescription>
              SCORM 1.2 veya 2004 uyumlu bir .zip paketi seçin. Paket sunucuda açılıp doğrulanacaktır.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="scorm-title">Eğitim Başlığı</label>
              <Input
                id="scorm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn. El Hijyeni Eğitimi"
                disabled={processing || progress !== null}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="scorm-file">Paket (.zip)</label>
              <Input
                id="scorm-file"
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={processing || progress !== null}
              />
            </div>

            {progress !== null && (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {processing ? 'Paket işleniyor (açılıyor ve doğrulanıyor)…' : `Yükleniyor… %${progress}`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetDialog(); }} disabled={processing}>
              İptal
            </Button>
            <Button onClick={handleUpload} disabled={processing || progress !== null}>
              {processing || progress !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Yükle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme onayı */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SCORM eğitimini kaldır?</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{deleteItem?.title}</span> arşivlenecek ve içerik dosyaları silinecek.
              Verilmiş sertifikalar ve rapor kayıtları korunur.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>İptal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Kaldır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
