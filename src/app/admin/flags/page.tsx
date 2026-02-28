import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureFlagManager } from "./feature-flag-manager";
import { connection } from "next/server";


async function getFeatureFlags() {
  return prismaAdmin.featureFlag.findMany({
    orderBy: { key: "asc" },
  });
}

export default async function FlagsPage() {
  await connection();
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
