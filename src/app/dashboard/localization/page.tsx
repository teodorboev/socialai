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
import { Plus, Globe, Trash2, MapPin, Clock } from "lucide-react";

interface Locale {
  id: string;
  locale: string;
  display_name: string;
  language: string;
  timezone: string;
  cultural_notes: string;
  tone_adjustment: string;
  is_enabled: boolean;
}

const COMMON_LOCALES = [
  { locale: "en-GB", displayName: "United Kingdom", language: "English", timezone: "Europe/London" },
  { locale: "pt-BR", displayName: "Brazil", language: "Portuguese", timezone: "America/Sao_Paulo" },
  { locale: "es-MX", displayName: "Mexico", language: "Spanish", timezone: "America/Mexico_City" },
  { locale: "fr-FR", displayName: "France", language: "French", timezone: "Europe/Paris" },
  { locale: "de-DE", displayName: "Germany", language: "German", timezone: "Europe/Berlin" },
  { locale: "ja-JP", displayName: "Japan", language: "Japanese", timezone: "Asia/Tokyo" },
  { locale: "en-AU", displayName: "Australia", language: "English", timezone: "Australia/Sydney" },
  { locale: "es-ES", displayName: "Spain", language: "Spanish", timezone: "Europe/Madrid" },
];

export default function LocalizationPage() {
  const [locales, setLocales] = useState<Locale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [newLocale, setNewLocale] = useState({
    locale: "",
    displayName: "",
    language: "",
    timezone: "",
    culturalNotes: "",
    toneAdjustment: "Same as source",
  });
  const supabase = createClient();

  useEffect(() => {
    loadLocales();
  }, []);

  async function loadLocales() {
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

    const { data: localesData } = await supabase
      .from("locale_configs")
      .select("*")
      .eq("organization_id", orgMember.organization_id)
      .order("created_at", { ascending: false });

    setLocales(localesData || []);
    setLoading(false);
  }

  async function addLocale() {
    if (!newLocale.locale.trim() || !newLocale.displayName.trim()) {
      toast.error("Please fill in required fields");
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

    const { error } = await supabase.from("locale_configs").insert({
      organization_id: orgMember.organization_id,
      locale: newLocale.locale,
      display_name: newLocale.displayName,
      language: newLocale.language,
      timezone: newLocale.timezone,
      cultural_notes: newLocale.culturalNotes,
      tone_adjustment: newLocale.toneAdjustment,
    });

    if (error) {
      toast.error("Failed to add locale");
    } else {
      toast.success("Locale added");
      setIsAddOpen(false);
      setNewLocale({
        locale: "",
        displayName: "",
        language: "",
        timezone: "",
        culturalNotes: "",
        toneAdjustment: "Same as source",
      });
      loadLocales();
    }
  }

  async function toggleLocale(id: string, isEnabled: boolean) {
    const { error } = await supabase
      .from("locale_configs")
      .update({ is_enabled: !isEnabled })
      .eq("id", id);

    if (!error) {
      loadLocales();
    }
  }

  async function deleteLocale(id: string) {
    const { error } = await supabase.from("locale_configs").delete().eq("id", id);
    if (!error) {
      toast.success("Locale deleted");
      loadLocales();
    }
  }

  function selectTemplate(template: typeof COMMON_LOCALES[0]) {
    setSelectedTemplate(template.locale);
    setNewLocale({
      locale: template.locale,
      displayName: template.displayName,
      language: template.language,
      timezone: template.timezone,
      culturalNotes: "",
      toneAdjustment: "Same as source",
    });
  }

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
          <h1 className="text-3xl font-bold">Localization</h1>
          <p className="text-muted-foreground">Adapt content for different markets</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Locale
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Target Locale</DialogTitle>
              <DialogDescription>
                Select a locale to adapt your content for
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Quick Start Templates</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_LOCALES.map((template) => (
                    <Button
                      key={template.locale}
                      variant={selectedTemplate === template.locale ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectTemplate(template)}
                    >
                      {template.displayName}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="locale">Locale Code *</Label>
                      <Input
                        id="locale"
                        value={newLocale.locale}
                        onChange={(e) => setNewLocale({ ...newLocale, locale: e.target.value })}
                        placeholder="e.g., en-GB"
                      />
                    </div>
                    <div>
                      <Label htmlFor="displayName">Display Name *</Label>
                      <Input
                        id="displayName"
                        value={newLocale.displayName}
                        onChange={(e) => setNewLocale({ ...newLocale, displayName: e.target.value })}
                        placeholder="e.g., United Kingdom"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Input
                        id="language"
                        value={newLocale.language}
                        onChange={(e) => setNewLocale({ ...newLocale, language: e.target.value })}
                        placeholder="e.g., English"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input
                        id="timezone"
                        value={newLocale.timezone}
                        onChange={(e) => setNewLocale({ ...newLocale, timezone: e.target.value })}
                        placeholder="e.g., Europe/London"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="toneAdjustment">Tone Adjustment</Label>
                    <Input
                      id="toneAdjustment"
                      value={newLocale.toneAdjustment}
                      onChange={(e) => setNewLocale({ ...newLocale, toneAdjustment: e.target.value })}
                      placeholder="e.g., Slightly more formal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="culturalNotes">Cultural Notes</Label>
                    <Input
                      id="culturalNotes"
                      value={newLocale.culturalNotes}
                      onChange={(e) => setNewLocale({ ...newLocale, culturalNotes: e.target.value })}
                      placeholder="Any cultural considerations..."
                    />
                  </div>
                </div>
                <Button onClick={addLocale} className="w-full mt-4">Add Locale</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {locales.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No locales configured</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add target markets to adapt your content for different regions
              </p>
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Locale
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locales.map((locale) => (
            <Card key={locale.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{locale.display_name}</CardTitle>
                    <CardDescription>{locale.locale}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={locale.is_enabled ? "default" : "secondary"}>
                      {locale.is_enabled ? "Active" : "Disabled"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => deleteLocale(locale.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    <span>{locale.language}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{locale.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{locale.tone_adjustment || "Same as source"}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => toggleLocale(locale.id, locale.is_enabled)}
                >
                  {locale.is_enabled ? "Disable" : "Enable"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
