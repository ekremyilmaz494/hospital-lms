'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadialBarChart, RadialBar,
} from 'recharts'

interface PassRateRadialProps {
  passRate: number
}

export function PassRateRadial({ passRate }: PassRateRadialProps) {
  const radialData = [{ name: 'Geçme', value: passRate, fill: 'var(--color-success)' }]

  return (
    <ResponsiveContainer>
      <RadialBarChart
        innerRadius="70%"
        outerRadius="100%"
        data={radialData}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--color-border)' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  )
}

interface ScoreDistributionProps {
  data: { range: string; count: number; aboveThreshold: boolean }[]
  passingScore: number
}

export function ScoreDistributionChart({ data, passingScore }: ScoreDistributionProps) {
  return (
    <>
      <div style={{ height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.aboveThreshold ? 'var(--color-success)' : 'var(--color-error)'}
                  opacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
        Baraj puanı: {passingScore}% (kırmızı = baraj altı, yeşil = baraj üstü)
      </p>
    </>
  )
}
