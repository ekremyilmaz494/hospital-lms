'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/shared/toast';

const currentYear = new Date().getFullYear();

const schema = z.object({
  year: z
    .number({ message: 'Geçerli bir yıl girin' })
    .int('Yıl tam sayı olmalı')
    .gte(currentYear - 5, `Yıl ${currentYear - 5} veya sonrası olmalı`)
    .lte(currentYear + 10, `Yıl ${currentYear + 10} veya öncesi olmalı`),
  label: z.string().trim().max(80, 'Etiket en fazla 80 karakter').optional(),
  startDate: z.string().min(1, 'Başlangıç tarihi gerekli'),
  endDate: z.string().min(1, 'Bitiş tarihi gerekli'),
  activate: z.boolean(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'Bitiş tarihi başlangıçtan sonra olmalı', path: ['endDate'] },
);

type FormValues = z.infer<typeof schema>;

interface NewPeriodModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewPeriodModal({ open, onClose }: NewPeriodModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const defaultYear = currentYear + 1;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: defaultYear,
      label: `${defaultYear} Eğitim Dönemi`,
      startDate: `${defaultYear}-01-01`,
      endDate: `${defaultYear}-12-31`,
      activate: false,
    },
  });

  const year = watch('year');
  const activate = watch('activate');

  // Yıl değişince diğer alanları otomatik doldur
  const handleYearBlur = () => {
    if (!year || isNaN(year)) return;
    setValue('label', `${year} Eğitim Dönemi`, { shouldDirty: true });
    setValue('startDate', `${year}-01-01`, { shouldDirty: true });
    setValue('endDate', `${year}-12-31`, { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/training-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: values.year,
          label: values.label?.trim() || undefined,
          startDate: new Date(values.startDate).toISOString(),
          endDate: new Date(values.endDate + 'T23:59:59').toISOString(),
          activate: values.activate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Dönem oluşturulamadı');
      toast(
        values.activate
          ? `${values.year} dönemi açıldı ve aktif edildi`
          : `${values.year} dönemi açıldı`,
        'success',
      );
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dönem oluşturulamadı', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <Calendar className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <DialogTitle>Yeni Eğitim Dönemi</DialogTitle>
              <DialogDescription>
                Organizasyon için yeni bir takvim yılı dönemi oluşturun.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="year">Yıl</Label>
              <Input
                id="year"
                type="number"
                min={currentYear - 5}
                max={currentYear + 10}
                {...register('year', { valueAsNumber: true, onBlur: handleYearBlur })}
                className="h-10"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              {errors.year && (
                <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.year.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Etiket</Label>
              <Input
                id="label"
                {...register('label')}
                placeholder={`${year || currentYear} Eğitim Dönemi`}
                className="h-10"
              />
              {errors.label && (
                <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.label.message}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Başlangıç</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
                className="h-10"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              {errors.startDate && (
                <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.startDate.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">Bitiş</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
                className="h-10"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              {errors.endDate && (
                <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.endDate.message}
                </span>
              )}
            </div>
          </div>

          <label
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
            style={{
              borderColor: activate ? 'var(--color-primary)' : 'var(--color-border)',
              background: activate ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
            }}
          >
            <Checkbox
              checked={activate}
              onCheckedChange={(checked) => setValue('activate', !!checked, { shouldDirty: true })}
              className="mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Hemen aktif et
              </span>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Mevcut aktif dönem otomatik olarak kapatılır. Yeni atamalar bu döneme yapılır.
              </p>
            </div>
          </label>

          <DialogFooter className="-mx-5 -mb-5 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (submitting) return;
                reset();
                onClose();
              }}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {submitting ? 'Oluşturuluyor…' : 'Dönemi Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
