"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type EscalationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface EscalationRule {
  id: string;
  name: string;
  triggerType: string;
  triggerValue: string;
  action: string;
  priority: EscalationPriority;
  isEnabled: boolean;
}

interface EscalationRuleManagerProps {
  initialRules: EscalationRule[];
}

export function EscalationRuleManager({ initialRules }: EscalationRuleManagerProps) {
  const [rules, setRules] = useState<EscalationRule[]>(initialRules);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (rule: EscalationRule) => {
    setEditingRule({ ...rule });
    setIsOpen(true);
  };

  const handleToggle = async (rule: EscalationRule) => {
    try {
      const response = await fetch(`/api/admin/escalations/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === rule.id ? { ...r, isEnabled: !r.isEnabled } : r
        ));
        toast.success(`Rule ${!rule.isEnabled ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to update rule");
      }
    } catch {
      toast.error("Failed to update rule");
    }
  };

  const handleSave = async () => {
    if (!editingRule) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/escalations/${editingRule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingRule.name,
          triggerType: editingRule.triggerType,
          triggerValue: editingRule.triggerValue,
          action: editingRule.action,
          priority: editingRule.priority,
          isEnabled: editingRule.isEnabled,
        }),
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === editingRule.id ? editingRule : r
        ));
        toast.success("Escalation rule updated");
        setIsOpen(false);
      } else {
        toast.error("Failed to update rule");
      }
    } catch {
      toast.error("Failed to update rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Global Escalation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger Type</TableHead>
                <TableHead>Trigger Value</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.triggerType}</TableCell>
                  <TableCell className="font-mono text-sm">{rule.triggerValue}</TableCell>
                  <TableCell>{rule.action}</TableCell>
                  <TableCell>
                    <Badge variant={
                      rule.priority === "CRITICAL" ? "destructive" :
                      rule.priority === "HIGH" ? "default" :
                      rule.priority === "MEDIUM" ? "secondary" : "outline"
                    }>
                      {rule.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.isEnabled ? "bg-green-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No escalation rules found. Run seed to populate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Escalation Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="triggerType">Trigger Type</Label>
                  <select
                    id="triggerType"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editingRule.triggerType}
                    onChange={(e) => setEditingRule({ ...editingRule, triggerType: e.target.value })}
                  >
                    <option value="keyword">Keyword</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="volume">Volume</option>
                    <option value="competitor">Competitor Mention</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="triggerValue">Trigger Value</Label>
                  <Input
                    id="triggerValue"
                    value={editingRule.triggerValue}
                    onChange={(e) => setEditingRule({ ...editingRule, triggerValue: e.target.value })}
                    placeholder="e.g., refund, urgent, negative"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <select
                    id="action"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editingRule.action}
                    onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
                  >
                    <option value="escalate_critical">Escalate Critical</option>
                    <option value="escalate_high">Escalate High</option>
                    <option value="flag_for_review">Flag for Review</option>
                    <option value="auto_dm">Auto DM Response</option>
                    <option value="skip">Skip/Ignore</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editingRule.priority}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: e.target.value as EscalationPriority })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={editingRule.isEnabled}
                  onChange={(e) => setEditingRule({ ...editingRule, isEnabled: e.target.checked })}
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
