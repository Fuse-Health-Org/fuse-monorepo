import Head from 'next/head'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyNotice() {
  return (
    <>
      <Head>
        <title>Privacy Notice - Fuse</title>
        <meta name="description" content="Privacy Notice regarding business information disclosure for Fuse Health" />
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
                  <CardTitle>Privacy Notice</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Business Information Disclosure - Last updated: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-gray max-w-none space-y-6">
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Notice of Privacy Practices</h2>
                  <p className="text-foreground/80 mb-4">
                    This notice describes how Fuse Health may use and disclose your business information and how you can access this information.
                    Please review it carefully. By using our platform as a brand partner, you acknowledge that you have read and understand this notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Business Information We Collect</h2>
                  <p className="text-foreground/80 mb-4">
                    As part of your brand partner account, we collect and maintain the following types of business information:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>Company name and legal business name</li>
                    <li>Business type and industry classification</li>
                    <li>Business address, city, state, and ZIP code</li>
                    <li>Phone number and email address</li>
                    <li>Website URL</li>
                    <li>Business registration and licensing information (when applicable)</li>
                    <li>Tax identification numbers (when required for billing)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">How We Use Your Business Information</h2>
                  <p className="text-foreground/80 mb-4">
                    We use your business information for the following purposes:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li>To create and manage your brand partner account</li>
                    <li>To display your business information to patients and other users of the platform</li>
                    <li>To facilitate communication between your business and patients</li>
                    <li>To process payments and manage billing</li>
                    <li>To provide customer support and technical assistance</li>
                    <li>To comply with legal and regulatory requirements</li>
                    <li>To improve our services and platform functionality</li>
                    <li>To send you important updates and notifications about your account</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Disclosure of Business Information</h2>
                  <p className="text-foreground/80 mb-4">
                    We may disclose your business information in the following circumstances:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li><strong>To Patients:</strong> Your business name, type, address, contact information, and website may be displayed to patients searching for healthcare services on our platform</li>
                    <li><strong>To Service Providers:</strong> We may share information with third-party service providers who assist us in operating our platform, subject to confidentiality agreements</li>
                    <li><strong>For Legal Compliance:</strong> We may disclose information when required by law, court order, or regulatory authority</li>
                    <li><strong>For Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your business information may be transferred as part of the transaction</li>
                    <li><strong>With Your Consent:</strong> We may share information with other parties when you explicitly authorize such disclosure</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Your Rights Regarding Business Information</h2>
                  <p className="text-foreground/80 mb-4">
                    You have the following rights regarding your business information:
                  </p>
                  <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
                    <li><strong>Access:</strong> You can access and review your business information at any time through your account settings</li>
                    <li><strong>Correction:</strong> You can update or correct your business information through your account settings</li>
                    <li><strong>Deletion:</strong> You may request deletion of your account and business information, subject to legal retention requirements</li>
                    <li><strong>Restriction:</strong> You can request restrictions on how we use or disclose certain information</li>
                    <li><strong>Portability:</strong> You can request a copy of your business information in a portable format</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Public Display of Information</h2>
                  <p className="text-foreground/80 mb-4">
                    Please be aware that certain business information you provide may be displayed publicly on our platform to help patients find and contact your business.
                    This includes your company name, business type, address, phone number, and website. You can control some of this information through your account privacy settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Security Measures</h2>
                  <p className="text-foreground/80 mb-4">
                    We implement industry-standard security measures to protect your business information from unauthorized access, use, or disclosure.
                    However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Changes to This Notice</h2>
                  <p className="text-foreground/80 mb-4">
                    We reserve the right to modify this Privacy Notice at any time. We will notify you of any material changes through email or through a notice on our platform.
                    Your continued use of our services after such modifications constitutes your acknowledgment of the modified notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Questions and Complaints</h2>
                  <p className="text-foreground/80 mb-2">
                    If you have questions about this Privacy Notice or wish to file a complaint regarding our use or disclosure of your business information, please contact us at:
                  </p>
                  <div className="mt-2 text-foreground/80 space-y-1">
                    <p>Email: privacy@fusehealth.com</p>
                    <p>Phone: 1-800-PRIVACY</p>
                    <p className="mt-4">
                      You also have the right to file a complaint with the appropriate regulatory authority if you believe your privacy rights have been violated.
                    </p>
                  </div>
                </section>

                <section className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-foreground/80">
                    <strong>By using our platform as a brand partner, you acknowledge that you have read, understood, and agree to the terms of this Privacy Notice.</strong>
                  </p>
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

