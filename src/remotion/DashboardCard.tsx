import type { CSSProperties, ReactNode } from "react";

interface DashboardCardProps {
  progress: number;
  style?: CSSProperties;
  children: ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ style, children }) => {
  return <div style={style}>{children}</div>;
};
