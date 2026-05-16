'use client';

import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, logout } = useAuthStore();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  return {
    user,
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isStaff,
    fullName,
    initials,
    setUser,
    logout,
  };
}
