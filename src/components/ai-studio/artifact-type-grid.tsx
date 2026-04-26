'use client'

import React from 'react'
import { K } from './k-tokens'
import { ARTIFACT_ICONS } from './artifact-icons'
import {
  AI_ARTIFACT_TYPES,
  ARTIFACT_TYPE_LABEL_TR,
  ARTIFACT_TYPE_DESC_TR,
  type AiArtifactType,
} from '@/lib/ai-content-studio/constants'

interface ArtifactTypeGridProps {
  selected: AiArtifactType | null
  onSelect: (t: AiArtifactType) => void
  disabled?: boolean
}

export function ArtifactTypeGrid({ selected, onSelect, disabled }: ArtifactTypeGridProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {AI_ARTIFACT_TYPES.map((t) => {
        const Icon = ARTIFACT_ICONS[t]
        const isSelected = selected === t
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(t)}
            style={{
              flex: '1 1 200px',
              minWidth: 180,
              maxWidth: 260,
              textAlign: 'left',
              padding: 14,
              borderRadius: 12,
              border: `1.5px solid ${isSelected ? K.PRIMARY : K.BORDER_LIGHT}`,
              background: isSelected ? K.PRIMARY_LIGHT : K.SURFACE,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'border-color 0.15s, background 0.15s',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon size={18} color={isSelected ? K.PRIMARY : K.TEXT_SECONDARY} />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: isSelected ? K.PRIMARY : K.TEXT_PRIMARY,
                }}
              >
                {ARTIFACT_TYPE_LABEL_TR[t]}
              </span>
            </div>
            <div style={{ fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.4 }}>
              {ARTIFACT_TYPE_DESC_TR[t]}
            </div>
          </button>
        )
      })}
    </div>
  )
}
