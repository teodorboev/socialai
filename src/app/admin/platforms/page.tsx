import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformConfigManager } from "./platform-config-manager";
import { connection } from "next/server";


async function getPlatformConfigs() {
  return prismaAdmin.platformConfig.findMany({
    orderBy: { platform: "asc" },
  });
}

export default async function PlatformsPage() {
  await connection();
  const configs = await getPlatformConfigs();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Configurations</h1>
        <p className="text-muted-foreground">
          Manage social platform settings and limits
        </p>
      </div>

      <PlatformConfigManager initialConfigs={configs} />
    </div>
  );
}
