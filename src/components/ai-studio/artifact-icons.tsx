import { Mic, Video, Presentation, Image as ImageIcon, FileText, Network, Table, HelpCircle, Layers, type LucideIcon } from 'lucide-react'
import type { AiArtifactType } from '@/lib/ai-content-studio/constants'

export const ARTIFACT_ICONS: Record<AiArtifactType, LucideIcon> = {
  audio: Mic,
  video: Video,
  slide_deck: Presentation,
  infographic: ImageIcon,
  report: FileText,
  mind_map: Network,
  data_table: Table,
  quiz: HelpCircle,
  flashcards: Layers,
}
