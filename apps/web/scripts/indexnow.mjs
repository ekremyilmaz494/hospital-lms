#!/usr/bin/env node
/**
 * IndexNow: canlı sitemap'teki URL'leri Bing/Yandex vb. arama motorlarına bildirir.
 * Dağıtımdan SONRA elle çalıştırılır (dış servise istek atar):
 *
 *   pnpm seo:indexnow            # yalnız listeler (kuru çalıştırma)
 *   pnpm seo:indexnow -- --send  # gerçekten gönderir
 *
 * Anahtar `public/<32 hex>.txt` dosyasıdır (içeriği dosya adıyla aynı). Anahtar
 * tasarım gereği herkese açıktır; gizli değildir. Proxy matcher `.txt`'yi login'e
 * yönlendirmez, `https://<domain>/<key>.txt` doğrudan 200 döner.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = process.env.NEXT_PUBLIC_BRAND_DOMAIN || 'klinovax.com'
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const send = process.argv.includes('--send')

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const keyFile = readdirSync(publicDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) throw new Error('public/ altında IndexNow anahtar dosyası (<32 hex>.txt) yok')
const key = keyFile.replace(/\.txt$/, '')
if (readFileSync(join(publicDir, keyFile), 'utf8').trim() !== key) {
  throw new Error(`${keyFile} içeriği dosya adıyla aynı olmalı`)
}

const sitemap = await fetch(`https://${HOST}/sitemap.xml`)
if (!sitemap.ok) throw new Error(`sitemap.xml alınamadı: HTTP ${sitemap.status}`)
const urlList = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (urlList.length === 0) throw new Error('sitemap.xml içinde <loc> bulunamadı')

const keyCheck = await fetch(`https://${HOST}/${keyFile}`)
if (!keyCheck.ok) throw new Error(`Anahtar dosyası canlıda erişilemiyor: HTTP ${keyCheck.status}`)

process.stdout.write(`${urlList.length} URL:\n${urlList.join('\n')}\n`)
if (!send) {
  process.stdout.write('\nKuru çalıştırma. Göndermek için: pnpm seo:indexnow -- --send\n')
  process.exit(0)
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
})
// 200/202 = kabul; 422 = URL'ler host ile uyuşmuyor; 403 = anahtar doğrulanamadı
process.stdout.write(`IndexNow yanıtı: HTTP ${res.status}\n`)
if (res.status !== 200 && res.status !== 202) process.exit(1)
