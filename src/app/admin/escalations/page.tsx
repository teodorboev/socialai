import { prismaAdmin } from "@/lib/prisma";
import { EscalationRuleManager } from "./escalation-rule-manager";
import { connection } from "next/server";


async function getEscalationRules() {
  return prismaAdmin.escalationRule.findMany({
    where: { organizationId: null }, // Global rules only
    orderBy: { name: "asc" },
  });
}

export default async function EscalationPage() {
  await connection();
  const rules = await getEscalationRules();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Escalation Rules</h1>
        <p className="text-muted-foreground">
          Manage global escalation rules for automatic triage
        </p>
      </div>

      <EscalationRuleManager initialRules={rules} />
    </div>
  );
}
