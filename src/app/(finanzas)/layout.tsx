import { BottomNav, TopNav } from "@/components/Nav";

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
      <BottomNav />
    </>
  );
}
