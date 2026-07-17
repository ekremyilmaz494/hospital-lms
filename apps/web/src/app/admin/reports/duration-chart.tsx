'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { truncateText } from '@/lib/utils';

const K = {
  PRIMARY: '#0d9668',
  WARNING: '#f59e0b',
  SURFACE: '#ffffff',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_MUTED: '#78716c',
};

const tooltipStyle = {
  background: K.SURFACE,
  border: '1px solid #c9c4be',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

/**
 * Kategori başına ayrılan dikey alan. Kategori başına 2 çubuk × barSize 18 = 36px + nefes payı.
 * Bu değerin altına inilirse eksen etiketleri üst üste biner — grafik sabit yükseklikle çizilmemeli.
 */
const ROW_HEIGHT = 52;
/** Taban yükseklik — az kategoride grafik ezilmesin. */
const MIN_HEIGHT = 320;
/** Y ekseni etiketi bu uzunluğu aşarsa kısaltılır; tam başlık tooltip'te görünür. */
const LABEL_MAX = 26;
/** Kısaltılmış etiketin sığması için gereken Y ekseni genişliği (11px font). */
const AXIS_WIDTH = 180;

export interface DurationDatum {
  training: string;
  video: number;
  sinav: number;
}

/**
 * Eğitim başına ortalama video/sınav süresini karşılaştıran yatay bar grafiği.
 *
 * Yükseklik kategori sayısıyla büyür (`ROW_HEIGHT` × n): sabit yükseklikte, eğitim sayısı
 * arttıkça satır başına düşen alan çubuk kalınlığının altına iniyor ve eksen etiketleri
 * üst üste biniyordu. Etiketler `LABEL_MAX` karakterde kısaltılır; veri tam başlığı
 * koruduğu için tooltip'te başlığın tamamı görünür.
 */
export function DurationChart({ data }: { data: DurationDatum[] }) {
  const height = Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} unit=" dk" />
          <YAxis
            dataKey="training"
            type="category"
            tick={{ fontSize: 11, fill: K.TEXT_MUTED }}
            axisLine={false}
            tickLine={false}
            width={AXIS_WIDTH}
            interval={0}
            tickFormatter={(value: string) => truncateText(value, LABEL_MAX)}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" />
          <Bar dataKey="video" name="Video Süresi" fill={K.PRIMARY} radius={[0, 6, 6, 0]} barSize={18} />
          <Bar dataKey="sinav" name="Sınav Süresi" fill={K.WARNING} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
