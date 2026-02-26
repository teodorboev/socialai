"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, ChevronDown, ChevronRight, Check, X } from "lucide-react";

// Agent categories for grouping
export const AGENT_CATEGORIES = {
  core: {
    name: "Core",
    description: "Essential agents for basic functionality",
    agents: [
      "CONTENT_CREATOR",
      "ENGAGEMENT", 
      "PUBLISHER",
      "ANALYTICS",
      "STRATEGY",
      "TREND_SCOUT",
      "COMPLIANCE",
      "CONTENT_REPLENISHMENT",
      "CALENDAR_OPTIMIZER",
      "HASHTAG_OPTIMIZER",
    ] as string[],
  },
  intelligence: {
    name: "Intelligence",
    description: "Advanced analytics and insights",
    agents: [
      "COMPETITOR_INTELLIGENCE",
      "SOCIAL_LISTENING",
      "AUDIENCE_INTELLIGENCE",
      "INFLUENCER_SCOUT",
      "SOCIAL_SEO",
      "CAPTION_REWRITER",
      "BRAND_VOICE_GUARDIAN",
      "REPORTING_NARRATOR",
    ] as string[],
  },
  premium: {
    name: "Premium",
    description: "Advanced AI capabilities",
    agents: [
      "CREATIVE_DIRECTOR",
      "PREDICTIVE_CONTENT",
      "ROI_ATTRIBUTION",
      "CROSS_CHANNEL_ATTRIBUTION",
      "AD_COPY",
      "SENTIMENT_INTELLIGENCE",
      "COMPETITIVE_AD_INTELLIGENCE",
      "PRICING_INTELLIGENCE",
      "COMMUNITY_BUILDER",
      "MEDIA_PITCH",
      "UGC_CURATOR",
      "REVIEW_RESPONSE",
      "REPURPOSE",
      "LOCALIZATION",
      "CHURN_PREDICTION",
      "ONBOARDING_INTELLIGENCE",
    ] as string[],
  },
};

export type AgentTier = "core" | "intelligence" | "full" | "custom";

interface AgentSelectorProps {
  selectedTier: AgentTier;
  selectedAgents: string[];
  onTierChange: (tier: AgentTier) => void;
  onAgentsChange: (agents: string[]) => void;
  disabled?: boolean;
}

