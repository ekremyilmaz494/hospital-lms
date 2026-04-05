import { StatCardSkeleton, ChartSkeleton } from '@/components/shared/skeletons';

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="h-10 w-64 rounded-lg animate-pulse" style={{ background: 'var(--color-surface-hover)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 5 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
