import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center gap-4 h-14 max-w-4xl mx-auto px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Header Section */}
        <section className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Privacy Policy</h2>
          <p className="text-muted-foreground">Last updated: January 2025</p>
        </section>

        {/* Policy Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">1. Introduction</h3>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to StudyChat. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              By using StudyChat, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies, please do not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">2. Information We Collect</h3>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Account Information:</strong> Email address, username, profile picture, and bio when you create an account.</li>
              <li><strong className="text-foreground">Messages:</strong> Text messages, voice messages, and files you send through the app. Private messages are end-to-end encrypted.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Information about how you use the app, including features accessed and time spent.</li>
              <li><strong className="text-foreground">Device Information:</strong> Device type, operating system, and unique device identifiers.</li>
              <li><strong className="text-foreground">Interests:</strong> Study interests you select to help match you with study buddies.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">3. End-to-End Encryption</h3>
            <p className="text-muted-foreground leading-relaxed">
              Private messages in StudyChat are protected with end-to-end encryption. This means only you and the person you are communicating with can read your messages. We cannot access the content of your encrypted messages, even if required by law.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Encryption keys are generated and stored locally on your device. If you lose access to your device, encrypted message history may not be recoverable.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">4. How We Use Your Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process and deliver messages between users</li>
              <li>Match you with potential study buddies based on shared interests</li>
              <li>Send you notifications about messages, calls, and app updates</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">5. Information Sharing</h3>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">With Your Consent:</strong> When you explicitly agree to share information.</li>
              <li><strong className="text-foreground">Service Providers:</strong> With trusted third-party services that help us operate the app (e.g., hosting, analytics).</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> If required by law, court order, or government request.</li>
              <li><strong className="text-foreground">Safety:</strong> To protect the rights, property, or safety of our users or the public.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">6. Data Security</h3>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>End-to-end encryption for private messages</li>
              <li>Secure HTTPS connections for all data transfers</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication requirements</li>
              <li>Encrypted data storage</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">7. Data Retention</h3>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data at any time by contacting our support team.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              After account deletion, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal or regulatory purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">8. Your Rights</h3>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">9. Children's Privacy</h3>
            <p className="text-muted-foreground leading-relaxed">
              StudyChat is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">11. Contact Us</h3>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mt-2">
              <p className="text-foreground font-medium">StudyChat Support</p>
              <p className="text-muted-foreground">Email: privacy@studychat.app</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <section className="text-center text-sm text-muted-foreground pb-8 pt-4 border-t">
          <p>© {new Date().getFullYear()} StudyChat. All rights reserved.</p>
        </section>
      </main>
    </div>
  );
}
