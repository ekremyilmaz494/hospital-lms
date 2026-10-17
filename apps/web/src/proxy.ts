import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { extractSubdomain } from '@/lib/organization-utils'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  // Kurum alt alan adları (devakent.klinovax.com) ana sitenin kopyası gibi
  // indekslenmesin. Host'a bağlı olduğu için statik sayfa metadata'sıyla yapılamaz.
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''
  if (baseDomain && extractSubdomain(request.headers.get('host') || '', baseDomain)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Static dosyalar ve internal Next.js route'larını hariç tut.
     * Bu route'larda proxy çalışmasına gerek yok.
     */
    // sw.js exclude'u kritik: middleware bu dosyayı intercept ederse /auth/login'e
    // redirect ediyor → tarayıcı kill-switch SW'i güncelleyemiyor → eski stale SW
    // sonsuza dek aktif kalıyor. Static asset olarak doğrudan serve edilmeli.
    // .txt/.xml: IndexNow anahtar dosyası + bölünmüş sitemap'ler login'e düşmesin.
    // _vercel/: Vercel Analytics/Speed Insights script'leri. monitoring: Sentry tunnel
    // (next.config tunnelRoute) — oturumsuz ziyaretçinin istemci hataları da Sentry'ye ulaşsın.
    '/((?!_next/|__nextjs/|_vercel/|monitoring(?:/|$)|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|sw\\.js|.*\\.(?:txt|xml|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|mp4|webm|mp3|wav|pdf|glb|gltf)$).*)',
  ],
}
