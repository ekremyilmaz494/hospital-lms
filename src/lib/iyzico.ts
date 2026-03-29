import crypto from 'crypto'

const API_KEY = process.env.IYZICO_API_KEY ?? ''
const SECRET_KEY = process.env.IYZICO_SECRET_KEY ?? ''
const BASE_URL = process.env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com'

/** Iyzico API imzasi + random string cifti olusturur */
function generateAuthorizationPair(requestBody: string): { authorization: string; rnd: string } {
  const rnd = crypto.randomBytes(8).toString('hex')
  const hashStr = API_KEY + rnd + SECRET_KEY + requestBody
  const hash = crypto.createHash('sha1').update(hashStr).digest('base64')
  return { authorization: `IYZWS ${API_KEY}:${hash}`, rnd }
}

/** Iyzico'ya HTTP POST isteği gönderir */
async function iyzicoPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const { authorization, rnd } = generateAuthorizationPair(bodyStr)

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'x-iyzi-rnd': rnd,
    },
    body: bodyStr,
  })

  if (!res.ok) {
    throw new Error(`Iyzico API hatasi: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export interface CheckoutFormInitResult {
  status: string
  errorMessage?: string
  checkoutFormContent?: string
  token?: string
  paymentPageUrl?: string
}

export interface CheckoutFormRetrieveResult {
  status: string
  errorMessage?: string
  paymentStatus?: string
  paymentId?: string
  conversationId?: string
  lastFourDigits?: string
  cardAssociation?: string
  price?: number
}

/** Checkout form başlatır */
export function createCheckoutForm(request: Record<string, unknown>): Promise<CheckoutFormInitResult> {
  return iyzicoPost<CheckoutFormInitResult>('/payment/iyzi-pos/checkoutform/initialize/auth/ecom', request)
}

/** Checkout sonucu sorgular */
export function retrieveCheckoutForm(token: string): Promise<CheckoutFormRetrieveResult> {
  return iyzicoPost<CheckoutFormRetrieveResult>('/payment/iyzi-pos/checkoutform/auth/ecom/detail', { token })
}

/**
 * Iyzico callback token'ını doğrular — callback verisine doğrudan güvenmek yerine
 * Iyzico API'sine sorgu atarak ödeme durumunu sunucu taraflı doğrular.
 * Bu, sahte callback isteklerine karşı koruma sağlar.
 */
export async function verifyIyzicoCallback(token: string): Promise<{ status: string; paymentId: string | null }> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { status: 'failure', paymentId: null }
  }

  try {
    const result = await retrieveCheckoutForm(token)

    if (result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
      return {
        status: 'failure',
        paymentId: result.paymentId ?? null,
      }
    }

    return {
      status: 'success',
      paymentId: result.paymentId ?? null,
    }
  } catch {
    return { status: 'failure', paymentId: null }
  }
}

/** Fatura numarası üretici: INV-2026-000001 formatı */
export function generateInvoiceNumber(sequence: number): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequence).padStart(6, '0')}`
}
