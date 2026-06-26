import { getAppUrl } from '@/lib/api-helpers'

/**
 * Sertifikanın public doğrulama URL'ini üretir (ör.
 * https://klinovax.com/certificates/verify/CERT-...).
 *
 * Bilinçli olarak apex (`getAppUrl`) kullanılır — org subdomain'i DEĞİL. Doğrulama
 * endpoint'i (`/api/certificates/verify/[code]`) sertifikayı global benzersiz koda
 * göre çözer (org scope'u yok), bu yüzden apex her tenant için çalışır; ayrıca QR'a
 * gömülen adres org slug'ı değişse bile kırılmaz ve `*.klinovax.com` wildcard DNS'e
 * bağımlı olmaz. PDF QR kodu, okunabilir link ve sertifika e-postası bu tek kaynağı kullanır.
 */
export function certificateVerifyUrl(code: string): string {
  return `${getAppUrl()}/certificates/verify/${code}`
}
