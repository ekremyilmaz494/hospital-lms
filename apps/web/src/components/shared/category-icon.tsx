'use client'

import {
  Shield, HardHat, HeartHandshake, Radiation, Microscope,
  Pill, Siren, BookOpen, GraduationCap,
  Stethoscope, Syringe, Hospital, FlaskConical, Droplets,
  Brain, Eye, Bone, Thermometer, BandageIcon,
  Heart, Baby, Dna, Activity, Scan,
  Ear, Hand, Zap, Cross, Flame,
  ShieldCheck, Biohazard, TestTube, Leaf,
  ClipboardList, UserRound, Sparkles,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

/** Map of Lucide icon name → component for training categories */
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  // Default training categories
  Shield,
  HardHat,
  HeartHandshake,
  Radiation,
  Microscope,
  Pill,
  Siren,
  BookOpen,
  GraduationCap,
  // Extended health/medical icons for category picker
  Stethoscope,
  Syringe,
  Hospital,
  FlaskConical,
  Droplets,
  Brain,
  Eye,
  Bone,
  Thermometer,
  Bandage: BandageIcon,
  Heart,
  Baby,
  Dna,
  Activity,
  Scan,
  Ear,
  Hand,
  Zap,
  Cross,
  Flame,
  ShieldCheck,
  Biohazard,
  TestTube,
  Leaf,
  ClipboardList,
  UserRound,
  Sparkles,
}

/** All available icon names for category picker UI */
export const CATEGORY_ICON_NAMES = Object.keys(ICON_MAP)

interface CategoryIconProps extends LucideProps {
  /** Lucide icon name from TRAINING_CATEGORIES.icon */
  name: string
}

/** Renders a Lucide icon by name. Falls back to GraduationCap for unknown names. */
export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  const Icon = ICON_MAP[name] ?? GraduationCap
  return <Icon {...props} />
}
