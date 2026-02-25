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

type Plan = "STARTER" | "GROWTH" | "PRO" | "ENTERPRISE" | "MANAGED_STANDARD" | "MANAGED_PREMIUM" | "WHITE_LABEL";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  planMinimum: Plan | null;
}

interface FeatureFlagManagerProps {
  initialFlags: FeatureFlag[];
}

const plans: Plan[] = [
  "STARTER",
  "GROWTH", 
  "PRO",
  "ENTERPRISE",
  "MANAGED_STANDARD",
  "MANAGED_PREMIUM",
  "WHITE_LABEL",
];

export function FeatureFlagManager({ initialFlags }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (flag: FeatureFlag) => {
    setEditingFlag({ ...flag });
    setIsOpen(true);
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const response = await fetch(`/api/admin/flags/${flag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !flag.isEnabled }),
      });

      if (response.ok) {
        setFlags(flags.map(f => 
          f.id === flag.id ? { ...f, isEnabled: !f.isEnabled } : f
        ));
        toast.success(`Feature ${!flag.isEnabled ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to toggle feature");
      }
    } catch {
      toast.error("Failed to toggle feature");
    }
  };

  const handleSave = async () => {
    if (!editingFlag) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/flags/${editingFlag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingFlag.name,
          description: editingFlag.description,
          isEnabled: editingFlag.isEnabled,
          planMinimum: editingFlag.planMinimum,
        }),
      });

      if (response.ok) {
        setFlags(flags.map(f => 
          f.id === editingFlag.id ? editingFlag : f
        ));
        toast.success("Feature flag updated");
        setIsOpen(false);
      } else {
        toast.error("Failed to update flag");
      }
    } catch {
      toast.error("Failed to update flag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Min Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                  <TableCell className="font-medium">{flag.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {flag.description || "-"}
                  </TableCell>
                  <TableCell>
                    {flag.planMinimum ? (
                      <Badge variant="outline">{flag.planMinimum}</Badge>
                    ) : (
                      <span className="text-muted-foreground">All</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(flag)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        flag.isEnabled ? "bg-green-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          flag.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(flag)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {flags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No feature flags found. Run seed to populate.
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
            <DialogTitle>Edit Feature: {editingFlag?.key}</DialogTitle>
          </DialogHeader>
          {editingFlag && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingFlag.name}
                  onChange={(e) => setEditingFlag({
                    ...editingFlag,
                    name: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editingFlag.description || ""}
                  onChange={(e) => setEditingFlag({
                    ...editingFlag,
                    description: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="planMinimum">Minimum Plan</Label>
                <select
                  id="planMinimum"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={editingFlag.planMinimum || ""}
                  onChange={(e) => setEditingFlag({
                    ...editingFlag,
                    planMinimum: (e.target.value as Plan) || null
                  })}
                >
                  <option value="">All plans</option>
                  {plans.map((plan) => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={editingFlag.isEnabled}
                  onChange={(e) => setEditingFlag({
                    ...editingFlag,
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
