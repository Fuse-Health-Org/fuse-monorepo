import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from '@/contexts/AuthContext'
import { 
  Eye, 
  Clock, 
  Users, 
  TrendingUp, 
  Mail, 
  Phone, 
  BarChart3,
  ChevronDown,
  ChevronUp,
  ChevronRight
} from "lucide-react"

interface FormStep {
  stepNumber: number
  questionId: string
  questionText: string
  questionType: string
}

interface StageMetrics {
  stepNumber: number
  questionText: string
  reached: number // Number who reached this step
  completed: number // Number who completed this step
  dropoffs: number // Number who dropped off at this step
  dropoffRate: number // Percentage who dropped off
}

interface FormSession {
  sessionId: string
  userId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  viewDuration: number // in seconds
  lastStepReached: number // Step number (1-based)
  totalSteps: number
  completionRate: number // Percentage 0-100
  lastViewed: string
  converted: boolean
  currentStage: string // Human-readable current step name
}

interface FormAnalyticsData {
  formId: string
  formName: string
  totalSessions: number
  completionRate: number
  averageDuration: number
  formSteps: FormStep[]
  stageMetrics: StageMetrics[]
  sessions: FormSession[]
  dailyStats: Array<{
    date: string
    started: number
    completed: number
  }>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Mock data showing dynamic form structure
const getMockData = (): FormAnalyticsData => ({
  formId: 'mock-form-1',
  formName: 'Semaglutide Intake Form',
  totalSessions: 36,
  completionRate: 72,
  averageDuration: 224,
  formSteps: [
    { stepNumber: 1, questionId: 'q1', questionText: 'Product Selection', questionType: 'selection' },
    { stepNumber: 2, questionId: 'q2', questionText: 'Medical History Questions', questionType: 'questionnaire' },
    { stepNumber: 3, questionId: 'q3', questionText: 'Checkout & Payment', questionType: 'payment' },
    { stepNumber: 4, questionId: 'q4', questionText: 'Account Creation', questionType: 'account' },
  ],
  stageMetrics: [
    { stepNumber: 1, questionText: 'Product Selection', reached: 36, completed: 32, dropoffs: 4, dropoffRate: 11 },
    { stepNumber: 2, questionText: 'Medical History Questions', reached: 32, completed: 28, dropoffs: 4, dropoffRate: 13 },
    { stepNumber: 3, questionText: 'Checkout & Payment', reached: 28, completed: 26, dropoffs: 2, dropoffRate: 7 },
    { stepNumber: 4, questionText: 'Account Creation', reached: 26, completed: 26, dropoffs: 0, dropoffRate: 0 },
  ],
  sessions: [
    {
      sessionId: 'session-1',
      userId: 'user-1',
      firstName: 'Gary',
      lastName: 'Smith',
      email: 'gary@arc5ventures.com',
      phoneNumber: '+1234567890',
      viewDuration: 78,
      lastStepReached: 3,
      totalSteps: 4,
      completionRate: 75,
      lastViewed: new Date(Date.now() - 12 * 3600000).toISOString(),
      converted: false,
      currentStage: 'Checkout & Payment'
    },
    {
      sessionId: 'session-2',
      userId: 'user-2',
      firstName: 'Jonathan',
      lastName: 'Lane',
      email: 'jonathan.lane@elementshealth.com',
      phoneNumber: '+1987654321',
      viewDuration: 131,
      lastStepReached: 4,
      totalSteps: 4,
      completionRate: 100,
      lastViewed: new Date(Date.now() - 2 * 86400000).toISOString(),
      converted: true,
      currentStage: 'Completed'
    },
    {
      sessionId: 'session-3',
      userId: 'anonymous',
      firstName: 'Anonymous',
      lastName: 'User',
      email: '192.168.1.45 • San Francisco, CA',
      phoneNumber: undefined,
      viewDuration: 23,
      lastStepReached: 1,
      totalSteps: 4,
      completionRate: 25,
      lastViewed: new Date(Date.now() - 3600000).toISOString(),
      converted: false,
      currentStage: 'Product Selection'
    },
    {
      sessionId: 'session-4',
      userId: 'user-3',
      firstName: 'Ben',
      lastName: 'Wilson',
      email: 'ben@10vc.com',
      phoneNumber: undefined,
      viewDuration: 6,
      lastStepReached: 2,
      totalSteps: 4,
      completionRate: 50,
      lastViewed: new Date(Date.now() - 2 * 86400000).toISOString(),
      converted: false,
      currentStage: 'Medical History Questions'
    },
    {
      sessionId: 'session-5',
      userId: 'user-4',
      firstName: 'Sam',
      lastName: 'Anderson',
      email: 'sam@helena.org',
      phoneNumber: '+1555123456',
      viewDuration: 158,
      lastStepReached: 4,
      totalSteps: 4,
      completionRate: 100,
      lastViewed: new Date(Date.now() - 86400000).toISOString(),
      converted: true,
      currentStage: 'Completed'
    },
    {
      sessionId: 'session-6',
      userId: 'anonymous',
      firstName: 'Anonymous',
      lastName: 'User',
      email: '10.0.1.82 • Austin, TX',
      phoneNumber: undefined,
      viewDuration: 45,
      lastStepReached: 1,
      totalSteps: 4,
      completionRate: 25,
      lastViewed: new Date(Date.now() - 7200000).toISOString(),
      converted: false,
      currentStage: 'Product Selection'
    },
    {
      sessionId: 'session-7',
      userId: 'user-5',
      firstName: 'Maria',
      lastName: 'Rodriguez',
      email: 'maria.r@email.com',
      phoneNumber: '+1222333444',
      viewDuration: 92,
      lastStepReached: 3,
      totalSteps: 4,
      completionRate: 75,
      lastViewed: new Date(Date.now() - 4 * 3600000).toISOString(),
      converted: false,
      currentStage: 'Checkout & Payment'
    },
    {
      sessionId: 'session-8',
      userId: 'anonymous',
      firstName: 'Anonymous',
      lastName: 'User',
      email: '172.16.0.23 • New York, NY',
      phoneNumber: undefined,
      viewDuration: 12,
      lastStepReached: 1,
      totalSteps: 4,
      completionRate: 25,
      lastViewed: new Date(Date.now() - 30 * 60000).toISOString(),
      converted: false,
      currentStage: 'Product Selection'
    },
    {
      sessionId: 'session-9',
      userId: 'user-6',
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@company.com',
      phoneNumber: '+1444555666',
      viewDuration: 186,
      lastStepReached: 4,
      totalSteps: 4,
      completionRate: 100,
      lastViewed: new Date(Date.now() - 6 * 3600000).toISOString(),
      converted: true,
      currentStage: 'Completed'
    },
    {
      sessionId: 'session-10',
      userId: 'anonymous',
      firstName: 'Anonymous',
      lastName: 'User',
      email: '203.0.113.55 • Miami, FL',
      phoneNumber: undefined,
      viewDuration: 8,
      lastStepReached: 1,
      totalSteps: 4,
      completionRate: 25,
      lastViewed: new Date(Date.now() - 15 * 60000).toISOString(),
      converted: false,
      currentStage: 'Product Selection'
    }
  ],
  dailyStats: [
    { date: 'Jan 31', started: 2, completed: 1 },
    { date: 'Feb 1', started: 5, completed: 3 },
    { date: 'Feb 2', started: 8, completed: 6 },
    { date: 'Feb 3', started: 12, completed: 9 },
    { date: 'Feb 4', started: 9, completed: 7 },
  ]
})

export function FormAnalytics() {
  const { user, authenticatedFetch } = useAuth()
  const [data, setData] = useState<FormAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<string | null>(null)
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user?.clinicId) {
      fetchForms()
    } else {
      setLoading(false)
    }
  }, [user?.clinicId])

  useEffect(() => {
    if (selectedForm) {
      fetchFormAnalytics(selectedForm)
    }
  }, [selectedForm])

  const fetchForms = async () => {
    try {
      console.log('📊 Fetching forms list...')
      
      const response = await authenticatedFetch(
        `${API_URL}/analytics/forms`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('📊 Forms response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('📊 Forms result:', result)
        
        if (result.success && result.data && result.data.length > 0) {
          setForms(result.data)
          setSelectedForm(result.data[0].id)
        } else {
          console.log('📊 No forms found, showing demo data')
          setLoading(false)
          setData(getMockData())
        }
      } else {
        console.error('📊 API error:', response.status)
        setLoading(false)
        setData(getMockData())
      }
    } catch (err) {
      console.error('📊 Error fetching forms:', err)
      setLoading(false)
      setData(getMockData())
    }
  }

  const fetchFormAnalytics = async (formId: string) => {
    if (!user?.clinicId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('📊 Fetching analytics for form:', formId)

      const response = await authenticatedFetch(
        `${API_URL}/analytics/forms/${formId}/sessions`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('📊 Analytics response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('📊 Analytics result:', result)
        
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.message || 'Failed to load analytics')
        }
      } else {
        const errorText = await response.text()
        console.error('📊 Analytics error response:', errorText)
        setError(`Failed to load analytics: ${response.status}`)
      }
    } catch (err) {
      console.error('Error fetching form analytics:', err)
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getCompletionColor = (completion: number) => {
    if (completion >= 90) return 'text-green-600 border-green-500'
    if (completion >= 70) return 'text-blue-600 border-blue-500'
    if (completion >= 40) return 'text-orange-600 border-orange-500'
    return 'text-red-600 border-red-500'
  }

  const toggleRow = (sessionId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedRows(newExpanded)
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Please log in
        </h3>
        <p className="text-muted-foreground">
          Log in to view form analytics
        </p>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          No analytics data yet
        </h3>
        <p className="text-muted-foreground">
          Start receiving form visits to see analytics here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Form Selector */}
      {forms.length > 1 && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Select Form:</label>
          <select
            value={selectedForm || ''}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Form Progression Chart - TOP PRIORITY */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-8 shadow-apple">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Form Progression</h2>
          <p className="text-sm text-muted-foreground/60">
            Number of users at each stage
          </p>
        </div>
        
        {/* Bar Chart Container - Fixed height with proper spacing */}
        <div className="relative pt-6" style={{ height: '360px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-6 bottom-20 flex flex-col justify-between text-xs text-muted-foreground/60 pr-3">
            {(() => {
              const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
              // Add 20% padding to the top so highest bar has breathing room
              const chartMax = Math.ceil(maxValue * 1.2)
              const steps = 4
              const stepValue = Math.ceil(chartMax / steps)
              return Array.from({ length: steps + 1 }, (_, i) => (
                <div key={i} className="text-right">
                  {stepValue * (steps - i)}
                </div>
              ))
            })()}
          </div>

          {/* Chart Area */}
          <div className="absolute left-12 right-0 top-6 bottom-0">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-20">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-t border-gray-200/40" />
              ))}
            </div>

            {/* Bars - Side by Side */}
            <div className="absolute inset-0 flex items-end justify-between gap-6 pb-20">
              {(() => {
                const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
                const chartMax = maxValue * 1.2
                const chartHeight = 240 // Available height for bars
                
                return data.stageMetrics.map((stage, index) => {
                  const reachedHeightPercentage = (stage.reached / chartMax) * 100
                  const completedHeightPercentage = (stage.completed / chartMax) * 100
                  const reachedHeight = (reachedHeightPercentage / 100) * chartHeight
                  const completedHeight = (completedHeightPercentage / 100) * chartHeight
                  const isLastStep = index === data.stageMetrics.length - 1
                  
                  return (
                    <div key={stage.stepNumber} className="flex-1 flex flex-col items-center justify-end group relative" style={{ height: chartHeight }}>
                      {/* Hover tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                        <div className="font-semibold mb-1">{stage.questionText}</div>
                        <div className="text-gray-300">{stage.reached} started</div>
                        <div className="text-gray-300">{stage.completed} completed</div>
                        <div className="text-gray-300">{stage.dropoffs} dropped off ({stage.dropoffRate}%)</div>
                      </div>

                      {/* Side-by-side bars */}
                      <div className="w-full flex items-end justify-center gap-2">
                        {/* Started Bar (Light purple) */}
                        <div className="flex-1 max-w-[45px] flex flex-col items-center justify-end">
                          <div className="text-sm font-bold text-foreground mb-1">{stage.reached}</div>
                          <div 
                            className="w-full rounded-t transition-all duration-700 ease-out hover:opacity-80"
                            style={{ 
                              height: `${reachedHeight}px`,
                              background: 'linear-gradient(180deg, hsl(270, 60%, 75%) 0%, hsl(280, 60%, 70%) 100%)',
                              minHeight: stage.reached > 0 ? '12px' : '0'
                            }}
                          />
                        </div>

                        {/* Completed Bar (Dark purple/green) */}
                        <div className="flex-1 max-w-[45px] flex flex-col items-center justify-end">
                          <div className="text-sm font-bold text-foreground mb-1">{stage.completed}</div>
                          <div 
                            className="w-full rounded-t transition-all duration-700 ease-out hover:opacity-90"
                            style={{ 
                              height: `${completedHeight}px`,
                              background: index === data.stageMetrics.length - 1 
                                ? 'linear-gradient(180deg, hsl(145, 65%, 50%) 0%, hsl(145, 65%, 45%) 100%)'
                                : 'linear-gradient(180deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 60%) 100%)',
                              minHeight: stage.completed > 0 ? '12px' : '0'
                            }}
                          />
                        </div>
                      </div>

                      {/* Stage label below */}
                      <div className="mt-4 text-center w-full px-1">
                        <div className="text-xs font-medium text-foreground mb-1 line-clamp-2">
                          {stage.questionText}
                        </div>
                        <div className="text-xs text-muted-foreground/50 mb-1">
                          Step {stage.stepNumber}
                        </div>
                        {stage.dropoffs > 0 && (
                          <div className="text-xs font-bold text-red-600">
                            {stage.dropoffRate}% drop-off
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-200/60">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: 'linear-gradient(135deg, hsl(270, 60%, 75%) 0%, hsl(280, 60%, 70%) 100%)' }}></div>
            <span className="text-xs text-muted-foreground/70">Started</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: 'linear-gradient(135deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 60%) 100%)' }}></div>
            <span className="text-xs text-muted-foreground/70">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: 'linear-gradient(135deg, hsl(145, 65%, 50%) 0%, hsl(145, 65%, 45%) 100%)' }}></div>
            <span className="text-xs text-muted-foreground/70">Form Completed</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics (MOVED BELOW CHART) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-apple">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground/60 font-medium">Total Sessions</p>
          </div>
          <p className="text-4xl font-bold text-foreground mb-1">{data.totalSessions}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-apple">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground/60 font-medium">Completion Rate</p>
          </div>
          <p className="text-4xl font-bold text-foreground mb-1">{data.completionRate}%</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-apple">
          <div className="mb-3">
            <p className="text-xs text-muted-foreground/60 font-medium">Avg Duration</p>
          </div>
          <p className="text-4xl font-bold text-foreground mb-1">{formatDuration(data.averageDuration)}</p>
          <p className="text-xs text-muted-foreground/60">mins</p>
        </div>
      </div>

      {/* All Visitors Table */}
      <div className="bg-white rounded-xl border border-gray-200/60 shadow-apple overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200/60">
          <h2 className="text-lg font-semibold text-foreground">All Visitors</h2>
        </div>
        <div>
          {data.sessions.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No sessions recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200/60 bg-gray-50/30">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">Name</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">Duration</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">Current Stage</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">Progress</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">Last Viewed</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.slice(0, 10).map((session) => {
                    const isAnonymous = session.userId === 'anonymous' || session.firstName === 'Anonymous'
                    
                    return (
                    <>
                      <tr 
                        key={session.sessionId}
                        className="border-b border-gray-100 hover:bg-gray-50/50 transition-smooth cursor-pointer group"
                        onClick={() => toggleRow(session.sessionId)}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {isAnonymous ? (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-300">
                                <Users className="h-4 w-4 text-gray-600" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-gray-400">
                                {session.firstName[0]}{session.lastName[0]}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                {session.firstName} {session.lastName}
                                {isAnonymous && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-gray-300">
                                    Anonymous
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground/70">{session.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-foreground font-medium">{formatDuration(session.viewDuration)} mins</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-muted-foreground/80">{session.currentStage}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getCompletionColor(session.completionRate)}`}>
                              {session.completionRate}
                            </div>
                            <span className="text-sm text-muted-foreground/70">{session.lastStepReached}/{session.totalSteps}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-muted-foreground">{formatDate(session.lastViewed)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-smooth ${expandedRows.has(session.sessionId) ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {expandedRows.has(session.sessionId) && (
                        <tr className="border-b border-gray-100 bg-gray-50/30">
                          <td colSpan={6} className="py-4 px-6">
                            <div className="ml-12 space-y-3">
                              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                                {session.phoneNumber && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <span className="text-muted-foreground/70">Phone:</span>
                                    <span className="text-foreground font-medium">{session.phoneNumber}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/60" />
                                  <span className="text-muted-foreground/70">Session ID:</span>
                                  <span className="font-mono text-xs text-foreground">{session.sessionId.substring(0, 12)}...</span>
                                </div>
                                {session.converted ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-0.5">
                                    ✓ Completed Form
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-2 py-0.5">
                                    Incomplete
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
