"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface SafetyConfig {
  id: string;
  category: string;
  values: string[];
  action: string;
  isEnabled: boolean;
}

interface SafetyConfigManagerProps {
  initialConfigs: SafetyConfig[];
}

export function SafetyConfigManager({ initialConfigs }: SafetyConfigManagerProps) {
  const [configs, setConfigs] = useState<SafetyConfig[]>(initialConfigs);
  const [editingConfig, setEditingConfig] = useState<SafetyConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (config: SafetyConfig) => {
    setEditingConfig({ ...config, values: [...config.values] });
    setIsOpen(true);
  };

  const handleToggle = async (config: SafetyConfig) => {
    try {
      const response = await fetch(`/api/admin/safety/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !config.isEnabled }),
      });

      if (response.ok) {
        setConfigs(configs.map(c => 
          c.id === config.id ? { ...c, isEnabled: !c.isEnabled } : c
        ));
        toast.success(`Safety rule ${!config.isEnabled ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to toggle safety rule");
      }
    } catch {
      toast.error("Failed to toggle safety rule");
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/safety/${editingConfig.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: editingConfig.values,
          action: editingConfig.action,
          isEnabled: editingConfig.isEnabled,
        }),
      });

      if (response.ok) {
        setConfigs(configs.map(c => 
          c.id === editingConfig.id ? editingConfig : c
        ));
        toast.success("Safety config updated");
        setIsOpen(false);
      } else {
        toast.error("Failed to update safety config");
      }
    } catch {
      toast.error("Failed to update safety config");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Safety Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Values (count)</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{config.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {config.values.slice(0, 3).map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                      {config.values.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{config.values.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{config.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(config)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.isEnabled ? "bg-green-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No safety configs found. Run seed to populate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Safety Rule: {editingConfig?.category}</DialogTitle>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={editingConfig.category} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="values">Keywords/Values (one per line)</Label>
                <Textarea
                  id="values"
                  rows={10}
                  value={editingConfig.values.join("\n")}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    values: e.target.value.split("\n").filter(v => v.trim())
                  })}
                  placeholder="Enter keywords, one per line..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <select
                  id="action"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={editingConfig.action}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    action: e.target.value
                  })}
                >
                  <option value="block_publish">Block Publish</option>
                  <option value="escalate_critical">Escalate Critical</option>
                  <option value="flag_for_review">Flag for Review</option>
                  <option value="skip">Skip/Ignore</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={editingConfig.isEnabled}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    isEnabled: e.target.checked
                  })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isEnabled">Enabled</Label>
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
