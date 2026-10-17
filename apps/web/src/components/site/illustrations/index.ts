import type { ComponentType } from 'react'
import { HeroPulseIllustration } from './hero-pulse'
import { ScatterToOrderIllustration } from './scatter-to-order'
import { FlowAssignIllustration } from './flow-assign'
import { FlowLearnIllustration } from './flow-learn'
import { FlowExamIllustration } from './flow-exam'
import { FlowProofIllustration } from './flow-proof'
import { VideoLockIllustration } from './video-lock'
import { CertificateVerifyIllustration } from './certificate-verify'
import { FormsStackIllustration } from './forms-stack'
import { ReminderTimelineIllustration } from './reminder-timeline'
import { MobileSyncIllustration } from './mobile-sync'
import { TenantIsolationIllustration } from './tenant-isolation'

export interface IllustrationProps {
  className?: string
}

/**
 * Sahne kaydı. Her yeni sahne buraya eklenir; `illustrations.test.tsx`
 * kayıttaki HER sahneyi stil/erişilebilirlik/boyut kurallarına karşı denetler.
 */
export const ILLUSTRATIONS = {
  'hero-pulse': HeroPulseIllustration,
  'scatter-to-order': ScatterToOrderIllustration,
  'flow-assign': FlowAssignIllustration,
  'flow-learn': FlowLearnIllustration,
  'flow-exam': FlowExamIllustration,
  'flow-proof': FlowProofIllustration,
  'video-lock': VideoLockIllustration,
  'certificate-verify': CertificateVerifyIllustration,
  'forms-stack': FormsStackIllustration,
  'reminder-timeline': ReminderTimelineIllustration,
  'mobile-sync': MobileSyncIllustration,
  'tenant-isolation': TenantIsolationIllustration,
} satisfies Record<string, ComponentType<IllustrationProps>>

export type IllustrationName = keyof typeof ILLUSTRATIONS

export { HeroPulseIllustration, ScatterToOrderIllustration, FlowAssignIllustration, FlowLearnIllustration, FlowExamIllustration, FlowProofIllustration, VideoLockIllustration, CertificateVerifyIllustration, FormsStackIllustration, ReminderTimelineIllustration, MobileSyncIllustration, TenantIsolationIllustration }
