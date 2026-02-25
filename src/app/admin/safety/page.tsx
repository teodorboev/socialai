import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SafetyConfigManager } from "./safety-config-manager";

export const dynamic = 'force-dynamic';

async function getSafetyConfigs() {
  return prisma.safetyConfig.findMany({
    orderBy: { category: "asc" },
  });
}

export default async function SafetyPage() {
  const configs = await getSafetyConfigs();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Safety Configuration</h1>
        <p className="text-muted-foreground">
          Manage content safety rules and blocked keywords
        </p>
      </div>

      <SafetyConfigManager initialConfigs={configs} />
    </div>
  );
}
