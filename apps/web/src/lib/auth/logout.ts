import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Tek noktadan oturum kapatma — TÜM "Çıkış" butonları bunu çağırmalı.
 *
 * Sıra önemli:
 * 1. Sunucu rotası (`/api/auth/logout`) ÖNCE — SSR cookie handler oturum
 *    çerezlerini KESİN siler (chunked `sb-<ref>-auth-token.0/.1` ve prod'daki
 *    `.klinovax.com` domain'li çerez dahil). Client `signOut()` tek başına ağ
 *    hatasında ("Failed to fetch") çerezi temizlemeden çıkabiliyor → middleware
 *    bayat çerezi görüp kullanıcıyı panele geri atıyordu.
 * 2. Client `signOut()` + store temizliği — yerel oturum durumu da sıfırlanır.
 * 3. `window.location.href` ile FULL reload — `router.push`'un soft-nav race'i
 *    yok; middleware temizlenmiş çerezle yeniden değerlendirir.
 *
 * Neden helper: Çıkış mantığı ayrı ayrı butonlara (admin/staff topbar, staff
 * sidebar, admin/staff mobil drawer) + idle-timeout callback'ine kopyalanmıştı;
 * topbar ve timeout kopyaları eski bozuk deseni kullandığı için çıkış çalışmıyordu.
 * Tek kaynak → drift'i ve "bir kopyayı atlama" hatasını engeller.
 *
 * @param redirectTo Çıkıştan sonra gidilecek yol (örn. oturum zaman aşımında
 *   `/auth/login?reason=timeout`). Varsayılan sade login sayfası.
 */
export async function performLogout(redirectTo: string = '/auth/login'): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ağ hatası olsa da çıkışa devam et
  }
  try {
    await createClient().auth.signOut();
  } catch {
    // Client signOut hatası yutulur — çerez zaten sunucuda silindi
  }
  useAuthStore.getState().setUser(null);
  // Full reload — middleware temiz çerezle değerlendirsin (router.push race'i yok)
  window.location.href = redirectTo;
}
