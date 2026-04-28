'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Layers, FileText, Upload, Library, Video, Music, Check, GripVertical, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { K, type VideoItem } from './types';
import type { SelectedContent } from '../content-library-modal';

const ContentLibraryModal = dynamic(
  () => import('../content-library-modal').then(m => ({ default: m.ContentLibraryModal })),
  { ssr: false }
);

interface ContentStepProps {
  videos: VideoItem[];
  setVideos: React.Dispatch<React.SetStateAction<VideoItem[]>>;
  uploadProgress: Record<number, number>;
  uploadFileToS3: (itemId: number, file: File) => Promise<void>;
  addFromLibrary: (items: SelectedContent[]) => void;
  removeVideo: (id: number) => void;
  libraryModalOpen: boolean;
  setLibraryModalOpen: (v: boolean) => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ContentStep({
  videos, setVideos,
  uploadProgress,
  uploadFileToS3,
  addFromLibrary,
  removeVideo,
  libraryModalOpen,
  setLibraryModalOpen,
  toast,
}: ContentStepProps) {
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
          <Layers className="h-5 w-5" style={{ color: K.PRIMARY }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Eğitim İçerikleri</h3>
          <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
            {videos.filter(v => v.contentType === 'video').length} video, {videos.filter(v => v.contentType === 'audio').length} ses, {videos.filter(v => v.contentType === 'pdf').length} doküman eklendi
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={docFileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const newId = Date.now();
              setVideos(prev => [...prev, { id: newId, title: file.name.replace(/\.[^.]+$/, ''), url: '', contentType: 'pdf' as const }]);
              setTimeout(() => uploadFileToS3(newId, file), 0);
            }
            e.target.value = '';
          }}
        />
        <input
          ref={mediaFileInputRef}
          type="file"
          accept="video/mp4,video/webm,.mp3,.wav,.m4a,.ogg,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/aac"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const isAudio = file.type.startsWith('audio/');
              const newId = Date.now();
              setVideos(prev => [...prev, { id: newId, title: file.name.replace(/\.[^.]+$/, ''), url: '', contentType: isAudio ? 'audio' as const : 'video' as const }]);
              setTimeout(() => uploadFileToS3(newId, file), 0);
            }
            e.target.value = '';
          }}
        />

        <Button
          onClick={() => docFileInputRef.current?.click()}
          variant="outline"
          className="gap-2 font-semibold rounded-xl"
          style={{ borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
        >
          <FileText className="h-4 w-4" />
          Doküman Yükle
        </Button>
        <Button
          onClick={() => mediaFileInputRef.current?.click()}
          variant="outline"
          className="gap-2 font-semibold rounded-xl"
          style={{ borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
        >
          <Upload className="h-4 w-4" />
          Video/Ses Yükle
        </Button>
        <Button
          onClick={() => setLibraryModalOpen(true)}
          className="gap-2 font-semibold text-white rounded-xl"
          style={{ background: K.PRIMARY }}
        >
          <Library className="h-4 w-4" />
          Kütüphaneden Seç
        </Button>
      </div>

      <div className="space-y-4">
        {videos.map((video, idx) => (
          <div
            key={video.id}
            className="rounded-xl border group"
            style={{
              borderColor: K.BORDER,
              background: K.BG,
              transition: 'border-color 150ms ease',
            }}
          >
            <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: `1.5px solid ${K.BORDER}` }}>
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab" style={{ color: K.TEXT_MUTED }} />
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: video.contentType === 'audio' ? K.WARNING : K.PRIMARY, color: 'white' }}
              >
                {video.contentType === 'audio' ? <Music className="h-4 w-4" /> : idx + 1}
              </div>
              <Input
                placeholder={video.contentType === 'audio' ? 'Ses başlığı girin...' : 'Video başlığı girin...'}
                value={video.title}
                onChange={(e) => setVideos(prev => prev.map(v => v.id === video.id ? { ...v, title: e.target.value } : v))}
                className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                style={{ color: K.TEXT_PRIMARY }}
              />
              <div className="flex items-center gap-2">
                {video.contentType === 'audio' && video.durationSeconds ? (
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: '#fef3c7', color: K.WARNING, fontFamily: K.FONT_MONO }}>
                    {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')} dk
                  </span>
                ) : null}
                {videos.length > 0 && (
                  <button
                    onClick={() => removeVideo(video.id)}
                    className="rounded-lg p-2 opacity-0 group-hover:opacity-100"
                    style={{ color: K.ERROR, transition: 'opacity 150ms ease' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {video.url && !video.file && (
              <div
                className="flex items-center gap-4 px-5 py-4"
                style={{ background: K.SUCCESS_BG }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: K.PRIMARY_LIGHT }}>
                  <Library className="h-4.5 w-4.5" style={{ color: K.PRIMARY }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: K.SUCCESS }}>
                    Kütüphaneden eklendi
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                    {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : video.contentType === 'pdf' ? 'Doküman' : video.contentType === 'audio' ? 'Ses dosyası' : 'Video'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="rounded-lg text-xs gap-1.5"
                  style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                  onClick={() => setVideos(prev => prev.map(v => v.id === video.id ? { ...v, url: '', file: undefined } : v))}
                >
                  Değiştir
                </Button>
              </div>
            )}

            {video.contentType !== 'audio' && !(video.url && !video.file) && (
              <div
                className="flex items-center gap-4 px-5 py-5 relative"
                style={{ background: K.SURFACE }}
              >
                <input
                  type="file"
                  accept={video.contentType === 'pdf' ? 'application/pdf' : 'video/mp4,video/webm,application/pdf'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadFileToS3(video.id, file);
                    }
                  }}
                />
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: video.file ? K.SUCCESS_BG : K.PRIMARY_LIGHT }}
                >
                  {video.file ? (
                    video.contentType === 'pdf' ? (
                      <FileText className="h-5 w-5" style={{ color: K.SUCCESS }} />
                    ) : (
                      <Video className="h-5 w-5" style={{ color: K.SUCCESS }} />
                    )
                  ) : (
                    <Upload className="h-5 w-5" style={{ color: K.PRIMARY }} />
                  )}
                </div>
                <div className="flex-1">
                  {video.file ? (
                    <>
                      <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                        {video.file.name}
                      </p>
                      {uploadProgress[video.id] !== undefined ? (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${uploadProgress[video.id]}%`,
                                  background: K.PRIMARY,
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold shrink-0" style={{ fontFamily: K.FONT_MONO, color: K.PRIMARY, minWidth: 36, textAlign: 'right' }}>
                              {uploadProgress[video.id]}%
                            </span>
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>
                            {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: video.url ? K.SUCCESS : K.TEXT_MUTED }}>
                          {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                          {video.contentType === 'pdf' && video.pageCount ? ` • ${video.pageCount} sayfa` : ''}
                          {video.url ? ' • Yüklendi ✓' : ''}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                        Dosyayı sürükleyin veya tıklayıp seçin
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                        {video.contentType === 'pdf' ? 'PDF — Maks. 100MB' : 'Video (MP4, WebM — Maks. 500MB) veya PDF (Maks. 100MB)'}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant={video.file ? 'default' : 'outline'}
                    size="sm"
                    type="button"
                    className="rounded-lg text-xs gap-1.5 pointer-events-none"
                    style={video.file ? { background: K.BG_SOFT, color: K.TEXT_PRIMARY } : { borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                  >
                    {video.file ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                    {video.file ? 'Değiştir' : 'Dosya Seç'}
                  </Button>
                  {!video.file && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="rounded-lg text-xs gap-1.5 relative z-10"
                      style={{ color: K.PRIMARY }}
                      onClick={(e) => { e.stopPropagation(); setLibraryModalOpen(true); }}
                    >
                      <Library className="h-3.5 w-3.5" />
                      Kütüphane
                    </Button>
                  )}
                </div>
              </div>
            )}

            {video.contentType === 'audio' && !(video.url && !video.file) && (
              <div className="divide-y" style={{ borderColor: K.BORDER }}>
                <div
                  className="flex items-center gap-4 px-5 py-5 relative"
                  style={{ background: K.SURFACE }}
                >
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/aac"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFileToS3(video.id, file);
                      }
                    }}
                  />
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: video.file ? K.SUCCESS_BG : '#fef3c7' }}
                  >
                    {video.file ? (
                      <Music className="h-5 w-5" style={{ color: K.SUCCESS }} />
                    ) : (
                      <Music className="h-5 w-5" style={{ color: K.WARNING }} />
                    )}
                  </div>
                  <div className="flex-1">
                    {video.file ? (
                      <>
                        <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                          {video.file.name}
                        </p>
                        {uploadProgress[video.id] !== undefined ? (
                          <div className="mt-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${uploadProgress[video.id]}%`,
                                    background: K.WARNING,
                                    transition: 'width 0.2s ease',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold shrink-0" style={{ fontFamily: K.FONT_MONO, color: K.WARNING, minWidth: 36, textAlign: 'right' }}>
                                {uploadProgress[video.id]}%
                              </span>
                            </div>
                            <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>
                              {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs mt-0.5" style={{ color: video.url ? K.SUCCESS : K.TEXT_MUTED }}>
                            Ses · {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                            {video.durationSeconds ? ` · ${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : ''}
                            {video.url ? ' · Yüklendi ✓' : ''}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                          Ses dosyasını sürükleyin veya tıklayıp seçin
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                          MP3, WAV, M4A, OGG, AAC — Maks. 200MB
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={video.file ? 'default' : 'outline'}
                      size="sm"
                      type="button"
                      className="rounded-lg text-xs gap-1.5 pointer-events-none"
                      style={video.file ? { background: K.BG_SOFT, color: K.TEXT_PRIMARY } : { borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                    >
                      {video.file ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                      {video.file ? 'Değiştir' : 'Ses Seç'}
                    </Button>
                    {!video.file && (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="rounded-lg text-xs gap-1.5 relative z-10"
                        style={{ color: K.PRIMARY }}
                        onClick={(e) => { e.stopPropagation(); setLibraryModalOpen(true); }}
                      >
                        <Library className="h-3.5 w-3.5" />
                        Kütüphane
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  className="flex items-center gap-4 px-5 py-4 relative"
                  style={{ background: K.BG }}
                >
                  <input
                    type="file"
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 100 * 1024 * 1024) {
                          toast('Doküman boyutu 100MB sınırını aşıyor', 'error');
                          return;
                        }
                        setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: file, documentKey: '', documentUploading: true } : v));
                        try {
                          const presignRes = await fetch('/api/upload/presign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
                          });
                          if (!presignRes.ok) {
                            const err = await presignRes.json();
                            toast(err.error || 'Yükleme URL alınamadı', 'error');
                            setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                            return;
                          }
                          const { uploadUrl, key } = await presignRes.json();
                          const uploadRes = await fetch(uploadUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': file.type },
                            body: file,
                          });
                          if (uploadRes.ok) {
                            setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentKey: key, documentUploading: false } : v));
                            toast('Doküman yüklendi', 'success');
                          } else {
                            toast('Doküman yüklenemedi', 'error');
                            setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                          }
                        } catch {
                          toast('Doküman yüklenemedi — bağlantı hatası', 'error');
                          setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                        }
                      }
                    }}
                  />
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: video.documentFile ? K.SUCCESS_BG : K.BG_SOFT }}
                  >
                    <FileText className="h-4 w-4" style={{ color: video.documentFile ? K.SUCCESS : K.TEXT_MUTED }} />
                  </div>
                  <div className="flex-1">
                    {video.documentFile ? (
                      <p className="text-sm" style={{ color: video.documentKey ? K.SUCCESS : K.TEXT_PRIMARY }}>
                        {video.documentFile.name}
                        {video.documentUploading ? ' — Yükleniyor...' : video.documentKey ? ' ✓' : ''}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
                          Eşlik eden doküman ekle (opsiyonel)
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
                          PDF veya PPTX — Maks. 100MB
                        </p>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="rounded-lg text-xs gap-1.5 pointer-events-none"
                    style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {video.documentFile ? 'Değiştir' : 'Doküman Seç'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {videos.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed"
            style={{ borderColor: K.BORDER, background: K.SURFACE }}
          >
            <Layers className="h-10 w-10 mb-3" style={{ color: K.TEXT_MUTED, opacity: 0.5 }} />
            <p className="text-sm font-medium" style={{ color: K.TEXT_MUTED }}>
              Henüz içerik eklenmedi
            </p>
            <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED, opacity: 0.7 }}>
              Doküman, video veya ses yükleyin ya da kütüphaneden seçin
            </p>
          </div>
        )}
      </div>

      <ContentLibraryModal
        open={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onSelect={addFromLibrary}
        defaultFilter="all"
      />
    </div>
  );
}
