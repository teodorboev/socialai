"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Server,
  FileText,
  Flag,
  Shield,
  Mail,
  LayoutDashboard,
  Settings as SettingsIcon,
  AlertTriangle,
  CreditCard,
  Users,
  Receipt,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
];

const billingNav = [
  { name: "Plans", href: "/admin/billing/plans", icon: CreditCard },
  { name: "Clients", href: "/admin/billing/clients", icon: Users },
  { name: "Events", href: "/admin/billing/events", icon: Receipt },
  { name: "Usage", href: "/admin/billing/usage", icon: BarChart3 },
];

const systemNav = [
  { name: "Platforms", href: "/admin/platforms", icon: Server },
  { name: "Prompts", href: "/admin/prompts", icon: FileText },
  { name: "Feature Flags", href: "/admin/flags", icon: Flag },
  { name: "Safety", href: "/admin/safety", icon: Shield },
  { name: "Escalations", href: "/admin/escalations", icon: AlertTriangle },
  { name: "Emails", href: "/admin/emails", icon: Mail },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b bg-white px-6">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <span className="font-semibold">Admin</span>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto bg-white border-r">
          <nav className="flex flex-1 flex-col gap-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Billing Section */}
            <div className="pt-4 pb-2">
              <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Billing
              </div>
            </div>
            {billingNav.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* System Section */}
            <div className="pt-4 pb-2">
              <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                System
              </div>
            </div>
            {systemNav.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="py-8 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
