"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2, Check } from "lucide-react";

interface CorrectionModalProps {
  contentId: string;
  agentName: string;
  originalContent: string;
  onCorrectionSubmit?: () => void;
}

export function CorrectionModal({
  contentId,
  agentName,
  originalContent,
  onCorrectionSubmit,
}: CorrectionModalProps) {
  const [open, setOpen] = useState(false);
  const [correctedContent, setCorrectedContent] = useState(originalContent);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/training/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          agentName,
          feedbackType: "correction",
          originalOutput: originalContent,
          correctedOutput: correctedContent,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        onCorrectionSubmit?.();
        setTimeout(() => {
          setOpen(false);
          setSubmitted(false);
        }, 1500);
      }
    } catch (error) {
      console.error("Error submitting correction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Pencil className="h-3 w-3" />
          Edit & Submit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit a Correction</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Original</label>
              <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                {originalContent}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Correction</label>
              <Textarea
                value={correctedContent}
                onChange={(e) => setCorrectedContent(e.target.value)}
                className="min-h-[150px]"
                placeholder="Edit the content to correct it..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || correctedContent === originalContent}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : submitted ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submitted!
                </>
              ) : (
                "Submit Correction"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
