"use client"

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  variant?: unknown
  duration?: number
  delay?: number
  yOffset?: number
  inView?: boolean
  inViewMargin?: string
  blur?: string
}

export function BlurFade({
  children,
  className,
}: BlurFadeProps) {
  return <div className={className}>{children}</div>
}
