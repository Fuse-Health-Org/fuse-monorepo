import Head from 'next/head'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Fuse</title>
        <meta name="description" content="Privacy Policy for Fuse Health" />
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
                  <CardTitle>Privacy Policy</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-gray max-w-none space-y-6">
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Information Collection and Use</h2>
                  <p className="text-foreground/80 mb-4">
                    Fuse Health is committed to protecting your privacy and ensuring the security of your personal and business information.
                    We collect only the information necessary to provide you with quality healthcare services and maintain compliance with HIPAA regulations.
                    As a brand partner, we collect business information to facilitate your use of our platform and manage your account.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Types of Information We Collect</h2>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Personal identification information (name, email, phone number)</li>
                    <li>Business information (company name, business type, website, address)</li>
                    <li>Healthcare information and medical records (when applicable)</li>
                    <li>Insurance and billing information</li>
                    <li>Device and usage information for service improvement</li>
                    <li>Account credentials and authentication data</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">How We Protect Your Information</h2>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>End-to-end encryption for all data transmission</li>
                    <li>Secure, HIPAA-compliant data storage</li>
                    <li>Multi-factor authentication and access controls</li>
                    <li>Regular security audits and compliance monitoring</li>
                    <li>Employee training on privacy and security protocols</li>
                    <li>Secure backup and disaster recovery procedures</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Information Sharing</h2>
                  <p className="text-foreground/80 mb-4">
                    We do not sell, trade, or otherwise transfer your personal information to third parties except as outlined in our
                    Privacy Notice or as required by law. We may share information with:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Healthcare providers involved in patient care</li>
                    <li>Insurance companies for billing purposes</li>
                    <li>Legal authorities when required by law</li>
                    <li>Service providers under strict confidentiality agreements</li>
                    <li>Business partners necessary to provide our services</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Your Rights</h2>
                  <p className="text-foreground/80 mb-4">
                    Under HIPAA and applicable privacy laws, you have the right to:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Access and obtain copies of your health information</li>
                    <li>Request corrections to your health information</li>
                    <li>Request restrictions on use or disclosure of your information</li>
                    <li>Request confidential communications</li>
                    <li>File a complaint if you believe your privacy rights have been violated</li>
                    <li>Request deletion of your account and associated data (subject to legal retention requirements)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Cookies and Tracking</h2>
                  <p className="text-foreground/80 mb-4">
                    We use cookies and similar tracking technologies to improve your experience on our platform,
                    analyze usage patterns, and provide personalized content. You can control cookie preferences through your browser settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Data Retention</h2>
                  <p className="text-foreground/80 mb-4">
                    We retain your information for as long as necessary to provide our services and comply with legal obligations.
                    Healthcare records are retained in accordance with applicable healthcare regulations and state laws.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Contact Information</h2>
                  <p className="text-foreground/80 mb-2">
                    If you have questions about this Privacy Policy or your privacy rights, please contact our Privacy Officer at:
                  </p>
                  <div className="mt-2 text-foreground/80 space-y-1">
                    <p>Email: privacy@fusehealth.com</p>
                    <p>Phone: 1-800-PRIVACY</p>
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

