/**
 * IP allowlist (CIDR) eşleştirme.
 *
 * Org `ipAllowlistEnabled` ise yalnız listedeki IPv4/CIDR veya tam IP girdileriyle
 * eşleşen IP'lerden GİRİŞE izin verilir (enforcement login route'unda — middleware'e
 * her istekte DB sorgusu eklememek için). Liste açık ama boşsa kimse giremez (güvenli taraf).
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = (n << 8) | o
  }
  return n >>> 0
}

/** IPv4-mapped IPv6 (::ffff:1.2.3.4) önekini soyar. */
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

/** Tek bir IP, verilen CIDR veya tam-IP girdisiyle eşleşiyor mu? */
export function matchIpEntry(ip: string, entry: string): boolean {
  const e = entry.trim()
  if (!e) return false
  const target = normalizeIp(ip)

  if (e.includes('/')) {
    const [range, bitsStr] = e.split('/')
    const bits = Number(bitsStr)
    const ipInt = ipv4ToInt(target)
    const rangeInt = ipv4ToInt(range)
    if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false
    }
    if (bits === 0) return true
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
    return (ipInt & mask) === (rangeInt & mask)
  }

  // Tam eşleşme (IPv4 veya IPv6 string)
  return target === normalizeIp(e)
}

/** Bir allowlist girdisi (tam IPv4, IPv4 CIDR, veya basit IPv6) geçerli mi? */
export function isValidIpEntry(entry: string): boolean {
  const e = entry.trim()
  if (!e) return false
  if (e.includes('/')) {
    const [range, bitsStr] = e.split('/')
    const bits = Number(bitsStr)
    return ipv4ToInt(range) !== null && Number.isInteger(bits) && bits >= 0 && bits <= 32
  }
  // Tam IPv4 ya da içinde ':' geçen IPv6 (basit kabul)
  return ipv4ToInt(normalizeIp(e)) !== null || e.includes(':')
}

/**
 * `ip`, allowlist'teki herhangi bir girdiyle eşleşiyor mu?
 * - ip yoksa → false (güvenli taraf)
 * - liste boşsa → false (allowlist açık ama boş = kimse giremez)
 */
export function isIpAllowed(ip: string | null | undefined, allowlist: unknown): boolean {
  if (!ip) return false
  const list = Array.isArray(allowlist)
    ? allowlist.filter((x): x is string => typeof x === 'string')
    : []
  if (list.length === 0) return false
  return list.some((entry) => matchIpEntry(ip, entry))
}
