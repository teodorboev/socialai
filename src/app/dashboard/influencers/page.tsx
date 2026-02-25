"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Search, Star, Mail, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface Influencer {
  id: string;
  name: string;
  handle: string;
  platform: string;
  followers: number;
  tier: string;
  authenticity_score: number;
  relevance_score: number;
  overall_fit_score: number;
  red_flags: string[];
  relationship: string;
  outreach_status: string;
}

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const supabase = createClient();

  useEffect(() => {
    loadInfluencers();
  }, []);

  async function loadInfluencers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
      return;
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      redirect("/onboarding");
      return;
    }

    const { data: influencersData } = await supabase
      .from("influencer_candidates")
      .select("*")
      .eq("organization_id", orgMember.organization_id)
      .order("overall_fit_score", { ascending: false });

    setInfluencers(influencersData || []);
    setLoading(false);
  }

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      nano: "bg-green-500",
      micro: "bg-blue-500",
      mid: "bg-purple-500",
      macro: "bg-orange-500",
      mega: "bg-red-500",
    };
    return colors[tier] || "bg-gray-500";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "partnered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "contacted":
        return <Mail className="h-4 w-4 text-blue-500" />;
      case "approved":
        return <Star className="h-4 w-4 text-yellow-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredInfluencers = influencers.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.handle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || i.tier === filter || i.outreach_status === filter;
    return matchesSearch && matchesFilter;
  });

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-500";
    if (score >= 0.4) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Influencers</h1>
          <p className="text-muted-foreground">Discover and manage influencer partnerships</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{influencers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {influencers.filter((i) => i.overall_fit_score >= 0.6).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Outreach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {influencers.filter((i) => i.outreach_status === "contacted").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Partnered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {influencers.filter((i) => i.outreach_status === "partnered").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search influencers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Tiers</option>
          <option value="nano">Nano</option>
          <option value="micro">Micro</option>
          <option value="mid">Mid</option>
          <option value="macro">Macro</option>
          <option value="identified">Identified</option>
          <option value="approved">Approved</option>
          <option value="contacted">Contacted</option>
        </select>
      </div>

      {filteredInfluencers.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No influencers found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The Influencer Scout agent will automatically find potential partners
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInfluencers.map((influencer) => (
            <Card key={influencer.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{influencer.name}</CardTitle>
                    <CardDescription>@{influencer.handle}</CardDescription>
                  </div>
                  <Badge className={getTierColor(influencer.tier)}>
                    {influencer.tier}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Followers</span>
                    <span className="font-medium">{influencer.followers.toLocaleString()}</span>
                  </div>
                  
                  {/* Scores */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Overall Fit</span>
                      <span className={getScoreColor(influencer.overall_fit_score)}>
                        {(influencer.overall_fit_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${influencer.overall_fit_score * 100}%` }} 
                      />
                    </div>
                  </div>

                  {influencer.red_flags && influencer.red_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {influencer.red_flags.slice(0, 2).map((flag, idx) => (
                        <Badge key={idx} variant="destructive" className="text-xs">
                          {flag}
                        </Badge>
                      ))}
                      {influencer.red_flags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{influencer.red_flags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {getStatusIcon(influencer.outreach_status)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {influencer.outreach_status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
