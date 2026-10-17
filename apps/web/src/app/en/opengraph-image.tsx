import { OG_SIZE, renderOgImage } from '@/lib/og-image'

export const alt = 'KlinoVax: staff training and exam platform for hospitals'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    title: 'Assign, measure and prove hospital training.',
    subtitle: 'Assignment, video, exams and certificates in one flow. Audit evidence on hand.',
  })
}
