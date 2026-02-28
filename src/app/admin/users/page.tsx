"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  UserCog,
  Building2,
  CreditCard,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  id: string;
  status: string;
  billingPlan: {
    id: string;
    name: string;
  } | null;
}

interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  } & {
    subscription?: Subscription | null;
  };
}

interface PaginatedResponse {
  users: OrgMember[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [users, setUsers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  // Filter states
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "all");
  const [orgFilter, setOrgFilter] = useState(searchParams.get("organizationId") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  
  // Pagination
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch organizations for filter dropdown
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const res = await fetch("/api/admin/users/organizations");
        if (res.ok) {
          const data = await res.json();
          setOrganizations(data);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      }
    }
    fetchOrganizations();
  }, []);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (orgFilter !== "all") params.set("organizationId", orgFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data: PaginatedResponse = await res.json();
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, orgFilter, statusFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (orgFilter !== "all") params.set("organizationId", orgFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (page > 1) params.set("page", page.toString());
    
    const queryString = params.toString();
    router.push(queryString ? `/admin/users?${queryString}` : "/admin/users", { scroll: false });
  }, [search, roleFilter, orgFilter, statusFilter, page, router]);

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

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      OWNER: "default",
      ADMIN: "secondary",
      MEMBER: "outline",
    };
    
    return <Badge variant={variants[role] || "outline"}>{role}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage all users and their subscriptions across organizations
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>

            {/* Organization Filter */}
            <Select value={orgFilter} onValueChange={(v) => { setOrgFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {users.length} of {totalCount} users
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium">User</th>
                  <th className="text-left p-4 text-sm font-medium">Organization</th>
                  <th className="text-left p-4 text-sm font-medium">Role</th>
                  <th className="text-left p-4 text-sm font-medium">Plan</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Added</th>
                  <th className="text-right p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserCog className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{user.userId.slice(0, 8)}...</div>
                            <div className="text-sm text-muted-foreground">ID: {user.userId.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{user.organization.name}</div>
                            <div className="text-sm text-muted-foreground">{user.organization.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {user.organization.subscription?.billingPlan?.name || "No Plan"}
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(user.organization.subscription?.status)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${user.id}`}>
                                View & Edit
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
