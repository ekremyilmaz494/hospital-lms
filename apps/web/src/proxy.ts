import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
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
    '/((?!_next/|__nextjs/|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|sw\\.js|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|mp4|webm|mp3|wav|pdf)$).*)',
  ],
}
