import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  FileText,
  Flag,
  Shield,
  Mail,
  Users,
  Building2
} from "lucide-react";


async function getStats() {
  const [
    platformConfigCount,
    promptTemplateCount,
    featureFlagCount,
    safetyConfigCount,
    emailTemplateCount,
    orgCount,
    memberCount,
  ] = await Promise.all([
    prismaAdmin.platformConfig.count(),
    prismaAdmin.promptTemplate.count(),
    prismaAdmin.featureFlag.count(),
    prismaAdmin.safetyConfig.count(),
    prismaAdmin.emailTemplate.count(),
    prismaAdmin.organization.count(),
    prismaAdmin.orgMember.count(),
  ]);

  return {
    platformConfigCount,
    promptTemplateCount,
    featureFlagCount,
    safetyConfigCount,
    emailTemplateCount,
    orgCount,
    memberCount,
  };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  const cards = [
    {
      title: "Organizations",
      value: stats.orgCount,
      description: "Total organizations on platform",
      icon: Building2,
    },
    {
      title: "Users",
      value: stats.memberCount,
      description: "Total team members",
      icon: Users,
    },
    {
      title: "Platform Configs",
      value: stats.platformConfigCount,
      description: "Social platform configurations",
      icon: Server,
    },
    {
      title: "Prompt Templates",
      value: stats.promptTemplateCount,
      description: "AI agent prompt templates",
      icon: FileText,
    },
    {
      title: "Feature Flags",
      value: stats.featureFlagCount,
      description: "System feature toggles",
      icon: Flag,
    },
    {
      title: "Safety Rules",
      value: stats.safetyConfigCount,
      description: "Content safety configurations",
      icon: Shield,
    },
    {
      title: "Email Templates",
      value: stats.emailTemplateCount,
      description: "Notification email templates",
      icon: Mail,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground">
          System-wide configuration and settings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <a
              href="/admin/platforms"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Manage Platforms
            </a>
            <a
              href="/admin/prompts"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Manage Prompts
            </a>
            <a
              href="/admin/flags"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Manage Features
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
