import { prisma } from '@/lib/prisma'

/**
 * Yeni fatura numarasi uretir.
 * Format: HLM-YYYY-NNNNN (ornek: HLM-2026-00001)
 * Transaction icinde kullanilmalidir — race condition onlemek icin.
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `HLM-${year}-`

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })

  const lastSeq = lastInvoice?.invoiceNumber
    ? parseInt(lastInvoice.invoiceNumber.split('-').pop() ?? '0', 10)
    : 0

  return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`
}

/**
 * Fatura tutarlarini hesaplar.
 * @param subtotal - KDV haric tutar
 * @param taxRate - KDV orani (varsayilan %20)
 * @returns taxAmount ve total
 */
export function calculateInvoice(
  subtotal: number,
  taxRate: number = 20
): { taxAmount: number; total: number } {
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  return { taxAmount, total }
}
