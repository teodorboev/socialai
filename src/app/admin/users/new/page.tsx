"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface BillingPlan {
  id: string;
  name: string;
  slug: string;
}

export default function NewUserPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);

  // Form state
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [planId, setPlanId] = useState("");

  // New organization fields
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [orgsRes, plansRes] = await Promise.all([
          fetch("/api/admin/users/organizations"),
          fetch("/api/admin/users/plans"),
        ]);

        if (orgsRes.ok) {
          const data = await orgsRes.json();
          setOrganizations(data);
          if (data.length > 0) {
            setOrganizationId(data[0].id);
          }
        }

        if (plansRes.ok) {
          const data: BillingPlan[] = await plansRes.json();
          setBillingPlans(data);
          if (data.length > 0) {
            setPlanId(data[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Auto-generate slug from org name
  useEffect(() => {
    if (mode === "new" && orgName) {
      setOrgSlug(orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [orgName, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Note: The API returns an error because user creation requires Supabase Auth Admin API
      // This is a placeholder - in production, you'd use Supabase Admin to create users
      
      // For now, we'll show a message about what's needed
      toast.info("User creation requires Supabase Auth Admin API integration. Use the client invite flow or implement auth.admin.createUser() to complete.");
      
      // In a real implementation:
      // const res = await fetch("/api/admin/users", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     email,
      //     name,
      //     organizationId: mode === "existing" ? organizationId : undefined,
      //     // For new org:
      //     // organization: { name: orgName, slug: orgSlug },
      //     // subscription: { planId }
      //     role,
      //   }),
      // });
      
      // if (res.ok) {
      //   toast.success("User created successfully");
      //   router.push("/admin/users");
      // } else {
      //   const error = await res.json();
      //   toast.error(error.error || "Failed to create user");
      // }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add User</h1>
          <p className="text-muted-foreground">
            Add a new user to an existing organization
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Mode Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>User Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "outline"}
                onClick={() => setMode("existing")}
                className="flex-1"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add to Existing Org
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                onClick={() => setMode("new")}
                className="flex-1"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Org
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Details */}
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>
              {mode === "existing" 
                ? "Add a user to an existing organization"
                : "Create a new organization with a user"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                An invitation email will be sent to this address
              </p>
            </div>

            {/* Name (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name (Optional)</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {mode === "existing" ? (
              <>
                {/* Organization */}
                <div className="grid gap-2">
                  <Label htmlFor="organization">Organization</Label>
                  <Select value={organizationId} onValueChange={setOrganizationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Role */}
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Owners can manage billing and add/remove team members.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* New Organization */}
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    placeholder="Acme Inc."
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="orgSlug">Organization Slug</Label>
                  <Input
                    id="orgSlug"
                    placeholder="acme-inc"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    URL-friendly identifier: socialai.com/{orgSlug || "..."}
                  </p>
                </div>

                {/* Role */}
                <div className="grid gap-2">
                  <Label htmlFor="role">Your Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan */}
                <div className="grid gap-2">
                  <Label htmlFor="plan">Subscription Plan</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {mode === "existing" ? "Add User" : "Create Organization & User"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
