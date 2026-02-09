import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import { FormAnalytics } from '@/components/form-analytics-detail'
import { BarChart3, ArrowLeft, ExternalLink } from 'lucide-react'

export default function FormAnalyticsPage() {
  const router = useRouter()
  const { formId } = router.query
  const { user, subscription, hasActiveSubscription } = useAuth()
  const [formInfo, setFormInfo] = useState<{ name: string; publishedUrl: string } | null>(null)

  // Check if user has access to analytics
  const hasAccessToAnalytics =
    subscription?.customFeatures?.hasAccessToAnalytics ||
    subscription?.tierConfig?.hasAccessToAnalytics ||
    false

  useEffect(() => {
    if (formId) {
      // You can fetch form info here if needed
      setFormInfo({
        name: 'Intake Form',
        publishedUrl: '/form-url'
      })
    }
  }, [formId])

  if (!hasActiveSubscription || !hasAccessToAnalytics) {
    return (
      <Layout>
        <Head>
          <title>Analytics - Fuse</title>
        </Head>

        <div className="p-8">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <BarChart3 className="h-8 w-8 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Upgrade to Access Analytics
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analytics features are available on higher tier plans. Upgrade your plan to access detailed form analytics and visitor tracking.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Form Analytics - {formInfo?.name || 'Loading...'}</title>
      </Head>

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link href="/analytics">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Forms
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
                {formInfo?.name || 'Form Analytics'}
              </h1>
              <p className="text-sm text-muted-foreground/60">
                Track visitor behavior, completion rates, and form performance
              </p>
            </div>
            
            {formInfo?.publishedUrl && (
              <Link href={formInfo.publishedUrl} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Form
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Form Analytics Component */}
        {formId && <FormAnalytics formId={formId as string} />}
      </div>
    </Layout>
  )
}
