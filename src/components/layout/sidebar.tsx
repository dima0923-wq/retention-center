"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  Mail,
  Plug,
  BarChart3,
  GraduationCap,
  Target,
  FlaskConical,
  Palette,
  Globe,
  GitBranch,
  LogOut,
  Bot,
  Phone,
  Headphones,
  MessageSquare,
  MailOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/lib/user-context";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Sequences", href: "/sequences", icon: GitBranch },
  { label: "Scripts", href: "/scripts", icon: FileText },
  { label: "Email Templates", href: "/email-templates", icon: Mail },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Send a test", href: "/test-send", icon: FlaskConical },
  { label: "Call History", href: "/calls", icon: Phone },
  { label: "VAPI Dashboard", href: "/vapi-calls", icon: Headphones },
  { label: "SMS Stats", href: "/sms-stats", icon: MessageSquare },
  { label: "Email Stats", href: "/email-stats", icon: MailOpen },
  { label: "Conversions", href: "/conversions", icon: Target },
  { label: "Learning", href: "/learning", icon: GraduationCap },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useUser();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4">
        <img src="/favicon.ico" alt="RC" className="h-8 w-8 shrink-0 rounded-md" />
        <span className="text-sm font-semibold text-sidebar-foreground truncate">
          Retention Center
        </span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* External links */}
      <div className="px-2 pb-3 space-y-1">
        <Separator className="mb-3" />
        <a
          href="https://ag1.q37fh758g.click/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Palette className="h-4 w-4 shrink-0" />
          <span className="truncate">Creative Center</span>
        </a>
        <a
          href="https://ag3.q37fh758g.click/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="truncate">Traffic Center</span>
        </a>
        <a
          href="https://ag5.q37fh758g.click/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span className="truncate">Hermes</span>
        </a>
      </div>

      {/* User info */}
      {user && (
        <>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-3">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.firstName}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
                {user.firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.firstName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
                {user.role}
              </p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
