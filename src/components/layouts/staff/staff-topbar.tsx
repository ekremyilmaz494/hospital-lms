'use client';

import { AdminTopbar } from '@/components/layouts/admin/admin-topbar';

interface StaffTopbarProps {
  title?: string;
  orgName?: string;
  onToggleSidebar?: () => void;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

export function StaffTopbar(props: StaffTopbarProps) {
  return <AdminTopbar {...props} />;
}
