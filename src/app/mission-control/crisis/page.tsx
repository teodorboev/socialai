"use client";

import { useState } from "react";
import { CrisisModeOverlay } from "@/components/crisis-mode/crisis-overlay";

export default function CrisisModePage() {
  const [resolved, setResolved] = useState(false);

  if (resolved) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Crisis Resolved</h1>
          <p className="text-slate-400 mb-6">Normal operations have resumed.</p>
          <a href="/mission-control" className="text-blue-400 hover:underline">
            Return to Mission Control
          </a>
        </div>
      </div>
    );
  }

  return <CrisisModeOverlay onResolve={() => setResolved(true)} />;
}
