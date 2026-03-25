import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    href?: string;
  };
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <h2
          className="text-[1.75rem] font-bold leading-tight tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          className="gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md"
          style={{
            background: 'var(--color-primary)',
            boxShadow: '0 4px 14px rgba(26, 107, 78, 0.25)',
            transition: 'background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(26, 107, 78, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(26, 107, 78, 0.25)';
          }}
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
