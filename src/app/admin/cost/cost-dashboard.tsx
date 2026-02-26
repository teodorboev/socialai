"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyCostSummary } from "@prisma/client";

// Import recharts components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface CostData {
  dailySummaries: DailyCostSummary[];
  todayStats: {
    totalCost: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCalls: number;
  };
  tierBreakdown: Array<{
    requestTier: string;
    _sum: {
      totalCost: number | null;
      totalTokens: number | null;
    };
    _count: {
      id: number;
    };
  }>;
  providerBreakdown: Array<{
    providerName: string;
    _sum: {
      totalCost: number | null;
      totalTokens: number | null;
    };
    _count: {
      id: number;
    };
  }>;
  agentBreakdown: Array<{
    agentName: string;
    _sum: {
      totalCost: number | null;
      totalTokens: number | null;
    };
    _count: {
      id: number;
    };
  }>;
}

interface CostDashboardProps {
  initialData: CostData;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

const tierColors: Record<string, string> = {
  budget: "#22c55e",
  mid: "#3b82f6",
  flagship: "#a855f7",
};

// Type for pie chart data
type PieDataItem = {
  name: string;
  cost: number;
  calls: number;
  color?: string;
};

export function CostDashboard({ initialData }: CostDashboardProps) {
  const [data] = useState(initialData);

  // Format cents to dollars
  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Format large numbers
  const formatNumber = (num: number) => num.toLocaleString();

  // Prepare chart data
  const dailyCostData = data.dailySummaries.map((day) => ({
    date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cost: day.totalCostCents / 100,
    calls: day.totalCalls,
    tokens: Number(day.totalInputTokens) + Number(day.totalOutputTokens),
  }));

  const tierData: PieDataItem[] = data.tierBreakdown.map((tier) => ({
    name: tier.requestTier,
    cost: (tier._sum.totalCost || 0) / 100,
    calls: tier._count.id,
    color: tierColors[tier.requestTier] || COLORS[0],
  }));

  const providerData: PieDataItem[] = data.providerBreakdown.map((provider) => ({
    name: provider.providerName,
    cost: (provider._sum.totalCost || 0) / 100,
    calls: provider._count.id,
  }));

  const agentData = data.agentBreakdown
    .sort((a, b) => (b._sum.totalCost || 0) - (a._sum.totalCost || 0))
    .slice(0, 10)
    .map((agent) => ({
      name: agent.agentName.replace(/_/g, " ").toLowerCase(),
      cost: (agent._sum.totalCost || 0) / 100,
      calls: agent._count.id,
    }));

  // YAxis tick formatter
  const yAxisTickFormatter = (value: number) => `$${value}`;

  // Tooltip content component
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow">
          <p className="text-sm">{`${payload[0].name}: $${payload[0].value.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="daily">Daily Trends</TabsTrigger>
        <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {/* Today&apos;s Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today&apos;s Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(data.todayStats.totalCost)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(data.todayStats.totalCalls)} API calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today&apos;s Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(data.todayStats.totalTokens)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(data.todayStats.inputTokens)} input / {formatNumber(data.todayStats.outputTokens)} output
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">30-Day Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.dailySummaries.reduce((sum, d) => sum + d.totalCostCents, 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(data.dailySummaries.reduce((sum, d) => sum + d.totalCalls, 0))} total calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Daily Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(
                  data.dailySummaries.length > 0
                    ? data.dailySummaries.reduce((sum, d) => sum + d.totalCostCents, 0) / data.dailySummaries.length
                    : 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on last {data.dailySummaries.length} days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tier Breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Tier (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                    nameKey="name"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost by Provider (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={providerData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                    nameKey="name"
                  >
                    {providerData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="daily" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dailyCostData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={yAxisTickFormatter} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily API Calls (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dailyCostData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="calls" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="breakdown" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Agents by Cost (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {agentData.map((agent) => (
                  <div key={agent.name} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{agent.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{agent.calls} calls</Badge>
                      <span className="text-sm font-medium">${agent.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Provider Performance (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.providerBreakdown.map((provider) => (
                  <div key={provider.providerName} className="flex items-center justify-between">
                    <span className="text-sm">{provider.providerName}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{provider._count.id} calls</Badge>
                      <span className="text-sm font-medium">
                        ${((provider._sum.totalCost || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
