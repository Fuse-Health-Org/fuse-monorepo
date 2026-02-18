import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from '@/contexts/AuthContext'
import { 
  Eye, 
  Clock, 
  Users, 
  TrendingUp, 
  Phone, 
  BarChart3,
  ChevronDown,
} from "lucide-react"

interface StageMetrics {
  stepNumber: number
  questionText: string
  reached: number
  completed: number
  dropoffs: number
  dropoffRate: number
}

interface FormSession {
  sessionId: string
  userId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  viewDuration: number
  lastStepReached: number
  totalSteps: number
  completionRate: number
  lastViewed: string
  converted: boolean
  currentStage: string
}

interface FormAnalyticsData {
  formId: string
  formName: string
  totalSessions: number
  completionRate: number
  averageDuration: number
  stageMetrics: StageMetrics[]
  sessions: FormSession[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface FormAnalyticsDetailProps {
  formId: string
  templateTitle?: string
  formStepLabels?: string[]
}

export function FormAnalytics({ formId, templateTitle, formStepLabels }: FormAnalyticsDetailProps) {
  const { user, authenticatedFetch } = useAuth()
  const [data, setData] = useState<FormAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (formId && user?.clinicId) {
      fetchFormAnalytics()
    }
  }, [formId, user?.clinicId, formStepLabels])

  const fetchFormAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // ============= TEMPORARY MOCK DATA =============
      // TODO: Replace with real API call when backend is ready
      // const response = await authenticatedFetch(`${API_URL}/analytics/forms/${formId}/sessions`)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))

      // Build stage metrics from the live program step order.
      const stepLabels = formStepLabels && formStepLabels.length > 0
        ? formStepLabels
        : ['Product Selection', 'Medical Questions', 'Create Account', 'Payment & Checkout']

      const totalSessions = 248
      let reachedCount = totalSessions

      const stageMetrics: StageMetrics[] = stepLabels.map((label, idx) => {
        const isLastStep = idx === stepLabels.length - 1
        const completionFactor = isLastStep
          ? 0.255
          : Math.max(0.58, 0.95 - (idx * 0.12))
        const completed = Math.max(1, Math.round(reachedCount * completionFactor))
        const dropoffs = reachedCount - completed
        const stage: StageMetrics = {
          stepNumber: idx + 1,
          questionText: label,
          reached: reachedCount,
          completed,
          dropoffs,
          dropoffRate: reachedCount > 0 ? Number(((dropoffs / reachedCount) * 100).toFixed(1)) : 0,
        }
        reachedCount = completed
        return stage
      })

      const finalCompleted = stageMetrics[stageMetrics.length - 1]?.completed || 0

