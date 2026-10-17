import { MarketingLayoutClient } from './marketing-layout-client';
// Pazarlama sayfaları ana landing ile aynı tasarım dilini (l3d-header/footer + --landing-* token) paylaşır.
import '@/app/landing-3d/landing-3d.css';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutClient>{children}</MarketingLayoutClient>;
}
