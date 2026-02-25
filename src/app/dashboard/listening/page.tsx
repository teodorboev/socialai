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
import { Plus, Search, Trash2, Hash, AtSign, Building2, TrendingUp, ToggleLeft, ToggleRight } from "lucide-react";

interface ListeningKeyword {
  id: string;
  keyword: string;
  type: string;
  is_enabled: boolean;
}

const KEYWORD_TYPES = [
  { value: "brand", label: "Brand", icon: AtSign, description: "Your brand name and variations" },
  { value: "industry", label: "Industry", icon: TrendingUp, description: "Industry-related terms" },
  { value: "competitor", label: "Competitor", icon: Building2, description: "Competitor names" },
  { value: "hashtag", label: "Hashtag", icon: Hash, description: "Relevant hashtags" },
];

export default function ListeningPage() {
  const [keywords, setKeywords] = useState<ListeningKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ keyword: "", type: "brand" });
  const supabase = createClient();

  useEffect(() => {
    loadKeywords();
  }, []);

  async function loadKeywords() {
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

    const { data: keywordsData } = await supabase
      .from("listening_keywords")
      .select("*")
      .eq("organization_id", orgMember.organization_id)
      .order("created_at", { ascending: false });

    setKeywords(keywordsData || []);
    setLoading(false);
  }

  async function addKeyword() {
    if (!newKeyword.keyword.trim()) {
      toast.error("Please enter a keyword");
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

    const { error } = await supabase.from("listening_keywords").insert({
      organization_id: orgMember.organization_id,
      keyword: newKeyword.keyword,
      type: newKeyword.type,
    });

    if (error) {
      toast.error("Failed to add keyword");
    } else {
      toast.success("Keyword added");
      setIsAddOpen(false);
      setNewKeyword({ keyword: "", type: "brand" });
      loadKeywords();
    }
  }

  async function toggleKeyword(id: string, isEnabled: boolean) {
    const { error } = await supabase
      .from("listening_keywords")
      .update({ is_enabled: !isEnabled })
      .eq("id", id);

    if (!error) {
      loadKeywords();
    }
  }

  async function deleteKeyword(id: string) {
    const { error } = await supabase.from("listening_keywords").delete().eq("id", id);
    if (!error) {
      toast.success("Keyword deleted");
      loadKeywords();
    }
  }

  const filteredKeywords = keywords.filter(k =>
    k.keyword.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    const typeInfo = KEYWORD_TYPES.find(t => t.value === type);
    return typeInfo?.icon || Hash;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      brand: "bg-blue-500",
      industry: "bg-green-500",
      competitor: "bg-purple-500",
      hashtag: "bg-pink-500",
    };
    return colors[type] || "bg-gray-500";
  };

  const keywordsByType = KEYWORD_TYPES.map(type => ({
    ...type,
    keywords: filteredKeywords.filter(k => k.type === type.value)
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-3xl font-bold">Social Listening</h1>
          <p className="text-muted-foreground">Monitor brand mentions and industry conversations</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Keyword
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tracking Keyword</DialogTitle>
              <DialogDescription>
                Add a keyword to monitor across social platforms
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  value={newKeyword.keyword}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  placeholder="e.g., your brand name"
                />
              </div>
              <div>
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {KEYWORD_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <Button
                        key={type.value}
                        variant={newKeyword.type === type.value ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => setNewKeyword({ ...newKeyword, type: type.value })}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {type.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Button onClick={addKeyword} className="w-full">Add Keyword</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{keywords.length} keywords</Badge>
      </div>

      {keywords.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No keywords configured</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add keywords to start monitoring brand mentions and conversations
              </p>
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Keyword
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {keywordsByType.map((typeGroup) => {
            const Icon = typeGroup.icon;
            return (
              <Card key={typeGroup.value}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${getTypeColor(typeGroup.value)}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{typeGroup.label}</CardTitle>
                      <CardDescription>{typeGroup.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {typeGroup.keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No keywords</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {typeGroup.keywords.map((keyword) => (
                        <Badge
                          key={keyword.id}
                          variant="outline"
                          className="flex items-center gap-2 py-1.5"
                        >
                          <span>{keyword.keyword}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleKeyword(keyword.id, keyword.is_enabled)}
                              className="hover:opacity-70"
                            >
                              {keyword.is_enabled ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteKeyword(keyword.id)}
                              className="text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