      const sessionBlueprints = [
        { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@email.com', phoneNumber: '(555) 123-4567', viewDuration: 456, completionRatio: 1, converted: true, hoursAgo: 2 },
        { firstName: 'Michael', lastName: 'Chen', email: 'mchen@email.com', phoneNumber: '(555) 234-5678', viewDuration: 623, completionRatio: 1, converted: true, hoursAgo: 5 },
        { firstName: 'Emily', lastName: 'Rodriguez', email: 'emily.r@email.com', phoneNumber: '(555) 345-6789', viewDuration: 234, completionRatio: 0.75, converted: false, hoursAgo: 8 },
        { firstName: 'David', lastName: 'Thompson', email: 'dthompson@email.com', phoneNumber: '(555) 456-7890', viewDuration: 189, completionRatio: 0.25, converted: false, hoursAgo: 12 },
        { firstName: 'Jessica', lastName: 'Martinez', email: 'jmartinez@email.com', phoneNumber: '(555) 567-8901', viewDuration: 512, completionRatio: 1, converted: true, hoursAgo: 24 },
        { firstName: 'Robert', lastName: 'Wilson', email: 'rwilson@email.com', viewDuration: 156, completionRatio: 0.5, converted: false, hoursAgo: 36 },
        { firstName: 'Amanda', lastName: 'Taylor', email: 'ataylor@email.com', phoneNumber: '(555) 678-9012', viewDuration: 445, completionRatio: 1, converted: true, hoursAgo: 48 },
        { firstName: 'Christopher', lastName: 'Anderson', email: 'canderson@email.com', viewDuration: 98, completionRatio: 0.25, converted: false, hoursAgo: 72 },
      ]

      const sessions: FormSession[] = sessionBlueprints.map((session, idx) => {
        const totalSteps = stepLabels.length
        const calculatedStep = Math.ceil(totalSteps * session.completionRatio)
        const lastStepReached = session.converted
          ? totalSteps
          : Math.max(1, Math.min(totalSteps, calculatedStep))

        return {
          sessionId: `sess_00${idx + 1}`,
          userId: `user_00${idx + 1}`,
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          phoneNumber: session.phoneNumber,
          viewDuration: session.viewDuration,
          lastStepReached,
          totalSteps,
          completionRate: Number(((lastStepReached / totalSteps) * 100).toFixed(1)),
          lastViewed: new Date(Date.now() - session.hoursAgo * 60 * 60 * 1000).toISOString(),
          converted: session.converted,
          currentStage: stepLabels[lastStepReached - 1] || stepLabels[0],
        }
      })

      const mockData = {
        formId: formId,
        formName: templateTitle || 'Medical Intake Form',
        totalSessions,
        completionRate: Number(((finalCompleted / totalSessions) * 100).toFixed(1)),
        averageDuration: 385 + Math.max(0, stepLabels.length - 3) * 40, // seconds
        stageMetrics,
        sessions,
      }
      
      setData(mockData)
      // ============= END MOCK DATA =============
      
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

  if (loading) {
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
      {/* Form Progression Chart - TOP */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-apple">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Form Progression</h2>
          <p className="text-sm text-muted-foreground/60">
            Number of users at each stage
          </p>
        </div>
        
        {/* Bar Chart */}
        <div className="relative pt-4" style={{ height: '340px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-4 flex flex-col justify-between text-xs text-muted-foreground/60 pr-3" style={{ bottom: '80px' }}>
            {(() => {
              const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
              const targetMax = maxValue * 1.2
              
              // Smart rounding to nearest 10, 50, or 100
              let chartMax: number
              if (targetMax <= 50) {
                chartMax = Math.ceil(targetMax / 10) * 10
              } else if (targetMax <= 200) {
                chartMax = Math.ceil(targetMax / 25) * 25
              } else if (targetMax <= 500) {
                chartMax = Math.ceil(targetMax / 50) * 50
              } else if (targetMax <= 1000) {
                chartMax = Math.ceil(targetMax / 100) * 100
              } else {
                chartMax = Math.ceil(targetMax / 250) * 250
              }
              
              const steps = 4
              const stepValue = chartMax / steps
              return Array.from({ length: steps + 1 }, (_, i) => (
                <div key={i} className="text-right">
                  {Math.round(stepValue * (steps - i))}
                </div>
              ))
            })()}
          </div>

          {/* Chart Area */}
          <div className="absolute left-12 right-0 top-4 bottom-0">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between" style={{ paddingBottom: '80px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`border-t ${i === 4 ? 'border-gray-400' : 'border-gray-200/40'}`} />
              ))}
            </div>

            {/* Bars Container */}
            <div className="absolute left-0 right-0 flex justify-between gap-6" style={{ top: '16px', bottom: '80px' }}>
              {(() => {
                const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
                const targetMax = maxValue * 1.2
                
                // Smart rounding to nearest 10, 50, or 100 (same as Y-axis)
                let chartMax: number
                if (targetMax <= 50) {
                  chartMax = Math.ceil(targetMax / 10) * 10
                } else if (targetMax <= 200) {
                  chartMax = Math.ceil(targetMax / 25) * 25
                } else if (targetMax <= 500) {
                  chartMax = Math.ceil(targetMax / 50) * 50
                } else if (targetMax <= 1000) {
                  chartMax = Math.ceil(targetMax / 100) * 100
                } else {
                  chartMax = Math.ceil(targetMax / 250) * 250
                }
                
                // Chart height matches the grid area: 340px total - 16px top - 80px bottom = 244px
                const chartHeight = 244
                
                return data.stageMetrics.map((stage, index) => {
                  const reachedHeight = (stage.reached / chartMax) * chartHeight
                  const completedHeight = (stage.completed / chartMax) * chartHeight
                  const isLastStep = index === data.stageMetrics.length - 1
                  
                  return (
                    <div key={stage.stepNumber} className="flex-1 group relative" style={{ height: '100%' }}>
                      {/* Hover tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                        <div className="font-semibold mb-1">{stage.questionText}</div>
                        <div className="text-gray-300">{stage.reached} started</div>
                        <div className="text-green-300">{stage.completed} completed ({((stage.completed / stage.reached) * 100).toFixed(1)}%)</div>
                        <div className="text-red-300">{stage.dropoffs} dropped off ({stage.dropoffRate.toFixed(1)}%)</div>
                      </div>

                      {/* Bars - positioned at bottom, growing upward */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-2">
                        {/* Started Bar */}
                        <div className="flex-1 max-w-[45px] relative flex flex-col items-center">
                          <div className="absolute -top-6 text-sm font-bold text-foreground whitespace-nowrap">{stage.reached}</div>
                          <div 
                            className="w-full rounded-t transition-all duration-700 ease-out hover:opacity-80"
                            style={{ 
                              height: `${Math.max(reachedHeight, stage.reached > 0 ? 8 : 0)}px`,
                              background: 'linear-gradient(180deg, hsl(270, 60%, 75%) 0%, hsl(280, 60%, 70%) 100%)'
                            }}
                          />
                        </div>

                        {/* Completed Bar */}
                        <div className="flex-1 max-w-[45px] relative flex flex-col items-center">
                          <div className="absolute -top-6 text-sm font-bold text-foreground whitespace-nowrap">{stage.completed}</div>
                          <div 
                            className="w-full rounded-t transition-all duration-700 ease-out hover:opacity-90"
                            style={{ 
                              height: `${Math.max(completedHeight, stage.completed > 0 ? 8 : 0)}px`,
                              background: isLastStep 
                                ? 'linear-gradient(180deg, hsl(145, 65%, 50%) 0%, hsl(145, 65%, 45%) 100%)'
                                : 'linear-gradient(180deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 60%) 100%)'
                            }}
                          />
                        </div>
                      </div>

                      {/* Stage label - BELOW the zero line (positioned below the container) */}
                      <div className="absolute left-0 right-0 text-center px-1" style={{ top: '100%', paddingTop: '6px' }}>
                        <div className="text-xs font-medium text-foreground mb-0.5 line-clamp-2">
                          {stage.questionText}
                        </div>
                        {/* Progression Rate (Green) - Now above step number */}
                        {(() => {
                          const progressionRate = stage.reached > 0 
                            ? ((stage.completed / stage.reached) * 100).toFixed(1)
                            : '0.0'
                          return (
                            <div className="text-xs font-bold text-green-600 mb-0.5">
                              {progressionRate}% completed
                            </div>
                          )
                        })()}
                        <div className="text-xs text-muted-foreground/50">
                          Step {stage.stepNumber}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2 pt-2 border-t border-gray-200/60">
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

      {/* Summary Metrics */}
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
