"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

interface ThumbsRatingProps {
  contentId: string;
  agentName: string;
  onRatingSubmit?: (rating: number) => void;
}

export function ThumbsRating({ contentId, agentName, onRatingSubmit }: ThumbsRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRating = async (value: number) => {
    setLoading(true);
    try {
      const response = await fetch("/api/training/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          agentName,
          feedbackType: "thumbs",
          rating: value,
        }),
      });

      if (response.ok) {
        setRating(value);
        setSubmitted(true);
        onRatingSubmit?.(value);
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {rating === 1 ? (
          <>
            <ThumbsUp className="h-4 w-4 text-green-500" />
            <span>Thanks for your feedback!</span>
          </>
        ) : (
          <>
            <ThumbsDown className="h-4 w-4 text-red-500" />
            <span>Thanks for your feedback!</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Was this helpful?</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRating(1)}
        disabled={loading}
        className="gap-1"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
        Yes
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRating(0)}
        disabled={loading}
        className="gap-1"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
        No
      </Button>
    </div>
  );
}
