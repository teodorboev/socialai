"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2, ExternalLink, Users, BarChart3 } from "lucide-react";

interface Competitor {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
  }>;
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: "", website: "", industry: "" });
  const supabase = createClient();

  useEffect(() => {
    loadCompetitors();
  }, []);

  async function loadCompetitors() {
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

    const { data: competitorsData } = await supabase
      .from("competitors")
      .select("*, competitor_accounts(*)")
      .eq("organization_id", orgMember.organization_id)
      .order("created_at", { ascending: false });

    setCompetitors(competitorsData || []);
    setLoading(false);
  }

  async function addCompetitor() {
    if (!newCompetitor.name.trim()) {
      toast.error("Please enter a competitor name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) return;

    const { error } = await supabase.from("competitors").insert({
      organization_id: orgMember.organization_id,
      name: newCompetitor.name,
      website: newCompetitor.website || null,
      industry: newCompetitor.industry || null,
    });

    if (error) {
      toast.error("Failed to add competitor");
    } else {
      toast.success("Competitor added");
      setIsAddOpen(false);
      setNewCompetitor({ name: "", website: "", industry: "" });
      loadCompetitors();
    }
  }

  async function deleteCompetitor(id: string) {
    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete competitor");
    } else {
      toast.success("Competitor deleted");
      loadCompetitors();
    }
  }

  const filteredCompetitors = competitors.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      INSTAGRAM: "bg-pink-500",
      FACEBOOK: "bg-blue-600",
      TWITTER: "bg-black",
      TIKTOK: "bg-red-500",
      LINKEDIN: "bg-blue-700",
    };
    return colors[platform] || "bg-gray-500";
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
          <h1 className="text-3xl font-bold">Competitors</h1>
          <p className="text-muted-foreground">Track and analyze your competitors</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Competitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Competitor</DialogTitle>
              <DialogDescription>Track a competitor to monitor their social activity</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newCompetitor.name}
                  onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                  placeholder="Competitor name"
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newCompetitor.website}
                  onChange={(e) => setNewCompetitor({ ...newCompetitor, website: e.target.value })}
                  placeholder="https://competitor.com"
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={newCompetitor.industry}
                  onChange={(e) => setNewCompetitor({ ...newCompetitor, industry: e.target.value })}
                  placeholder="e.g., SaaS, E-commerce"
                />
              </div>
              <Button onClick={addCompetitor} className="w-full">Add Competitor</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search competitors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filteredCompetitors.length} competitors</Badge>
      </div>

      {filteredCompetitors.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No competitors yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first competitor to start tracking their social activity
              </p>
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompetitors.map((competitor) => (
            <Card key={competitor.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{competitor.name}</CardTitle>
                    {competitor.industry && (
                      <CardDescription>{competitor.industry}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    onClick={() => deleteCompetitor(competitor.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {competitor.website && (
                  <a
                    href={competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Website
                  </a>
                )}
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Social Accounts</p>
                  <div className="flex flex-wrap gap-2">
                    {competitor.accounts?.length > 0 ? (
                      competitor.accounts.map((account) => (
                        <Badge key={account.id} className={getPlatformColor(account.platform)}>
                          {account.platform}: {account.handle}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No accounts tracked</p>
                    )}
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
