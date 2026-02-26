"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface UsageData {
  summary: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalEvents: number;
  };
  byOrganization: Array<{
    organizationId: string;
    organizationName: string;
    totalCost: number;
  }>;
  byAgent: Array<{
    agentName: string;
    totalCost: number;
  }>;
}

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    async function fetchUsage() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/billing/usage?period=${period}`);
        const json = await response.json();
        
        if (!response.ok || json.error) {
          setError(json.error || "Failed to fetch usage data");
          setData(null);
        } else {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch usage:", err);
        setError("Failed to fetch usage data");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, [period]);

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Usage & Costs</h1>
            <p className="text-muted-foreground">
              Monitor AI agent usage and costs across all organizations
            </p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Guard against missing data
  if (!data || !data.summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Usage & Costs</h1>
            <p className="text-muted-foreground">
              Monitor AI agent usage and costs across all organizations
            </p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          No usage data available
        </div>
      </div>
    );
  }

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cost);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Usage & Costs</h1>
          <p className="text-muted-foreground">
            Monitor AI agent usage and costs across all organizations
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="month">This Month</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(data?.summary.totalCost || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.summary.totalTokens || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Input Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.summary.totalInputTokens || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Output Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.summary.totalOutputTokens || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 text-sm font-medium">Organization</th>
                <th className="text-right p-2 text-sm font-medium">Cost</th>
                <th className="text-right p-2 text-sm font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.byOrganization.map((org) => (
                <tr key={org.organizationId} className="border-t">
                  <td className="p-2">{org.organizationName}</td>
                  <td className="p-2 text-right">{formatCost(org.totalCost)}</td>
                  <td className="p-2 text-right">
                    {data.summary.totalCost > 0
                      ? ((org.totalCost / data.summary.totalCost) * 100).toFixed(1)
                      : 0}%
                  </td>
                </tr>
              ))}
              {(!data?.byOrganization || data.byOrganization.length === 0) && (
                <tr>
                  <td colSpan={3} className="text-center p-4 text-muted-foreground">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* By Agent */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.byAgent.map((agent) => (
              <div
                key={agent.agentName}
                className="flex items-center justify-between p-2 border rounded"
              >
                <Badge variant="outline">{agent.agentName}</Badge>
                <span className="font-medium">{formatCost(agent.totalCost)}</span>
              </div>
            ))}
            {(!data?.byAgent || data.byAgent.length === 0) && (
              <div className="text-center p-4 text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
