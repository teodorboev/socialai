import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LLMModelManager } from "./llm-model-manager";

export const dynamic = 'force-dynamic';

async function getLLMData() {
  const [providers, models, rules] = await Promise.all([
    prisma.lLMProvider.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.lLMModel.findMany({
      orderBy: { tier: "asc" },
      include: {
        provider: true,
      },
    }),
    prisma.routingRule.findMany({
      orderBy: { priority: "desc" },
    }),
  ]);

  return { providers, models, rules };
}

export default async function LLMModelsPage() {
  const { providers, models, rules } = await getLLMData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">LLM Model Management</h1>
        <p className="text-muted-foreground">
          Manage AI providers, models, and routing rules
        </p>
      </div>

      <LLMModelManager 
        initialProviders={providers} 
        initialModels={models}
        initialRules={rules}
      />
    </div>
  );
}
