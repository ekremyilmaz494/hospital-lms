'use client';

/**
 * Idle timeout geçici olarak devre dışı bırakıldı (2026-04-19).
 *
 * Sebep: "Bu cihazda oturumumu açık tut (7 gün)" butonu ile idle timeout
 * birbirinden habersiz çalışıyordu — kullanıcı 7 gün seçse bile ~30 dk
 * sonra uyarı çıkıyor ve logout oluyordu. KVKK/sağlık bağlamında idle
 * timeout ileride tekrar eklenecek; şimdilik sadece Supabase cookie ömrü
 * oturumu yönetiyor.
 *
 * Not: Bu provider'ı kaldırmak yerine pass-through yaptık ki layout.tsx'i
 * değiştirmeyelim ve ileride geri açmak kolay olsun.
 */
export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
