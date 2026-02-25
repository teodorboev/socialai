import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Instagram, Facebook, Linkedin, Twitter, Trash2, RefreshCw, Music2 } from "lucide-react";
import Link from "next/link";

const platformIcons: Record<string, typeof Instagram> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
  TIKTOK: Music2,
};

export default async function AccountsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) {
    redirect("/onboarding");
  }

  const orgId = orgMember.organization_id;

  // Get connected accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("organization_id", orgId);

  const availablePlatforms = [
    { id: "INSTAGRAM", name: "Instagram", icon: Instagram, color: "bg-pink-600" },
    { id: "FACEBOOK", name: "Facebook", icon: Facebook, color: "bg-blue-600" },
    { id: "TIKTOK", name: "TikTok", icon: Music2, color: "bg-black" },
    { id: "TWITTER", name: "X (Twitter)", icon: Twitter, color: "bg-gray-900" },
    { id: "LINKEDIN", name: "LinkedIn", icon: Linkedin, color: "bg-blue-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Connected Accounts</h1>
        <p className="text-muted-foreground">Manage your social media account connections</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Available platforms to connect */}
        {availablePlatforms.map((platform) => {
          const Icon = platform.icon;
          const isConnected = accounts?.some((a) => a.platform === platform.id);

          return (
            <Card key={platform.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${platform.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg">{platform.name}</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  {isConnected
                    ? "Account connected"
                    : "Connect your account to start publishing"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Connected
                    </Badge>
                  </div>
                ) : (
                  <Link href={`/api/oauth/${platform.id.toLowerCase()}`}>
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Connect {platform.name}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connected accounts list */}
      {accounts && accounts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <div className="space-y-2">
            {accounts.map((account) => {
              const Icon = platformIcons[account.platform] || Instagram;
              return (
                <Card key={account.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {account.platformUsername || account.platformUserId}
                          </p>
                          <p className="text-sm text-muted-foreground">{account.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="ghost" size="icon">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {(!accounts || accounts.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Instagram className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No accounts connected yet</p>
            <p className="text-sm">Connect an account above to start publishing</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
