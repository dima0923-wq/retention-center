"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebarStore } from "@/lib/sidebar-store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200",
          collapsed ? "pl-16" : "pl-60"
        )}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
