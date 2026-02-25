import { prisma } from "@/lib/prisma";
import { EmailTemplateManager } from "./email-template-manager";

export const dynamic = 'force-dynamic';

async function getEmailTemplates() {
  return prisma.emailTemplate.findMany({
    orderBy: { slug: "asc" },
  });
}

export default async function EmailsPage() {
  const templates = await getEmailTemplates();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <p className="text-muted-foreground">
          Manage notification email templates
        </p>
      </div>

      <EmailTemplateManager initialTemplates={templates} />
    </div>
  );
}
