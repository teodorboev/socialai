"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  RealtimeNotifications,
} from "@/components/dashboard/realtime-notifications";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  MessageCircle,
  BarChart3,
  Users,
  Palette,
  Settings as SettingsIcon,
  AlertTriangle,
  Menu,
  LogOut,
  Sparkles,
  Search,
  Globe,
  UserPlus,
  DollarSign,
  UsersRound,
  Newspaper,
  TrendingUp,
  Target,
  FileSearch,
  Megaphone,
  Copy,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Content", href: "/dashboard/content", icon: FileText },
  { name: "Review", href: "/dashboard/review", icon: CheckSquare },
  { name: "Engagement", href: "/dashboard/engagement", icon: MessageCircle },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "ROI", href: "/dashboard/roi", icon: DollarSign },
  { name: "Accounts", href: "/dashboard/accounts", icon: Users },
  { name: "Brand", href: "/dashboard/brand", icon: Palette },
  { name: "Competitors", href: "/dashboard/competitors", icon: Search },
  { name: "Influencers", href: "/dashboard/influencers", icon: UserPlus },
  { name: "Community", href: "/dashboard/community", icon: UsersRound },
  { name: "PR & Media", href: "/dashboard/pr", icon: Newspaper },
  { name: "Localization", href: "/dashboard/localization", icon: Globe },
  { name: "Listening", href: "/dashboard/listening", icon: Search },
  { name: "Trends", href: "/dashboard/trends", icon: TrendingUp },
  { name: "Audience", href: "/dashboard/audience", icon: Target },
  { name: "SEO", href: "/dashboard/seo", icon: FileSearch },
  { name: "Ad Copy", href: "/dashboard/ad-copy", icon: Megaphone },
  { name: "Repurpose", href: "/dashboard/repurpose", icon: Copy },
  { name: "Escalations", href: "/dashboard/escalations", icon: AlertTriangle },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function getOrgId() {
      // Check sessionStorage first to avoid unnecessary calls
      const cachedSuperAdmin = sessionStorage.getItem("isSuperAdmin");
      const cachedOrgId = sessionStorage.getItem("orgId");

      if (cachedSuperAdmin !== null) {
        setIsSuperAdmin(cachedSuperAdmin === "true");
      }

      if (cachedOrgId !== null) {
        setOrgId(cachedOrgId);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Check if super admin
        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("id")
          .eq("user_id", user.id)
          .single();
        
        const isSA = !!superAdmin;
        setIsSuperAdmin(isSA);
        sessionStorage.setItem("isSuperAdmin", String(isSA));

        const { data: orgMember } = await supabase
          .from("org_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();
        if (orgMember) {
          setOrgId(orgMember.organization_id);
          sessionStorage.setItem("orgId", orgMember.organization_id);
        }
      }
    }
    getOrgId();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-semibold">SocialAI</span>
          </div>
          <SidebarContent pathname={pathname} onSignOut={handleSignOut} isSuperAdmin={isSuperAdmin} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b bg-white px-6">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-semibold">SocialAI</span>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto bg-white border-r">
          <SidebarContent pathname={pathname} onSignOut={handleSignOut} isSuperAdmin={isSuperAdmin} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center justify-end gap-4">
            {orgId && <RealtimeNotifications organizationId={orgId} />}
          </div>
        </header>
        
        <main className="py-8 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onSignOut,
  isSuperAdmin,
}: {
  pathname: string;
  onSignOut: () => void;
  isSuperAdmin?: boolean;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
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

      {/* Admin link - only visible to super admins */}
      {isSuperAdmin && (
        <>
          <div className="mt-4 pt-4 border-t">
            <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              System
            </div>
          </div>
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/admin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Shield className="h-5 w-5" />
            Admin
          </Link>
        </>
      )}

      <div className="mt-auto pt-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={onSignOut}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </Button>
      </div>
    </nav>
  );
}
