"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { LLMProvider, LLMModel, RoutingRule } from "@prisma/client";

interface LLMModelWithProvider extends LLMModel {
  provider: LLMProvider;
}

interface LLMModelManagerProps {
  initialProviders: LLMProvider[];
  initialModels: LLMModelWithProvider[];
  initialRules: RoutingRule[];
}

const tierColors: Record<string, string> = {
  budget: "bg-green-500",
  mid: "bg-blue-500",
  flagship: "bg-purple-500",
};

export function LLMModelManager({ 
  initialProviders, 
  initialModels,
  initialRules 
}: LLMModelManagerProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [rules] = useState(initialRules);
  const [editingModel, setEditingModel] = useState<string | null>(null);

  const toggleProvider = async (providerId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/llm/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) throw new Error("Failed to update provider");

      setProviders(providers.map(p => 
        p.id === providerId ? { ...p, isActive } : p
      ));

      toast.success(`Provider ${isActive ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update provider");
    }
  };

  const toggleModel = async (modelId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/llm/models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) throw new Error("Failed to update model");

      setModels(models.map(m => 
        m.id === modelId ? { ...m, isActive } : m
      ));

      toast.success(`Model ${isActive ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update model");
    }
  };

  const updateModelPricing = async (modelId: string, field: string, value: number) => {
    try {
      const response = await fetch(`/api/admin/llm/models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) throw new Error("Failed to update pricing");

      setModels(models.map(m => 
        m.id === modelId ? { ...m, [field]: value } : m
      ));

      toast.success("Pricing updated");
    } catch {
      toast.error("Failed to update pricing");
    }
  };

  return (
    <Tabs defaultValue="providers" className="space-y-6">
      <TabsList>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="routing">Routing Rules</TabsTrigger>
      </TabsList>

      <TabsContent value="providers" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                  <Badge variant={provider.isActive ? "default" : "secondary"}>
                    {provider.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Health Status: {provider.healthStatus}</p>
                  <p>Last Check: {provider.lastHealthCheck 
                    ? new Date(provider.lastHealthCheck).toLocaleString() 
                    : "Never"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`provider-${provider.id}`}
                    checked={provider.isActive}
                    onCheckedChange={(checked: boolean) => toggleProvider(provider.id, checked)}
                  />
                  <Label htmlFor={`provider-${provider.id}`}>Enabled</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="models" className="space-y-4">
        <div className="grid gap-4">
          {models.map((model) => (
            <Card key={model.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{model.displayName}</CardTitle>
                    <Badge className={tierColors[model.tier]}>
                      {model.tier}
                    </Badge>
                    <Badge variant="outline">{model.provider.name}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={model.isActive ? "default" : "secondary"}>
                      {model.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={model.isActive}
                      onCheckedChange={(checked: boolean) => toggleModel(model.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingModel === model.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Input Price ($/1M)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={model.inputPricePer1M / 100}
                          onBlur={(e) => {
                            const value = Math.round(parseFloat(e.target.value) * 100);
                            updateModelPricing(model.id, "inputPricePer1M", value);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Output Price ($/1M)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={model.outputPricePer1M / 100}
                          onBlur={(e) => {
                            const value = Math.round(parseFloat(e.target.value) * 100);
                            updateModelPricing(model.id, "outputPricePer1M", value);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Max Output Tokens</Label>
                        <Input
                          type="number"
                          defaultValue={model.maxOutputTokens}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value);
                            updateModelPricing(model.id, "maxOutputTokens", value);
                          }}
                        />
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingModel(null)}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-sm space-y-1">
                      <p>Input: ${(model.inputPricePer1M / 100).toFixed(2)}/1M tokens</p>
                      <p>Output: ${(model.outputPricePer1M / 100).toFixed(2)}/1M tokens</p>
                      <p>Max Output: {model.maxOutputTokens.toLocaleString()} tokens</p>
                      <p>Context Window: {model.maxInputTokens.toLocaleString()} tokens</p>
                      {model.supportsCaching && model.cachedInputPricePer1M && (
                        <p>Cached Input: ${(model.cachedInputPricePer1M / 100).toFixed(2)}/1M tokens</p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingModel(model.id)}
                    >
                      Edit Pricing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="routing" className="space-y-4">
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Priority: {rule.priority}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {rule.description && <p>{rule.description}</p>}
                  <p>Match Agent: {rule.matchAgent || "Any"}</p>
                  <p>Match Task Type: {rule.matchTaskType || "Any"}</p>
                  <p>Match Tier: {rule.matchTier || "Any"}</p>
                  <p>Target Model ID: {rule.targetModelId}</p>
                  {rule.overrideTier && (
                    <p>Override Tier: {rule.overrideTier}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
