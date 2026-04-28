'use client';

import { memo } from 'react';
import { AdminSidebar } from '@/components/layouts/admin/admin-sidebar';
import type { NavGroup } from '@/components/layouts/sidebar/sidebar-config';

interface StaffSidebarProps {
  navGroups: NavGroup[];
  collapsed?: boolean;
  orgName?: string;
  orgCode?: string;
  orgLogoUrl?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  userInitials?: string;
}

export const StaffSidebar = memo(function StaffSidebar(props: StaffSidebarProps) {
  return <AdminSidebar {...props} />;
});
