import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function ROIPage() {
  // In a real app, this would fetch from agent_logs and analytics data
  const stats = {
    totalRevenue: 125000,
    socialAttributed: 45000,
    attributionRate: 36,
    conversions: 1245,
    avgOrderValue: 100.40,
    topPlatform: "Instagram",
  };

  const platformBreakdown = [
    { platform: "Instagram", revenue: 22000, conversions: 520, percentage: 48 },
    { platform: "Facebook", revenue: 12000, conversions: 380, percentage: 27 },
    { platform: "TikTok", revenue: 7000, conversions: 245, percentage: 16 },
    { platform: "LinkedIn", revenue: 4000, conversions: 100, percentage: 9 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ROI & Attribution</h1>
          <p className="text-muted-foreground">
            Track social media revenue attribution
          </p>
        </div>
        <Button>Run Attribution Analysis</Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              +18% from last period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Social Attributed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.socialAttributed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.attributionRate}% of total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversions.toLocaleString()}</div>
            <div className="flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              +24% from last period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgOrderValue}</div>
            <div className="flex items-center text-xs text-red-600">
              <ArrowDownRight className="h-3 w-3" />
              -5% from last period
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platformBreakdown.map((platform) => (
              <div key={platform.platform} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-32 font-medium">{platform.platform}</div>
                  <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${platform.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${platform.revenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{platform.conversions} conversions</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attribution Methods */}
      <div className="grid gap-4 md:grid-colss-2">
        <Card>
          <CardHeader>
            <CardTitle>Attribution Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">First Touch</span>
                <Badge>45% Instagram</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Last Touch</span>
                <Badge>38% Direct</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Linear</span>
                <Badge>Distributed</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Time Decay</span>
                <Badge>7-day window</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="outline">View Customer Journeys</Button>
            <Button className="w-full" variant="outline">Export Attribution Report</Button>
            <Button className="w-full" variant="outline">Compare Models</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
