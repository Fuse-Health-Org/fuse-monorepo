import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import Layout from '@/components/Layout'
import { BarChart3, ChevronRight, Eye, TrendingUp } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface FormListItem {
  id: string
  name: string
  productName: string
  publishedUrl?: string
  createdAt: string
}


export default function Analytics() {
  const { user, subscription, hasActiveSubscription, authenticatedFetch } = useAuth()
  const [forms, setForms] = useState<FormListItem[]>([])
  const [loading, setLoading] = useState(true)

  // Check if user has access to analytics
  const hasAccessToAnalytics =
    subscription?.customFeatures?.hasAccessToAnalytics ||
    subscription?.tierConfig?.hasAccessToAnalytics ||
    false

  useEffect(() => {
    if (hasAccessToAnalytics && user?.clinicId) {
      fetchForms()
    }
  }, [hasAccessToAnalytics, user?.clinicId])

  const fetchForms = async () => {
    try {
      setLoading(true)
      console.log('📊 Fetching forms from:', `${API_URL}/analytics/forms`)
      
      const response = await authenticatedFetch(`${API_URL}/analytics/forms`)
      
      console.log('📊 Response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('📊 Response data:', result)
        
        if (result.success) {
          console.log('📊 Forms found:', result.data.length)
          setForms(result.data)
        } else {
          console.error('📊 API returned success:false')
        }
      } else {
        console.error('📊 API error response:', response.status)
      }
    } catch (err) {
      console.error('📊 Error fetching forms:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!hasActiveSubscription ||!hasAccessToAnalytics) {
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
        <title>Form Analytics - Fuse</title>
      </Head>

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
            Form Analytics
          </h1>
          <p className="text-sm text-muted-foreground/60">
            Select a form to view detailed analytics and visitor tracking
          </p>
        </div>

        {/* Forms List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading forms...</div>
          </div>
        ) : forms.length === 0 ? (
          <Card className="bg-white border-gray-200/60">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No forms available
                </h3>
                <p className="text-muted-foreground">
                  Create intake forms to start tracking analytics
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <Link key={form.id} href={`/analytics/forms/${form.id}`}>
                <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-apple hover:shadow-apple-md hover:border-gray-300 transition-smooth cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-smooth">
                          {form.name}
                        </h3>
                        {form.publishedUrl && (
                          <Eye className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground/70">
                        {form.productName}
                      </p>
                      {form.publishedUrl && (
                        <p className="text-xs text-muted-foreground/50 mt-1 truncate max-w-md">
                          {form.publishedUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-primary">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm font-medium">View Analytics</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}


