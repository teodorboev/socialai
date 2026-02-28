import { prismaAdmin } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PromptTemplateManager } from "./prompt-template-manager";
import { AgentName } from "@prisma/client";


async function getPromptTemplates() {
  return prismaAdmin.promptTemplate.findMany({
    orderBy: [{ agentName: "asc" }, { name: "asc" }],
  });
}

export default async function PromptsPage() {
  const templates = await getPromptTemplates();

  // Group by agentName
  const grouped = templates.reduce((acc, template) => {
    if (!acc[template.agentName]) {
      acc[template.agentName] = [];
    }
    acc[template.agentName].push(template);
    return acc;
  }, {} as Record<string, typeof templates>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Prompt Templates</h1>
        <p className="text-muted-foreground">
          Manage AI agent system prompts
        </p>
      </div>

      <PromptTemplateManager initialTemplates={templates} />
    </div>
  );
}
