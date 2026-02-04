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
}

export function FormAnalytics({ formId }: FormAnalyticsDetailProps) {
  const { user, authenticatedFetch } = useAuth()
  const [data, setData] = useState<FormAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (formId && user?.clinicId) {
      fetchFormAnalytics()
    }
  }, [formId, user?.clinicId])

  const fetchFormAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await authenticatedFetch(
        `${API_URL}/analytics/forms/${formId}/sessions`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.message || 'Failed to load analytics')
        }
      } else {
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
      <div className="bg-white rounded-xl border border-gray-200/60 p-8 shadow-apple">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Form Progression</h2>
          <p className="text-sm text-muted-foreground/60">
            Number of users at each stage
          </p>
        </div>
        
        {/* Bar Chart */}
        <div className="relative pt-6" style={{ height: '360px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-6 bottom-20 flex flex-col justify-between text-xs text-muted-foreground/60 pr-3">
            {(() => {
              const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
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
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-20">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-t border-gray-200/40" />
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-6 pb-20">
              {(() => {
                const maxValue = Math.max(...data.stageMetrics.map(s => s.reached))
                const chartMax = maxValue * 1.2
                const chartHeight = 240
                
                return data.stageMetrics.map((stage, index) => {
                  const reachedHeight = (stage.reached / chartMax) * chartHeight
                  const completedHeight = (stage.completed / chartMax) * chartHeight
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
                        {/* Started Bar */}
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

                        {/* Completed Bar */}
                        <div className="flex-1 max-w-[45px] flex flex-col items-center justify-end">
                          <div className="text-sm font-bold text-foreground mb-1">{stage.completed}</div>
                          <div 
                            className="w-full rounded-t transition-all duration-700 ease-out hover:opacity-90"
                            style={{ 
                              height: `${completedHeight}px`,
                              background: isLastStep 
                                ? 'linear-gradient(180deg, hsl(145, 65%, 50%) 0%, hsl(145, 65%, 45%) 100%)'
                                : 'linear-gradient(180deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 60%) 100%)',
                              minHeight: stage.completed > 0 ? '12px' : '0'
                            }}
                          />
                        </div>
                      </div>

                      {/* Stage label */}
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
