"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type AgentName = 
  | "ORCHESTRATOR"
  | "STRATEGY"
  | "CONTENT_CREATOR"
  | "VISUAL"
  | "PUBLISHER"
  | "ENGAGEMENT"
  | "ANALYTICS"
  | "TREND_SCOUT"
  | "AB_TESTING"
  | "COMPETITOR_INTELLIGENCE"
  | "REPURPOSE"
  | "SOCIAL_LISTENING"
  | "AUDIENCE_INTELLIGENCE"
  | "INFLUENCER_SCOUT"
  | "CONTENT_REPLENISHMENT"
  | "COMPLIANCE"
  | "LOCALIZATION"
  | "ROI_ATTRIBUTION"
  | "PREDICTIVE_CONTENT"
  | "BRAND_VOICE_GUARDIAN"
  | "SOCIAL_SEO"
  | "SENTIMENT_INTELLIGENCE"
  | "CROSS_CHANNEL_ATTRIBUTION"
  | "PRICING_INTELLIGENCE"
  | "COMMUNITY_BUILDER"
  | "MEDIA_PITCH"
  | "COMPETITIVE_AD_INTELLIGENCE"
  | "HASHTAG_OPTIMIZER"
  | "CAPTION_REWRITER"
  | "CRISIS_RESPONSE"
  | "UGC_CURATOR"
  | "REVIEW_RESPONSE"
  | "AD_COPY"
  | "CALENDAR_OPTIMIZER"
  | "REPORTING_NARRATOR"
  | "ONBOARDING_INTELLIGENCE"
  | "CHURN_PREDICTION";

interface PromptTemplate {
  id: string;
  agentName: AgentName;
  name: string;
  description: string | null;
  body: string;
  variables: string[];
  version: number;
  isActive: boolean;
}

interface PromptTemplateManagerProps {
  initialTemplates: PromptTemplate[];
}

const agentNames: AgentName[] = [
  "ORCHESTRATOR",
  "STRATEGY",
  "CONTENT_CREATOR",
  "VISUAL",
  "PUBLISHER",
  "ENGAGEMENT",
  "ANALYTICS",
  "TREND_SCOUT",
  "AB_TESTING",
  "COMPETITOR_INTELLIGENCE",
  "REPURPOSE",
  "SOCIAL_LISTENING",
  "AUDIENCE_INTELLIGENCE",
  "INFLUENCER_SCOUT",
  "CONTENT_REPLENISHMENT",
  "COMPLIANCE",
  "LOCALIZATION",
];

export function PromptTemplateManager({ initialTemplates }: PromptTemplateManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate({ ...template });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/prompts/${editingTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingTemplate.name,
          description: editingTemplate.description,
          body: editingTemplate.body,
          isActive: editingTemplate.isActive,
        }),
      });

      if (response.ok) {
        setTemplates(templates.map(t => 
          t.id === editingTemplate.id ? editingTemplate : t
        ));
        toast.success("Prompt template updated");
        setIsOpen(false);
      } else {
        toast.error("Failed to update template");
      }
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{template.agentName}</Badge>
                  </TableCell>
                  <TableCell>{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.description || "-"}
                  </TableCell>
                  <TableCell>v{template.version}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 3).map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No prompt templates found. Run seed to populate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Prompt: {editingTemplate?.name}</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Input value={editingTemplate.agentName} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editingTemplate.description || ""}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    description: e.target.value
                  })}
                  placeholder="Brief description of this prompt..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="body">Prompt Body</Label>
                <Textarea
                  id="body"
                  rows={15}
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    body: e.target.value
                  })}
                  placeholder="System prompt for the AI agent..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingTemplate.isActive}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    isActive: e.target.checked
                  })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
