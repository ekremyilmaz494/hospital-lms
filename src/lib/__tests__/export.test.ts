import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for src/lib/export.ts
 *
 * exportExcel and exportPDF run in browser context with DOM APIs.
 * We test error cases directly and mock DOM for happy-path CSV generation.
 */

// Mock jsPDF before importing the module
vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      setFontSize = vi.fn()
      text = vi.fn()
      save = vi.fn()
    },
  }
})

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}))

import { exportExcel, exportPDF } from '../export'
import type { ReportData } from '../export'

describe('exportExcel', () => {
  describe('error cases', () => {
    it('throws when reportData is undefined', () => {
      expect(() => exportExcel(undefined)).toThrow('Dışa aktarılacak veri bulunamadı.')
    })

    it('throws when reportData is empty object', () => {
      expect(() => exportExcel({} as ReportData)).toThrow('Dışa aktarılacak veri bulunamadı.')
    })

    it('throws when rows is empty array', () => {
      expect(() => exportExcel({ headers: ['Ad'], rows: [] })).toThrow(
        'Dışa aktarılacak veri bulunamadı.'
      )
    })

    it('throws when headers is missing', () => {
      expect(() => exportExcel({ rows: [['test']] } as ReportData)).toThrow(
        'Dışa aktarılacak veri bulunamadı.'
      )
    })

    it('throws when rows is missing', () => {
      expect(() => exportExcel({ headers: ['Ad'] } as ReportData)).toThrow(
        'Dışa aktarılacak veri bulunamadı.'
      )
    })
  })

  describe('happy path with DOM mocks', () => {
    let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> }
    let appendChildSpy: ReturnType<typeof vi.fn>
    let removeChildSpy: ReturnType<typeof vi.fn>
    let createObjectURLSpy: ReturnType<typeof vi.fn>
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>
    let capturedBlob: Blob | null

    beforeEach(() => {
      mockLink = { href: '', download: '', click: vi.fn() }
      appendChildSpy = vi.fn()
      removeChildSpy = vi.fn()
      capturedBlob = null

      createObjectURLSpy = vi.fn((blob: Blob) => {
        capturedBlob = blob
        return 'blob:mock-url'
      })
      revokeObjectURLSpy = vi.fn()

      vi.stubGlobal('document', {
        createElement: vi.fn(() => mockLink),
        body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
      })
      vi.stubGlobal('URL', {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      })
      vi.stubGlobal('Blob', class MockBlob {
        parts: (string | ArrayBuffer)[]
        options: BlobPropertyBag
        constructor(parts: (string | ArrayBuffer)[], options: BlobPropertyBag = {}) {
          this.parts = parts
          this.options = options
        }
        async text() {
          return this.parts.join('')
        }
      })
    })

    it('creates a downloadable CSV link and clicks it', () => {
      const reportData: ReportData = {
        headers: ['Ad', 'Soyad'],
        rows: [['Ahmet', 'Yilmaz'], ['Ayse', 'Demir']],
      }

      exportExcel(reportData)

      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      expect(mockLink.click).toHaveBeenCalledOnce()
      expect(mockLink.download).toMatch(/^rapor-\d{4}-\d{2}-\d{2}\.csv$/)
      expect(appendChildSpy).toHaveBeenCalledOnce()
      expect(removeChildSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
    })

    it('includes BOM and properly formatted CSV content', async () => {
      const reportData: ReportData = {
        headers: ['Baslik'],
        rows: [['Veri1']],
      }

      exportExcel(reportData)

      expect(capturedBlob).not.toBeNull()
      const text = await (capturedBlob as unknown as { text: () => Promise<string> }).text()
      // BOM character at the start
      expect(text.charCodeAt(0)).toBe(0xFEFF)
      // Headers present (headers are plain, not wrapped in csvCell)
      expect(text).toContain('Baslik')
      // Row data is wrapped in quotes by csvCell
      expect(text).toContain('"Veri1"')
    })

    it('sanitizes cell values with dangerous characters', async () => {
      const reportData: ReportData = {
        headers: ['Formul'],
        rows: [['=SUM(A1:A10)'], ['+cmd'], ['-exploit'], ['@mention']],
      }

      exportExcel(reportData)

      expect(capturedBlob).not.toBeNull()
      const text = await (capturedBlob as unknown as { text: () => Promise<string> }).text()
      // Dangerous values should be prefixed with single quote
      expect(text).toContain("'=SUM(A1:A10)")
      expect(text).toContain("'+cmd")
      expect(text).toContain("'-exploit")
      expect(text).toContain("'@mention")
    })

    it('handles null and undefined cell values', async () => {
      const reportData: ReportData = {
        headers: ['Deger'],
        rows: [[null], [undefined]],
      }

      exportExcel(reportData)

      expect(capturedBlob).not.toBeNull()
      const text = await (capturedBlob as unknown as { text: () => Promise<string> }).text()
      // null/undefined become empty strings wrapped in quotes
      expect(text).toContain('""')
    })
  })
})

describe('exportPDF', () => {
  describe('error cases', () => {
    it('throws when reportData is undefined', () => {
      expect(() => exportPDF(undefined)).toThrow('Dışa aktarılacak veri bulunamadı.')
    })

    it('throws when reportData is empty object', () => {
      expect(() => exportPDF({} as ReportData)).toThrow('Dışa aktarılacak veri bulunamadı.')
    })

    it('throws when rows is empty array', () => {
      expect(() => exportPDF({ headers: ['Ad'], rows: [] })).toThrow(
        'Dışa aktarılacak veri bulunamadı.'
      )
    })

    it('throws when headers is missing', () => {
      expect(() => exportPDF({ rows: [['test']] } as ReportData)).toThrow(
        'Dışa aktarılacak veri bulunamadı.'
      )
    })
  })

  describe('happy path', () => {
    it('generates PDF without throwing', () => {
      const reportData: ReportData = {
        headers: ['Ad', 'Soyad'],
        rows: [['Ahmet', 'Yilmaz']],
      }

      expect(() => exportPDF(reportData, 'Test Raporu')).not.toThrow()
    })

    it('generates PDF with default title when not provided', () => {
      const reportData: ReportData = {
        headers: ['Ad'],
        rows: [['Test']],
      }

      expect(() => exportPDF(reportData)).not.toThrow()
    })
  })
})
