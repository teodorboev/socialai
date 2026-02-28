import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PromptTemplateManager } from "./prompt-template-manager";
import { AgentName } from "@prisma/client";
import { connection } from "next/server";


async function getPromptTemplates() {
  return prismaAdmin.promptTemplate.findMany({
    orderBy: [{ agentName: "asc" }, { name: "asc" }],
  });
}

export default async function AdminPromptsPage() {
  await connection();
  const prompts = await getPromptTemplates();

  // Group by agentName
  const grouped = prompts.reduce((acc, template) => {
    if (!acc[template.agentName]) {
      acc[template.agentName] = [];
    }
    acc[template.agentName].push(template);
    return acc;
  }, {} as Record<string, typeof prompts>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Prompt Templates</h1>
        <p className="text-muted-foreground">
          Manage AI agent system prompts
        </p>
      </div>

      <PromptTemplateManager initialTemplates={prompts} />
    </div>
  );
}
