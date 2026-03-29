import crypto from 'crypto'

const API_KEY = process.env.IYZICO_API_KEY ?? ''
const SECRET_KEY = process.env.IYZICO_SECRET_KEY ?? ''
const BASE_URL = process.env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com'

/** Iyzico API imzası oluşturur */
function generateAuthorizationHeader(requestBody: string): string {
  const randomString = crypto.randomBytes(8).toString('hex')
  const hashStr = API_KEY + randomString + SECRET_KEY + requestBody
  const hash = crypto.createHash('sha1').update(hashStr).digest('base64')
  const authHeader = `IYZWS ${API_KEY}:${hash}`
  return authHeader
}

/** Iyzico'ya HTTP POST isteği gönderir */
async function iyzicoPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const authorization = generateAuthorizationHeader(bodyStr)

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'x-iyzi-rnd': crypto.randomBytes(8).toString('hex'),
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

/** Fatura numarası üretici: INV-2026-000001 formatı */
export function generateInvoiceNumber(sequence: number): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequence).padStart(6, '0')}`
}
