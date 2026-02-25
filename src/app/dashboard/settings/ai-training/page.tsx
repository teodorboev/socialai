"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Plus, 
  Trash2, 
  Star, 
  Bookmark, 
  TrendingUp,
  AlertCircle,
  Check,
  X,
  Loader2
} from "lucide-react";

interface Preference {
  id: string;
  rule: string;
  ruleType: string;
  agentName: string | null;
  platform: string | null;
  isActive: boolean;
  source: string;
  confidence: number;
}

interface Exemplar {
  id: string;
  content: string;
  agentName: string;
  platform: string | null;
  contentType: string | null;
  rating: number;
  source: string;
}

interface TrainingStats {
  totalFeedback: number;
  correctionsCount: number;
  activeRules: number;
  learnedPatternsCount: number;
  exemplarsCount: number;
  accuracy: number;
}

export default function AITrainingPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [saving, setSaving] = useState(false);

  // New preference form
  const [newRule, setNewRule] = useState("");
  const [newRuleType, setNewRuleType] = useState("prefer");
  const [newPlatform, setNewPlatform] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = await createClient();
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

    // Load training data via API
    try {
      const [statsRes, prefsRes, exemplarsRes] = await Promise.all([
        fetch("/api/training/stats"),
        fetch("/api/training/preferences"),
        fetch("/api/training/exemplars"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        setPreferences(prefsData.preferences || []);
      }

      if (exemplarsRes.ok) {
        const exemplarsData = await exemplarsRes.json();
        setExemplars(exemplarsData.exemplars || []);
      }
    } catch (error) {
      console.error("Error loading training data:", error);
    }

    setLoading(false);
  }

  async function handleAddPreference() {
    if (!newRule.trim()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/training/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "preference",
          rule: newRule,
          ruleType: newRuleType,
          platform: newPlatform === "all" ? null : newPlatform,
        }),
      });

      if (response.ok) {
        setNewRule("");
        loadData();
      }
    } catch (error) {
      console.error("Error adding preference:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePreference(id: string, currentActive: boolean) {
    try {
      await fetch(`/api/training/preferences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadData();
    } catch (error) {
      console.error("Error toggling preference:", error);
    }
  }

  async function handleDeletePreference(id: string) {
    try {
      await fetch(`/api/training/preferences/${id}`, { method: "DELETE" });
      loadData();
    } catch (error) {
      console.error("Error deleting preference:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          AI Training
        </h1>
        <p className="text-muted-foreground">
          Teach the AI your preferences. The longer you use it, the better it gets.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFeedback || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Corrections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.correctionsCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeRules || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.learnedPatternsCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exemplars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.exemplarsCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats?.accuracy || 0}%
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Explicit Rules</TabsTrigger>
          <TabsTrigger value="patterns">Learned Patterns</TabsTrigger>
          <TabsTrigger value="exemplars">Exemplar Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Rule</CardTitle>
              <CardDescription>
                Create explicit rules that the AI will always follow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-3 space-y-2">
                  <Label>Rule</Label>
                  <Input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="e.g., Never use emojis on LinkedIn"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newRuleType} onValueChange={setNewRuleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="prefer">Prefer</SelectItem>
                      <SelectItem value="avoid">Avoid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddPreference} disabled={saving || !newRule.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Rule
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Rules</CardTitle>
              <CardDescription>
                Your explicit preferences that the AI follows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {preferences.filter(p => p.isActive).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No active rules yet. Add your first rule above.
                  </p>
                ) : (
                  preferences.filter(p => p.isActive).map((pref) => (
                    <div key={pref.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={pref.ruleType === "never" || pref.ruleType === "avoid" ? "destructive" : "default"}>
                          {pref.ruleType}
                        </Badge>
                        <span>{pref.rule}</span>
                        {pref.platform && (
                          <Badge variant="outline">{pref.platform}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTogglePreference(pref.id, true)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePreference(pref.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {preferences.filter(p => !p.isActive).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Inactive Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {preferences.filter(p => !p.isActive).map((pref) => (
                    <div key={pref.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{pref.ruleType}</Badge>
                        <span>{pref.rule}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleTogglePreference(pref.id, false)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle>Learned Patterns</CardTitle>
              <CardDescription>
                Patterns automatically detected from your feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No learned patterns yet.</p>
                <p className="text-sm">Patterns are automatically derived from your feedback over time.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exemplars">
          <Card>
            <CardHeader>
              <CardTitle>Exemplar Posts</CardTitle>
              <CardDescription>
                Posts you've bookmarked as examples of ideal content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exemplars.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No exemplars yet.</p>
                  <p className="text-sm">Bookmark great posts to teach the AI your style.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {exemplars.map((ex) => (
                    <div key={ex.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <Badge variant="outline">{ex.platform || "any"}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                          fetch(`/api/training/exemplars/${ex.id}`, { method: "DELETE" }).then(loadData);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm">{ex.content.slice(0, 200)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
