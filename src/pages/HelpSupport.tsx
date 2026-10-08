import { ArrowLeft, MessageCircle, Mail, BookOpen, Shield, Zap, Users, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function HelpSupport() {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "How do I start a new conversation?",
      answer: "Tap the new chat button in the bottom navigation or sidebar. You can search for users by username or start a group chat by selecting multiple participants."
    },
    {
      question: "Are my messages encrypted?",
      answer: "Yes! All private messages use end-to-end encryption. This means only you and the recipient can read your messages. Not even we can access them."
    },
    {
      question: "How do I make voice or video calls?",
      answer: "Open a conversation and tap the phone or video icon in the chat header. The recipient will receive a call notification and can accept or decline."
    },
    {
      question: "How do I create a channel?",
      answer: "Go to the channels section and tap 'Create Channel'. Channels are public broadcast spaces where only admins can post, but anyone can subscribe and comment."
    },
    {
      question: "How do I find study buddies?",
      answer: "Use the Study Buddies feature to discover other students with similar interests. You can like or pass on profiles, and if there's a mutual match, you can start chatting!"
    },
    {
      question: "Can I use the app offline?",
      answer: "Some features work offline when you install the app. Previously loaded messages are cached, but sending new messages requires an internet connection."
    },
    {
      question: "How do I delete my account?",
      answer: "Contact our support team to request account deletion. All your data will be permanently removed within 30 days of the request."
    }
  ];

  const features = [
    {
      icon: MessageCircle,
      title: "Messaging",
      description: "Send text, voice messages, files, and more with end-to-end encryption."
    },
    {
      icon: Users,
      title: "Groups & Channels",
      description: "Create study groups or subscribe to educational channels."
    },
    {
      icon: Zap,
      title: "AI Assistant",
      description: "Get help with your studies using our built-in AI chat feature."
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Your data is encrypted and we never sell your information."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center gap-4 h-14 max-w-4xl mx-auto px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Help & Support</h1>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Welcome Section */}
        <section className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">How can we help?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Find answers to common questions or reach out to our support team.
          </p>
        </section>

        {/* Quick Features Overview */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">App Features</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Contact Support */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Still need help?</h3>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="outline" 
                  className="flex-1 h-auto py-4"
                  onClick={() => window.open('mailto:support@studychat.app', '_blank')}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Mail className="h-6 w-6" />
                    <span className="font-medium">Email Support</span>
                    <span className="text-xs text-muted-foreground">support@studychat.app</span>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-auto py-4"
                  onClick={() => window.open('https://docs.studychat.app', '_blank')}
                >
                  <div className="flex flex-col items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    <span className="font-medium">Documentation</span>
                    <span className="text-xs text-muted-foreground">Browse our guides</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* App Version */}
        <section className="text-center text-sm text-muted-foreground pb-8">
          <p>App Version 1.0.0</p>
          <p className="mt-1">© {new Date().getFullYear()} StudyChat. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
}
