export interface Staff {
  id: string;
  name: string;
  email: string;
  department: string;
  departmentId: string | null;
  title: string;
  assignedTrainings: number;
  completedTrainings: number;
  avgScore: number;
  status: string;
  initials: string;
}

export interface Department {
  id: string;
  name: string;
  color: string;
  description: string;
  staffCount: number;
}

export interface StaffPageData {
  staff: Staff[];
  departments: Department[];
  stats: { totalStaff: number; activeStaff: number; departmentCount: number; avgScore: number };
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
