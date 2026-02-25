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

type Platform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";

interface PlatformConfig {
  id: string;
  platform: Platform;
  displayName: string;
  maxCaptionLength: number;
  maxHashtags: number;
  supportedContentTypes: string[];
  isEnabled: boolean;
  guidelines: string;
}

interface PlatformConfigManagerProps {
  initialConfigs: PlatformConfig[];
}

export function PlatformConfigManager({ initialConfigs }: PlatformConfigManagerProps) {
  const [configs, setConfigs] = useState<PlatformConfig[]>(initialConfigs);
  const [editingConfig, setEditingConfig] = useState<PlatformConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (config: PlatformConfig) => {
    setEditingConfig({ ...config });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/platforms/${editingConfig.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxCaptionLength: editingConfig.maxCaptionLength,
          maxHashtags: editingConfig.maxHashtags,
          guidelines: editingConfig.guidelines,
          isEnabled: editingConfig.isEnabled,
        }),
      });

      if (response.ok) {
        setConfigs(configs.map(c => 
          c.id === editingConfig.id ? editingConfig : c
        ));
        toast.success("Platform config updated");
        setIsOpen(false);
      } else {
        toast.error("Failed to update config");
      }
    } catch {
      toast.error("Failed to update config");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Max Caption</TableHead>
                <TableHead>Max Hashtags</TableHead>
                <TableHead>Content Types</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.platform}</TableCell>
                  <TableCell>{config.displayName}</TableCell>
                  <TableCell>{config.maxCaptionLength}</TableCell>
                  <TableCell>{config.maxHashtags}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {config.supportedContentTypes.slice(0, 3).map((type) => (
                        <Badge key={type} variant="secondary">
                          {type}
                        </Badge>
                      ))}
                      {config.supportedContentTypes.length > 3 && (
                        <Badge variant="secondary">
                          +{config.supportedContentTypes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.isEnabled ? "default" : "destructive"}>
                      {config.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
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
                  <TableCell colSpan={7} className="text-center py-8">
                    No platform configs found. Run seed to populate.
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
            <DialogTitle>Edit {editingConfig?.displayName}</DialogTitle>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCaption">Max Caption Length</Label>
                  <Input
                    id="maxCaption"
                    type="number"
                    value={editingConfig.maxCaptionLength}
                    onChange={(e) => setEditingConfig({
                      ...editingConfig,
                      maxCaptionLength: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxHashtags">Max Hashtags</Label>
                  <Input
                    id="maxHashtags"
                    type="number"
                    value={editingConfig.maxHashtags}
                    onChange={(e) => setEditingConfig({
                      ...editingConfig,
                      maxHashtags: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="guidelines">Content Guidelines</Label>
                <Textarea
                  id="guidelines"
                  rows={6}
                  value={editingConfig.guidelines || ""}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    guidelines: e.target.value
                  })}
                  placeholder="Platform-specific posting guidelines for Content Creator agent..."
                />
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
                <Label htmlFor="isEnabled">Platform Enabled</Label>
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
