/**
 * SCORM paket dosyaları için uzantı → Content-Type eşlemesi.
 * Hem ingest (uploadBuffer ContentType'ı) hem serving (content route) kullanır.
 */
const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  js: 'application/javascript',
  mjs: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  swf: 'application/x-shockwave-flash',
  xsd: 'application/xml',
  dtd: 'application/xml-dtd',
  txt: 'text/plain',
  pdf: 'application/pdf',
}

/** Dosya yolundan uzantıya göre Content-Type döner (bilinmeyen → octet-stream). */
export function scormContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}
