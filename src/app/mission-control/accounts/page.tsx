"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Instagram, Facebook, Linkedin, Twitter, Trash2, RefreshCw, Plus, CheckCircle, Info } from "lucide-react";
import Link from "next/link";

interface SocialAccount {
  id: string;
  platform: string;
  platformUsername: string;
  isActive: boolean;
  createdAt: string;
}

const PLATFORM_INFO: Record<string, { icon: any; color: string; name: string }> = {
  INSTAGRAM: { icon: Instagram, color: "text-pink-500", name: "Instagram" },
  FACEBOOK: { icon: Facebook, color: "text-blue-600", name: "Facebook" },
  LINKEDIN: { icon: Linkedin, color: "text-blue-700", name: "LinkedIn" },
  TWITTER: { icon: Twitter, color: "text-sky-500", name: "Twitter" },
  TIKTOK: { icon: CheckCircle, color: "text-black", name: "TikTok" },
};

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const supabase = await createClient();
    
    // Get user's organization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      setLoading(false);
      return;
    }

    // Load social accounts
    const { data } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("organization_id", orgMember.organization_id)
      .order("createdAt", { ascending: false });

    setAccounts(data || []);
    setLoading(false);
  }

  async function connectAccount(platform: string) {
    setConnecting(platform);
    
    // Get organization ID for OAuth state
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      setConnecting(null);
      return;
    }

    // Build OAuth URL based on platform
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
    const state = JSON.stringify({ orgId: orgMember.organization_id, userId: user.id });
    const encodedState = Buffer.from(state).toString("base64");

    let oauthUrl = "";
    switch (platform) {
      case "INSTAGRAM":
      case "FACEBOOK":
        oauthUrl = `${baseUrl}/api/oauth/meta?state=${encodedState}`;
        break;
      case "LINKEDIN":
        oauthUrl = `${baseUrl}/api/oauth/linkedin?state=${encodedState}`;
        break;
      case "TWITTER":
        oauthUrl = `${baseUrl}/api/oauth/twitter?state=${encodedState}`;
        break;
      case "TIKTOK":
        oauthUrl = `${baseUrl}/api/oauth/tiktok?state=${encodedState}`;
        break;
    }

    if (oauthUrl) {
      window.location.href = oauthUrl;
    } else {
      setConnecting(null);
    }
  }

  async function disconnectAccount(accountId: string) {
    const supabase = await createClient();
    
    await supabase
      .from("social_accounts")
      .update({ isActive: false })
      .eq("id", accountId);

    loadAccounts();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/mission-control">
            <Button variant="ghost" size="sm">
              ← Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const availablePlatforms = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TWITTER", "TIKTOK"];
  const connectedPlatforms = accounts.map((a: SocialAccount) => a.platform);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/mission-control">
          <Button variant="ghost" size="sm">
            ← Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Connected Accounts
          </h1>
          <p className="text-muted-foreground">
            Manage your connected social media accounts
          </p>
        </div>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts.map((account: SocialAccount) => {
              const info = PLATFORM_INFO[account.platform];
              const Icon = info?.icon || Link2;
              
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center ${info?.color || ""}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {info?.name || account.platform}
                        {account.platformUsername && (
                          <span className="text-muted-foreground"> @{account.platformUsername}</span>
                        )}
                      </p>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectAccount(account.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle>Connect New Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlatforms.map((platform) => {
              const info = PLATFORM_INFO[platform];
              const Icon = info?.icon || Link2;
              const isConnected = connectedPlatforms.includes(platform);
              const isConnecting = connecting === platform;

              return (
                <div
                  key={platform}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${info?.color || ""}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{info?.name || platform}</span>
                  </div>
                  <Button
                    variant={isConnected ? "secondary" : "default"}
                    size="sm"
                    onClick={() => !isConnected && connectAccount(platform)}
                    disabled={isConnected || isConnecting}
                  >
                    {isConnecting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : isConnected ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {availablePlatforms.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2" />
              <p>No platforms available for connection</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {accounts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No accounts connected</p>
            <p className="text-muted-foreground">
              Connect your social media accounts to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
