import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * AWS SNS mesaj imza doğrulaması (SES bounce/complaint webhook'u için).
 *
 * NEDEN: SNS webhook'u kimlik doğrulaması olmadan internete açıktır. İmza doğrulanmazsa
 * (a) saldırgan `SubscriptionConfirmation` ile keyfi `SubscribeURL` göndererek sunucuya
 * SSRF yaptırır (cloud metadata / iç servis taraması), (b) sahte bounce/complaint enjekte eder.
 * Bu helper mesajın gerçekten AWS SNS'ten geldiğini kriptografik olarak doğrular.
 */

const SNS_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com$/

/** Bir URL'in https + meşru SNS host'u olduğunu doğrular (SSRF guard). */
export function isAllowedSnsUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && SNS_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

// İmzalama sertifikası cache'i (certURL → PEM)
const certCache = new Map<string, string>()

async function fetchCert(url: string): Promise<string | null> {
  const cached = certCache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) return null
  const pem = await res.text()
  if (certCache.size > 20) certCache.clear()
  certCache.set(url, pem)
  return pem
}

/** SNS spesifikasyonuna göre imzalanacak kanonik string'i kurar (alan sırası kritik). */
function buildStringToSign(msg: Record<string, unknown>): string | null {
  const type = msg.Type
  let keys: string[]
  if (type === 'Notification') {
    keys =
      msg.Subject !== undefined
        ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        : ['Message', 'MessageId', 'Timestamp', 'TopicArn', 'Type']
  } else if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
    keys = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  } else {
    return null
  }
  let out = ''
  for (const k of keys) {
    const v = msg[k]
    if (v === undefined || v === null) return null
    out += `${k}\n${String(v)}\n`
  }
  return out
}

/**
 * SNS mesajının imzasını doğrular. Geçerliyse true.
 * SigningCertURL host'u, Signature, SignatureVersion (1=SHA1, 2=SHA256) ve Timestamp
 * tazeliği (±1 saat, replay sınırı) kontrol edilir.
 */
export async function verifySnsMessage(msg: Record<string, unknown>): Promise<boolean> {
  try {
    const certUrl = msg.SigningCertURL as string | undefined
    if (!isAllowedSnsUrl(certUrl)) {
      logger.warn('aws-sns', 'Geçersiz/izin verilmeyen SigningCertURL — reddedildi')
      return false
    }
    const signature = msg.Signature
    if (typeof signature !== 'string' || !signature) return false

    const version = typeof msg.SignatureVersion === 'string' ? msg.SignatureVersion : '1'
    const algo = version === '2' ? 'RSA-SHA256' : 'RSA-SHA1'

    const stringToSign = buildStringToSign(msg)
    if (!stringToSign) return false

    // Timestamp tazeliği — eski (yakalanmış) mesajların tekrar oynatılmasını sınırlar.
    const ts = Date.parse(String(msg.Timestamp))
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 60 * 60 * 1000) {
      logger.warn('aws-sns', 'SNS Timestamp penceresi dışında — reddedildi (replay?)')
      return false
    }

    const pem = await fetchCert(certUrl as string)
    if (!pem) return false

    const verifier = crypto.createVerify(algo)
    verifier.update(stringToSign, 'utf8')
    return verifier.verify(pem, signature, 'base64')
  } catch (err) {
    logger.warn('aws-sns', 'SNS imza doğrulama hatası', err instanceof Error ? err.message : err)
    return false
  }
}
