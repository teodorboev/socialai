/**
 * Dashboard - Engagement Templates Management
 * 
 * UI for managing auto-response templates.
 * These templates allow the AI to respond to common comments without calling Claude.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrgTemplates, updateTemplate } from "@/lib/caching/template-responder";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's organization
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) {
    redirect("/onboarding");
  }

  const templates = await getOrgTemplates(orgMember.organization_id);

  const categories = [
    { id: "emoji_only", name: "Emoji Only", description: "Short emoji responses" },
    { id: "appreciation_simple", name: "Simple Appreciation", description: "Thanks, love it, etc." },
    { id: "want_to_buy", name: "Want to Buy", description: "Questions about purchasing" },
    { id: "price_inquiry", name: "Price Inquiry", description: "Questions about pricing" },
    { id: "shipping_inquiry", name: "Shipping", description: "Questions about shipping" },
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Response Templates</h1>
        <p className="text-muted-foreground mt-2">
          Customize how the AI responds to common comments automatically.
        </p>
      </div>

      <div className="grid gap-6">
        {categories.map((category) => {
          const categoryTemplates = templates.filter((t: typeof templates[number]) => t.category === category.id);
          
          return (
            <div key={category.id} className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {categoryTemplates.length} templates
                </span>
              </div>

              {categoryTemplates.length > 0 ? (
                <div className="space-y-3">
                  {categoryTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex gap-2 mb-1">
                          {template.triggers.slice(0, 3).map((trigger: string, i: number) => (
                            <span
                              key={i}
                              className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                            >
                              {trigger}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {template.responses.slice(0, 2).map((response: string, i: number) => (
                            <span
                              key={i}
                              className="text-sm text-muted-foreground"
                            >
                              &quot;{response}&quot;
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{template.useCount} uses</div>
                        <div className={template.isActive ? "text-green-600" : "text-gray-400"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No custom templates. Using default responses.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Templates are checked before calling Claude</li>
          <li>• If a comment matches a trigger, the template response is used</li>
          <li>• This saves AI costs for common, predictable responses</li>
          <li>• DMs always go to Claude for more personal responses</li>
          <li>• Templates with 85%+ confidence auto-respond without review</li>
        </ul>
      </div>
    </div>
  );
}
