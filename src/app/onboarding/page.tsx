"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [step, setStep] = useState(1);

  useEffect(() => {
    async function checkOrg() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Check if user already has an organization
      const { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (orgMember) {
        router.push("/dashboard");
      }
    }

    checkOrg();
  }, [supabase, router]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Please enter an organization name");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Create organization
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const now = new Date().toISOString();
    
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: orgName,
        slug: `${slug}-${Date.now()}`,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (orgError) {
      toast.error("Failed to create organization: " + orgError.message);
      setLoading(false);
      return;
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from("org_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "OWNER",
        created_at: new Date().toISOString(),
      });

    if (memberError) {
      toast.error("Failed to add member: " + memberError.message);
      setLoading(false);
      return;
    }

    toast.success("Organization created!");
    router.push("/dashboard/brand");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome to SocialAI</CardTitle>
          <CardDescription>
            Let&apos;s set up your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="Your Company Name"
              value={orgName}
              onChange={(e: any) => setOrgName(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") handleCreateOrg();
              }}
            />
            <p className="text-xs text-muted-foreground">
              This will be the name of your workspace in SocialAI
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreateOrg} className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Organization"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
