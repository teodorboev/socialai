import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Calendar, BarChart3, MessageCircle, Zap, Shield, ArrowRight } from "lucide-react";

export default function LandingPage() {
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
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Your AI-Powered Social Media Manager
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Autonomous AI agents handle content creation, publishing, and engagement—so you can focus on running your business.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Start Free Trial <ArrowRight className="w-4 h-4" />
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
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Scale Your Social Media
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>AI Content Creation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Our AI generates on-brand posts tailored to your voice and audience—no more writer's block.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Smart Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Posts are automatically scheduled at optimal times for maximum engagement.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Auto Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  AI responds to comments and messages instantly—24/7—while you focus on your business.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle>Analytics & Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Weekly reports with AI-powered recommendations to continuously improve performance.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-pink-600" />
                </div>
                <CardTitle>Multi-Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Manage Instagram, Facebook, TikTok, Twitter, and LinkedIn from one dashboard.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-teal-600" />
                </div>
                <CardTitle>Brand Safety</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Configure what your AI should never say—complete control over your brand voice.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Connect Your Accounts</h3>
                <p className="text-muted-foreground">
                  Link your social media accounts in seconds. We support Instagram, Facebook, TikTok, Twitter, and LinkedIn.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Configure Your Brand</h3>
                <p className="text-muted-foreground">
                  Tell us about your brand voice, audience, and goals. Our AI learns your style and preferences.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Let AI Do the Work</h3>
                <p className="text-muted-foreground">
                  Our AI agents create content, schedule posts, engage with your audience, and report results—autonomously.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Automate Your Social Media?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of businesses saving 10+ hours per week with AI-powered social media management.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="gap-2">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} SocialAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