// Format agent name for display
function formatAgentName(agent: string): string {
  return agent
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AgentSelector({
  selectedTier,
  selectedAgents,
  onTierChange,
  onAgentsChange,
  disabled = false,
}: AgentSelectorProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    core: true,
    intelligence: true,
    premium: true,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleAgent = (agent: string) => {
    if (selectedAgents.includes(agent)) {
      onAgentsChange(selectedAgents.filter((a) => a !== agent));
    } else {
      onAgentsChange([...selectedAgents, agent]);
    }
  };

  const selectAllInCategory = (category: string) => {
    const categoryAgents = AGENT_CATEGORIES[category as keyof typeof AGENT_CATEGORIES]?.agents || [];
    const filtered = categoryAgents.filter((a) => 
      a.toLowerCase().includes(search.toLowerCase())
    );
    const newAgents = [...new Set([...selectedAgents, ...filtered])];
    onAgentsChange(newAgents);
  };

  const deselectAllInCategory = (category: string) => {
    const categoryAgents = AGENT_CATEGORIES[category as keyof typeof AGENT_CATEGORIES]?.agents || [];
    const newAgents = selectedAgents.filter((a) => !categoryAgents.includes(a));
    onAgentsChange(newAgents);
  };

  const filteredAgents = (agents: string[]) =>
    agents.filter((a) => a.toLowerCase().includes(search.toLowerCase()));

  const getCategoryCount = (category: string) => {
    const categoryAgents = AGENT_CATEGORIES[category as keyof typeof AGENT_CATEGORIES]?.agents || [];
    const selected = categoryAgents.filter((a) => selectedAgents.includes(a));
    return selected.length;
  };

  return (
    <div className="space-y-4">
      {/* Tier Selection */}
      <div className="space-y-2">
        <Label>Agent Tier</Label>
        <div className="grid grid-cols-4 gap-2">
          {(["core", "intelligence", "full", "custom"] as AgentTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              disabled={disabled}
              onClick={() => {
                onTierChange(tier);
                if (tier === "core") {
                  onAgentsChange([...AGENT_CATEGORIES.core.agents]);
                } else if (tier === "intelligence") {
                  onAgentsChange([
                    ...AGENT_CATEGORIES.core.agents,
                    ...AGENT_CATEGORIES.intelligence.agents,
                  ]);
                } else if (tier === "full") {
                  onAgentsChange([
                    ...AGENT_CATEGORIES.core.agents,
                    ...AGENT_CATEGORIES.intelligence.agents,
                    ...AGENT_CATEGORIES.premium.agents,
                  ]);
                }
              }}
              className={`p-3 border rounded-lg text-center transition-colors ${
                selectedTier === tier
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="font-medium capitalize">{tier}</div>
              <div className="text-xs text-muted-foreground">
                {tier === "core" && "10 agents"}
                {tier === "intelligence" && "18 agents"}
                {tier === "full" && "34 agents"}
                {tier === "custom" && "Custom selection"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Selection (only for custom tier) */}
      {selectedTier === "custom" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Selected Agents</Label>
            <Badge variant="outline">{selectedAgents.length} agents</Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              disabled={disabled}
            />
          </div>

          {/* Categories */}
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
            {Object.entries(AGENT_CATEGORIES).map(([categoryKey, category]) => {
              const categorySelected = getCategoryCount(categoryKey);
              const filtered = filteredAgents(category.agents);

              return (
                <div key={categoryKey} className="border-b last:border-b-0 pb-2 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryKey)}
                    disabled={disabled}
                    className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      {expandedCategories[categoryKey] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {categorySelected}/{category.agents.length}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInCategory(categoryKey);
                        }}
                        disabled={disabled || filtered.length === 0}
                        className="h-6 px-2 text-xs"
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllInCategory(categoryKey);
                        }}
                        disabled={disabled || categorySelected === 0}
                        className="h-6 px-2 text-xs"
                      >
                        None
                      </Button>
                    </div>
                  </button>

                  {expandedCategories[categoryKey] && (
                    <div className="pl-6 pb-2 space-y-1">
                      {filtered.map((agent) => {
                        const isSelected = selectedAgents.includes(agent);
                        return (
                          <button
                            key={agent}
                            type="button"
                            onClick={() => toggleAgent(agent)}
                            disabled={disabled}
                            className="w-full flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer text-left"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <span className="text-sm">{formatAgentName(agent)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview for non-custom tiers */}
      {selectedTier !== "custom" && (
        <div className="space-y-2">
          <Label>Included Agents</Label>
          <div className="flex flex-wrap gap-1">
            {selectedAgents.map((agent) => (
              <Badge key={agent} variant="secondary" className="text-xs">
                {formatAgentName(agent)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Dialog version for selecting agents in a modal
interface AgentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: AgentTier;
  selectedAgents: string[];
  onTierChange: (tier: AgentTier) => void;
  onAgentsChange: (agents: string[]) => void;
}

export function AgentSelectorDialog({
  open,
  onOpenChange,
  selectedTier,
  selectedAgents,
  onTierChange,
  onAgentsChange,
}: AgentSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Agents</DialogTitle>
          <DialogDescription>
            Choose which agents are available for this plan. Select a tier for quick selection, or choose custom to select individually.
          </DialogDescription>
        </DialogHeader>
        <AgentSelector
          selectedTier={selectedTier}
          selectedAgents={selectedAgents}
          onTierChange={onTierChange}
          onAgentsChange={onAgentsChange}
        />
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
