/**
 * Role-to-path mapping helper.
 *
 * Farklı rollerin panel URL'lerini tek noktadan çözer. Login, topbar,
 * redirect guard gibi yerlerde tekrarlayan inline ternary'leri kaldırır.
 *
 * Mevcut davranıştan birebir mapping (değiştirmeyin):
 * - staff/settings → /staff/profile (staff için "ayarlar" profile sayfasıdır)
 * - super_admin/notifications → /admin/notifications (super-admin bildirimleri
 *   admin paneli altında görüntüler; ayrı bildirim sayfası yoktur)
 */

export type UserRole = 'super_admin' | 'admin' | 'staff';
export type RoleSection = 'dashboard' | 'settings' | 'notifications' | 'profile';

const ROLE_PATHS: Record<UserRole, Record<RoleSection, string>> = {
  super_admin: {
    dashboard: '/super-admin',
    settings: '/super-admin/settings',
    notifications: '/admin/notifications', // quirk: super-admin shares admin notifications
    profile: '/super-admin/settings',
  },
  admin: {
    dashboard: '/admin',
    settings: '/admin/settings',
    notifications: '/admin/notifications',
    profile: '/admin/settings',
  },
  staff: {
    dashboard: '/staff',
    settings: '/staff/profile', // quirk: staff'ın ayarları profile sayfasında
    notifications: '/staff/notifications',
    profile: '/staff/profile',
  },
};

/**
 * Verilen role ve mantıksal bölüme göre panel URL'ini döndürür.
 *
 * Tanınmayan veya undefined rol verilirse `staff` haritası kullanılır — bu,
 * inline ternary'lerin "else" dalı ile birebir aynı davranışı korur.
 *
 * @param role Kullanıcı rolü (super_admin | admin | staff)
 * @param section Mantıksal bölüm (dashboard | settings | notifications | profile)
 * @returns Panel URL'i (örn. `/admin/settings`)
 */
export function getRolePath(role: UserRole | string | undefined | null, section: RoleSection): string {
  const map = role && role in ROLE_PATHS ? ROLE_PATHS[role as UserRole] : ROLE_PATHS.staff;
  return map[section];
}
