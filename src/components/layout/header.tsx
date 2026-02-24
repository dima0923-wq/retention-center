"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/campaigns": "Campaigns",
  "/scripts": "Scripts",
  "/integrations": "Integrations",
  "/conversions": "Conversions",
  "/learning": "Learning",
  "/reports": "Reports",
  "/test-send": "Test Send",
  "/sequences": "Sequences",
  "/email-templates": "Email Templates",
  "/email-stats": "Email Stats",
  "/sms-stats": "SMS Stats",
  "/calls": "Calls",
  "/vapi-calls": "VAPI Calls",
  "/pwa": "PWA",
  "/pwa/pushes": "Push Notifications",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (path !== "/" && pathname.startsWith(path)) return title;
  }
  return "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
