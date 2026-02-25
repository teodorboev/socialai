"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertTriangle, Shield, ShieldAlert, ShieldCheck, Pause, Play,
  MessageCircle, TrendingUp, Eye, Clock, CheckCircle, X, Send,
  ArrowLeft, Sparkles
} from "lucide-react";
import Link from "next/link";

interface CrisisData {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  sentiment: number; // percentage negative
  mentions: number;
  mentionTrend: number[]; // [prev, current]
  postsAffected: number;
  aiDraftResponse?: string;
  recommendedResponse?: string;
  alternativeResponses: string[];
}

// Mock crisis data
const MOCK_CRISIS: CrisisData = {
  id: "1",
  severity: "high",
  title: "Negative mention spike detected",
  description: 'A customer posted a video claiming your moisturizer caused a skin reaction. The video has 15K views and 200+ comments in the last 2 hours. Sentiment is 78% negative.',
  sentiment: 78,
  mentions: 58,
  mentionTrend: [47, 52, 58],
  postsAffected: 3,
  recommendedResponse: "We're sorry to hear about your experience. Your skin's comfort is our top priority. We'd love to learn more — please DM us so we can help directly and make this right.",
  alternativeResponses: [
    "We take all feedback seriously. Please reach out to our support team so we can address this personally.",
    "Thanks for bringing this to our attention. We're looking into it and will follow up soon.",
  ],
};

interface CrisisModeOverlayProps {
  crisis?: CrisisData;
  onResolve: () => void;
}

export function CrisisModeOverlay({ crisis = MOCK_CRISIS, onResolve }: CrisisModeOverlayProps) {
  const [selectedResponse, setSelectedResponse] = useState<string | null>(crisis.recommendedResponse || null);
  const [customResponse, setCustomResponse] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const severityColors = {
    low: "bg-yellow-500/20 border-yellow-500 text-yellow-400",
    medium: "bg-orange-500/20 border-orange-500 text-orange-400",
    high: "bg-red-500/20 border-red-500 text-red-400",
    critical: "bg-red-600/40 border-red-600 text-red-300 animate-pulse",
  };

  const sentimentColor = crisis.sentiment > 70 ? "text-red-400" : 
                         crisis.sentiment > 50 ? "text-orange-400" : "text-yellow-400";

  async function handlePublish() {
    setIsPublishing(true);
    // Simulate publishing
    await new Promise(resolve => setTimeout(resolve, 1500));
    setPublished(true);
    setIsPublishing(false);
  }

  const responseToUse = customResponse.trim() || selectedResponse || "";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-red-900/30 border-b border-red-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-400 animate-pulse" />
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Crisis Mode — Content Paused
              </h1>
              <p className="text-red-300 text-sm">All scheduled posts have been temporarily halted</p>
            </div>
          </div>
          <Link href="/mission-control">
            <Button variant="outline" className="border-red-600 text-red-400 hover:bg-red-900/20">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Exit Crisis Mode
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Crisis Info */}
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                {crisis.title}
              </CardTitle>
              <Badge className={severityColors[crisis.severity]}>
                {crisis.severity.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">{crisis.description}</p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{crisis.mentions}</div>
                <div className="text-sm text-slate-400">Mentions</div>
                <div className="text-xs text-red-400 mt-1">
                  ↑ {crisis.mentionTrend[2] - crisis.mentionTrend[0]} today
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${sentimentColor}`}>{crisis.sentiment}%</div>
                <div className="text-sm text-slate-400">Negative Sentiment</div>
                <div className="text-xs text-slate-500 mt-1">Stable</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{crisis.postsAffected}</div>
                <div className="text-sm text-slate-400">Posts Affected</div>
                <div className="text-xs text-slate-500 mt-1">Paused</div>
              </div>
            </div>

            {/* Actions Taken */}
            <div className="mt-4 p-3 bg-slate-800/30 rounded-lg">
              <p className="text-sm font-medium text-white mb-2">What I've done:</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Paused all scheduled content
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Paused auto-replies on all platforms
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Drafted response options below
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Response Options */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recommended Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Response */}
            <div className="p-4 bg-slate-800/50 rounded-lg border-2 border-blue-500">
              <p className="text-white">{crisis.recommendedResponse}</p>
              <div className="flex gap-2 mt-4">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handlePublish}
                  disabled={isPublishing || published}
                >
                  {isPublishing ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Publishing...
                    </>
                  ) : published ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Published!
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Approve & Post
                    </>
                  )}
                </Button>
                <Button variant="outline" className="border-slate-600">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>

            {/* Alternative Responses */}
            <div>
              <Button 
                variant="link" 
                className="text-blue-400 p-0"
                onClick={() => setShowAlternatives(!showAlternatives)}
              >
                {showAlternatives ? "Hide" : "See"} other options
              </Button>
              
              {showAlternatives && (
                <div className="mt-3 space-y-3">
                  {crisis.alternativeResponses.map((response, i) => (
                    <div 
                      key={i}
                      className={`p-4 bg-slate-800/30 rounded-lg cursor-pointer transition-all ${
                        selectedResponse === response ? "border-2 border-blue-500" : "border-2 border-transparent hover:border-slate-600"
                      }`}
                      onClick={() => setSelectedResponse(response)}
                    >
                      <p className="text-slate-300 text-sm">{response}</p>
                    </div>
                  ))}
                  
                  {/* Custom Response */}
                  <div className="p-4 bg-slate-800/30 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Or write your own:</p>
                    <Textarea 
                      placeholder="Type your custom response..."
                      value={customResponse}
                      onChange={(e) => setCustomResponse(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Monitoring */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              Live Monitoring
              <Badge variant="secondary" className="ml-auto bg-blue-500/20 text-blue-400">
                Updates every 5 min
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400">Last updated:</span>
                <span className="text-white">Just now</span>
              </div>
              <div className="flex-1" />
              <div className="text-slate-400">
                Mentions: <span className="text-red-400 font-medium">{crisis.mentions}</span> → 
                {crisis.mentionTrend[2] > crisis.mentionTrend[1] ? " rising" : " stable"}
              </div>
              <div className="text-slate-400">
                Sentiment: <span className={sentimentColor}>{crisis.sentiment}%</span> negative
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resume Operations */}
        <div className="flex justify-center pt-4">
          <Button 
            variant="outline" 
            className="border-green-600 text-green-400 hover:bg-green-900/20"
            onClick={onResolve}
          >
            <Play className="h-4 w-4 mr-2" />
            Resume Normal Operations
          </Button>
        </div>
      </main>
    </div>
  );
}

// Compact crisis indicator for Mission Control header
export function CrisisIndicator({ onClick }: { onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
    >
      <ShieldAlert className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-medium">Crisis Detected</span>
    </button>
  );
}
