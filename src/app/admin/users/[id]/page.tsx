"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  Trash2,
  CreditCard,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  trialDays: number;
  maxPlatforms: number;
  maxPostsPerMonth: number;
  maxBrands: number;
  maxTeamMembers: number;
  agentTier: string;
  features: Record<string, boolean>;
  stripePrices: Array<{
    id: string;
    currency: string;
    interval: string;
    unitAmount: number;
  }>;
}

interface Subscription {
  id: string;
  status: string;
  currency: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan: BillingPlan | null;
}

interface UserData {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  organization: Organization;
  subscription: Subscription | null;
}

interface BillingPlanOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  agentTier: string;
}

function formatPrice(amount: number, currency: string): string {
  const formatted = (amount / 100).toFixed(2);
  switch (currency) {
    case "usd": return `$${formatted}`;
    case "eur": return `€${formatted}`;
    case "gbp": return `£${formatted}`;
    default: return `${amount} ${currency}`;
  }
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [billingPlans, setBillingPlans] = useState<BillingPlanOption[]>([]);

  // Form state
  const [role, setRole] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user, organizations, and plans in parallel
      const [userRes, orgsRes, plansRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch("/api/admin/users/organizations"),
        fetch("/api/admin/users/plans"),
      ]);

      if (userRes.ok) {
        const userData: UserData = await userRes.json();
        setUser(userData);
        setRole(userData.role);
        setOrganizationId(userData.organizationId);
        setSelectedPlanId(userData.subscription?.plan?.id || "");
      }

      if (orgsRes.ok) {
        setOrganizations(await orgsRes.json());
      }

      if (plansRes.ok) {
        setBillingPlans(await plansRes.json());
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update user role/organization
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          organizationId,
        }),
      });

      if (res.ok) {
        toast.success("User updated successfully");
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  // Change subscription plan
  const handleChangePlan = async () => {
    if (!selectedPlanId || !user?.subscription) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Plan changed to ${data.subscription.billingPlan.name}`);
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to change plan");
      }
    } catch (error) {
      console.error("Error changing plan:", error);
      toast.error("Failed to change plan");
    } finally {
      setSaving(false);
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async (immediate: boolean = false) => {
    if (!user?.subscription) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setSaving(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("User removed from organization");
        router.push("/admin/users");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to remove user");
      }
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="outline">No Sub</Badge>;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "outline",
      paused: "outline",
    };
    
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">User Details</h1>
              <Badge variant={user.role === "OWNER" ? "default" : user.role === "ADMIN" ? "secondary" : "outline"}>
                {user.role}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              ID: {user.userId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {user.role !== "OWNER" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove User</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove this user from {user.organization.name}?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Remove User
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>
                Manage user role and organization membership
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User ID */}
              <div className="grid gap-2">
                <Label>User ID</Label>
                <Input value={user.userId} disabled className="font-mono text-sm" />
              </div>

              {/* Role */}
              <div className="grid gap-2">
                <Label>Role</Label>
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
                <p className="text-sm text-muted-foreground">
                  Owners can manage billing and add/remove team members.
                </p>
              </div>

              {/* Organization */}
              <div className="grid gap-2">
                <Label>Organization</Label>
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

              {/* Created */}
              <div className="grid gap-2">
                <Label>Member Since</Label>
                <Input value={formatDate(user.createdAt)} disabled />
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          {user.subscription ? (
            <div className="space-y-6">
              {/* Current Subscription */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Current Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(user.subscription.status)}
                        {user.subscription.cancelAtPeriodEnd && (
                          <Badge variant="outline">Cancels at period end</Badge>
                        )}
                      </div>
                    </div>
                    {user.subscription.status === "active" && !user.subscription.cancelAtPeriodEnd && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline">Cancel Subscription</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              Do you want to cancel immediately or at the end of the billing period?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleCancelSubscription(false)}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              Cancel at Period End
                            </AlertDialogAction>
                            <AlertDialogAction 
                              onClick={() => handleCancelSubscription(true)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Cancel Now
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {/* Plan */}
                  <div className="grid gap-2">
                    <div className="text-sm text-muted-foreground">Current Plan</div>
                    <div className="flex items-center gap-4">
                      <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                        <SelectTrigger className="w-[300px]">
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
                      {selectedPlanId !== user.subscription.plan?.id && (
                        <Button onClick={handleChangePlan} disabled={saving}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Change Plan
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Period */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Period Start</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(user.subscription.currentPeriodStart)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Current Period End</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(user.subscription.currentPeriodEnd)}
                      </div>
                    </div>
                  </div>

                  {/* Trial */}
                  {user.subscription.trialEnd && user.subscription.status === "trialing" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-blue-800">Trial Period</div>
                          <div className="text-sm text-blue-600">
                            Trial ends on {formatDate(user.subscription.trialEnd)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="text-lg font-medium">No Active Subscription</div>
                <p className="text-muted-foreground">
                  This organization does not have an active subscription.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
