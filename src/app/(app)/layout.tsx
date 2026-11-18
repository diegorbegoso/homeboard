import type { ReactNode } from "react";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <main className="mx-auto w-full max-w-[640px] px-4 pt-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
