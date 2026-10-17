import { OG_SIZE, renderOgImage } from '@/lib/og-image'

export const alt = 'KlinoVax: hastane personel eğitim ve sınav platformu'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderOgImage({
    title: 'Hastane eğitimlerini atayın, ölçün, kanıtlayın.',
    subtitle: 'Atama, video, sınav ve sertifika tek akışta. Denetimde kanıt elinizde.',
  })
}
