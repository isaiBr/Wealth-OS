import { BriefBottomNav, BriefTopNav } from "./BriefNav";

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BriefTopNav />
      {children}
      <BriefBottomNav />
    </>
  );
}
