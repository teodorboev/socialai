"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Calendar, BarChart3, MessageCircle, Zap, Shield, ArrowRight } from "lucide-react";

export default function LandingPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">SocialAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Your AI Social Media Manager
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Autonomous AI agents that create, schedule, and optimize your social media content.
            You monitor. We operate.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything Your Social Media Team Does — Automated
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Zap className="w-10 h-10 text-yellow-500 mb-2" />
                <CardTitle>AI Content Creation</CardTitle>
                <CardDescription>
                  Autonomous agents generate engaging posts tailored to your brand voice
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Calendar className="w-10 h-10 text-blue-500 mb-2" />
                <CardTitle>Smart Scheduling</CardTitle>
                <CardDescription>
                  Posts published at optimal times based on your audience's activity
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <MessageCircle className="w-10 h-10 text-green-500 mb-2" />
                <CardTitle>Auto Engagement</CardTitle>
                <CardDescription>
                  AI responds to comments and DMs instantly, escalating when needed
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="w-10 h-10 text-purple-500 mb-2" />
                <CardTitle>Analytics & Insights</CardTitle>
                <CardDescription>
                  Detailed performance reports with AI-powered recommendations
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="w-10 h-10 text-red-500 mb-2" />
                <CardTitle>Compliance Guard</CardTitle>
                <CardDescription>
                  Automated checks ensure content meets platform guidelines
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Bot className="w-10 h-10 text-indigo-500 mb-2" />
                <CardTitle>Trend Detection</CardTitle>
                <CardDescription>
                  AI spots trending topics and creates relevant content in minutes
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to automate your social media?
          </h2>
          <p className="text-gray-600 mb-8">
            Join hundreds of brands saving 10+ hours per week with AI-powered social media management.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-gray-500 text-sm">
          <p>&copy; 2026 SocialAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
