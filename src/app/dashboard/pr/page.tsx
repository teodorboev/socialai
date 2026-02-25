import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, Mail, TrendingUp, ExternalLink, Clock } from "lucide-react";

export default function PRPage() {
  // Mock data - in production would come from agents
  const stats = {
    pressMentions: 23,
    earnedMediaValue: 45000,
    pendingPitches: 5,
    publishedStories: 12,
  };

  const recentPitches = [
    { outlet: "TechCrunch", status: "Sent", date: "2024-01-15", topic: "Product Launch" },
    { outlet: "Forbes", status: "Accepted", date: "2024-01-12", topic: "Industry Trends" },
    { outlet: "Business Insider", status: "Draft", date: "", topic: "Company News" },
  ];

  const coverage = [
    { outlet: "TechCrunch", title: "Startup Launches AI-Powered Social Tool", date: "2024-01-10", reach: 500000 },
    { outlet: "VentureBeat", title: "How AI is Transforming Social Media Marketing", date: "2024-01-08", reach: 350000 },
    { outlet: "Marketing Brew", title: "The Future of Automated Content Creation", date: "2024-01-05", reach: 180000 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PR & Media</h1>
          <p className="text-muted-foreground">
            Manage earned media and press relations
          </p>
        </div>
        <Button>Create Pitch</Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Press Mentions</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pressMentions}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Earned Media Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.earnedMediaValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Estimated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Pitches</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPitches}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Stories</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publishedStories}</div>
            <p className="text-xs text-muted-foreground">This quarter</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Pitches */}
      <Card>
        <CardHeader>
          <CardTitle>Active Pitches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentPitches.map((pitch, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{pitch.outlet}</p>
                    <p className="text-sm text-muted-foreground">{pitch.topic}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={
                    pitch.status === "Accepted" ? "default" :
                    pitch.status === "Sent" ? "secondary" : "outline"
                  }>
                    {pitch.status}
                  </Badge>
                  {pitch.date && (
                    <span className="text-sm text-muted-foreground">{pitch.date}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coverage.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.outlet}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{(item.reach / 1000).toFixed(0)}K reach</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Write Press Release</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Create</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Media List</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Press Kit</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Manage</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
