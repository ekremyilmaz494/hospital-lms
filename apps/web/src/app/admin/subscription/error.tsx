'use client';

import { SectionError } from '@/components/shared/skeletons';

export default function SubscriptionError({ reset }: { reset: () => void }) {
  return <SectionError message="Abonelik bilgileri yüklenirken bir hata oluştu." onRetry={reset} />;
}
