import { describe, it, expect } from 'vitest'
import { parseCsv } from '../csv'

/**
 * parseCsv — bağımlılıksız CSV parser testleri.
 *
 * Kilitlenen davranışlar: tırnaklı alan, çift-tırnak escape, CRLF/LF/CR,
 * `;` ayırıcı tespiti (Türkçe Excel), BOM toleransı, boş satır atlama,
 * tek kolon, tırnak içi satır sonu + fiziksel satır numarası takibi.
 */

describe('parseCsv — temel ayrıştırma', () => {
  it('virgül ayırıcılı basit dosya: başlık + veri satırları', () => {
    const result = parseCsv('Ad,Soyad,E-posta\nAyşe,Yılmaz,ayse@example.com\nAli,Kaya,ali@example.com\n')
    expect(result.delimiter).toBe(',')
    expect(result.headers).toEqual(['Ad', 'Soyad', 'E-posta'])
    expect(result.rows).toEqual([
      { cells: ['Ayşe', 'Yılmaz', 'ayse@example.com'], line: 2 },
      { cells: ['Ali', 'Kaya', 'ali@example.com'], line: 3 },
    ])
  })

  it('son satırda satır sonu olmasa da kayıt işlenir', () => {
    const result = parseCsv('a,b\n1,2')
    expect(result.rows).toEqual([{ cells: ['1', '2'], line: 2 }])
  })

  it('satır sonu delimiter ile bitiyorsa boş hücre üretilir', () => {
    const result = parseCsv('a,b\n1,\n')
    expect(result.rows[0].cells).toEqual(['1', ''])
  })

  it('boş girdi → boş sonuç', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [], delimiter: ',' })
  })

  it('yalnız başlık satırı → rows boş', () => {
    const result = parseCsv('Ad,Soyad\n')
    expect(result.headers).toEqual(['Ad', 'Soyad'])
    expect(result.rows).toEqual([])
  })
})

describe('parseCsv — tırnaklı alanlar', () => {
  it('tırnak içindeki ayırıcı alanı bölmez', () => {
    const result = parseCsv('a,b\n"x,y",z\n')
    expect(result.rows[0].cells).toEqual(['x,y', 'z'])
  })

  it('çift-tırnak escape: "" → "', () => {
    const result = parseCsv('h1,h2\n"say ""merhaba""",son\n')
    expect(result.rows[0].cells).toEqual(['say "merhaba"', 'son'])
  })

  it('tırnak içindeki satır sonu alanı bölmez, satır numarası fiziksel kalır', () => {
    const result = parseCsv('a,b\n"çok\nsatırlı",x\nsonraki,y\n')
    expect(result.rows).toEqual([
      { cells: ['çok\nsatırlı', 'x'], line: 2 },
      // Tırnak içindeki \n fiziksel bir satırdır → sonraki kayıt 4. satırda.
      { cells: ['sonraki', 'y'], line: 4 },
    ])
  })

  it('hücre ortasındaki kaçışsız tırnak literal kabul edilir (tolerans)', () => {
    const result = parseCsv('a,b\n5"30,x\n')
    expect(result.rows[0].cells).toEqual(['5"30', 'x'])
  })
})

describe('parseCsv — satır sonları', () => {
  it('CRLF satır sonları', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4\r\n')
    expect(result.rows).toEqual([
      { cells: ['1', '2'], line: 2 },
      { cells: ['3', '4'], line: 3 },
    ])
  })

  it('yalnız CR satır sonları (eski Mac) da çalışır', () => {
    const result = parseCsv('a,b\r1,2\r3,4')
    expect(result.rows).toEqual([
      { cells: ['1', '2'], line: 2 },
      { cells: ['3', '4'], line: 3 },
    ])
  })
})

describe('parseCsv — `;` ayırıcı (Türkçe Excel)', () => {
  it('başlıkta `;` sayısı `,`den çoksa ayırıcı `;` olur', () => {
    const result = parseCsv('Ad;Soyad;E-posta\nAli;Veli;a@b.co\n')
    expect(result.delimiter).toBe(';')
    expect(result.headers).toEqual(['Ad', 'Soyad', 'E-posta'])
    expect(result.rows[0].cells).toEqual(['Ali', 'Veli', 'a@b.co'])
  })

  it('`;` ayırıcıda tırnaksız virgül hücre içeriği olarak kalır', () => {
    const result = parseCsv('Ad;Açıklama\nAli;merhaba, dünya\n')
    expect(result.rows[0].cells).toEqual(['Ali', 'merhaba, dünya'])
  })

  it('`;` sayısı `,`den çok DEĞİLSE ayırıcı `,` kalır', () => {
    const result = parseCsv('a,b;c\n1,2\n')
    expect(result.delimiter).toBe(',')
    expect(result.headers).toEqual(['a', 'b;c'])
  })
})

describe('parseCsv — BOM ve boş satırlar', () => {
  it('UTF-8 BOM ilk başlıktan sökülür', () => {
    const result = parseCsv('\uFEFF' + 'Ad,Soyad\nAli,Veli\n')
    expect(result.headers).toEqual(['Ad', 'Soyad'])
  })

  it('boş ve yalnız-boşluk satırlar atlanır; satır numaraları fiziksel kalır', () => {
    const result = parseCsv('a,b\n\n1,2\n   \n3,4\n\n')
    expect(result.rows).toEqual([
      { cells: ['1', '2'], line: 3 },
      { cells: ['3', '4'], line: 5 },
    ])
  })

  it('yalnız ayırıcılardan oluşan satır (,,,) boş kayıt sayılır ve atlanır', () => {
    const result = parseCsv('a,b\n,,\n1,2\n')
    expect(result.rows).toEqual([{ cells: ['1', '2'], line: 3 }])
  })
})

describe('parseCsv — tek kolon', () => {
  it('ayırıcı içermeyen dosya tek kolonlu ayrıştırılır', () => {
    const result = parseCsv('Ad\nAli\nVeli\n')
    expect(result.delimiter).toBe(',')
    expect(result.headers).toEqual(['Ad'])
    expect(result.rows).toEqual([
      { cells: ['Ali'], line: 2 },
      { cells: ['Veli'], line: 3 },
    ])
  })
})
