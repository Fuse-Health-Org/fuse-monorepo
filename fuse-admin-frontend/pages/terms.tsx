import Head from 'next/head'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service - Fuse</title>
        <meta name="description" content="Terms of Service for Fuse Health" />
      </Head>

      <div className="h-screen bg-background overflow-y-auto">
        <div className="flex items-center justify-center p-4 min-h-full">
          <div className="w-full max-w-4xl space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-3 mb-4">
                <Link href="/signup">
                  <Button variant="ghost" size="icon" aria-label="Go back">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <CardTitle>Terms of Service</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-gray max-w-none space-y-6">
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Acceptance of Terms</h2>
                  <p className="text-foreground/80 mb-4">
                    By accessing and using Fuse Health's services, you accept and agree to be bound by the terms and provision of this agreement.
                    These terms apply to all users of the service, including brand partners, healthcare providers, and administrators.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Service Description</h2>
                  <p className="text-foreground/80 mb-4">
                    Fuse Health provides a secure, HIPAA-compliant platform for managing healthcare information,
                    facilitating communication between patients and providers, and supporting healthcare delivery services.
                    As a brand partner, you can manage your business profile, offerings, and customer relationships through our platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">User Responsibilities</h2>
                  <h3 className="text-lg font-medium mb-2 text-foreground">Account Security</h3>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 mb-4 ml-4">
                    <li>Maintain the confidentiality of your account credentials</li>
                    <li>Use strong passwords and enable multi-factor authentication when available</li>
                    <li>Notify us immediately of any unauthorized use of your account</li>
                    <li>Log out of your account when using shared devices</li>
                  </ul>

                  <h3 className="text-lg font-medium mb-2 text-foreground">Appropriate Use</h3>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Use the service only for legitimate healthcare business purposes</li>
                    <li>Provide accurate and complete information about your business</li>
                    <li>Respect the privacy and confidentiality of patient information</li>
                    <li>Comply with all applicable laws and regulations, including HIPAA</li>
                    <li>Maintain accurate business information and update it promptly when changes occur</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Prohibited Activities</h2>
                  <p className="text-foreground/80 mb-4">Users may not:</p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Share account credentials with unauthorized persons</li>
                    <li>Attempt to gain unauthorized access to other accounts or systems</li>
                    <li>Upload malicious content or attempt to compromise system security</li>
                    <li>Use the service for any illegal or unauthorized purpose</li>
                    <li>Interfere with or disrupt the service or servers</li>
                    <li>Misrepresent your business or services</li>
                    <li>Violate any applicable healthcare regulations or standards</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Privacy and Data Protection</h2>
                  <p className="text-foreground/80 mb-4">
                    We are committed to protecting your privacy and complying with HIPAA regulations.
                    Your use of our service is also governed by our Privacy Policy and Privacy Notice,
                    which are incorporated into these Terms by reference.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Service Availability</h2>
                  <p className="text-foreground/80 mb-4">
                    While we strive to maintain continuous service availability, we cannot guarantee uninterrupted access.
                    We reserve the right to modify, suspend, or discontinue the service with appropriate notice to users.
                    Scheduled maintenance will be communicated in advance when possible.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Limitation of Liability</h2>
                  <p className="text-foreground/80 mb-4">
                    This service is a tool to facilitate healthcare communication and record management.
                    It does not replace professional medical advice, diagnosis, or treatment.
                    Always seek the advice of qualified healthcare providers with any questions
                    you may have regarding medical conditions or patient care.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Changes to Terms</h2>
                  <p className="text-foreground/80 mb-4">
                    We reserve the right to modify these terms at any time.
                    We will notify users of significant changes through the service or via email.
                    Continued use of the service after changes constitutes acceptance of the new terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Contact Information</h2>
                  <p className="text-foreground/80 mb-2">
                    If you have questions about these Terms of Service, please contact us at:
                  </p>
                  <div className="mt-2 text-foreground/80 space-y-1">
                    <p>Email: legal@fusehealth.com</p>
                    <p>Phone: 1-800-SUPPORT</p>
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </>
  )
}

