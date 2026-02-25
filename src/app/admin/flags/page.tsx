import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureFlagManager } from "./feature-flag-manager";

async function getFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });
}

export default async function FlagsPage() {
  const flags = await getFeatureFlags();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground">
          Manage system feature toggles
        </p>
      </div>

      <FeatureFlagManager initialFlags={flags} />
    </div>
  );
}
