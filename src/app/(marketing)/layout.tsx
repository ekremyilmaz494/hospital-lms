import { MarketingLayoutClient } from "./marketing-layout-client";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutClient>{children}</MarketingLayoutClient>;
}
