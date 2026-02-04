import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import {
  Search,
  Loader2,
  Shield,
  AlertTriangle,
  Eye,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Activity,
  Users,
} from "lucide-react"
import { toast } from "sonner"

interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  resourceType: string
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, any> | null
  clinicId: string | null
  success: boolean
  errorMessage: string | null
  createdAt: string
  isSuperAdmin?: boolean
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AuditStats {
  totalLogs: number
  last30DaysLogs: number
  failedLogins: number
  phiAccesses: number
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  LOGOUT: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  LOGIN_FAILED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  VIEW: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  CREATE: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  UPDATE: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  DELETE: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  EXPORT: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  EMAIL_SENT: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  SMS_SENT: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  PASSWORD_CHANGE: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  PASSWORD_RESET: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  MFA_CODE_SENT: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  MFA_VERIFIED: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  MFA_FAILED: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  ROLE_CHANGE: 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
}

const RESOURCE_ICONS: Record<string, string> = {
  User: '👤',
  Patient: '🏥',
  Order: '📦',
  Prescription: '💊',
  Treatment: '🩺',
  Message: '💬',
  QuestionnaireResponse: '📋',
  QuestionnaireTemplate: '📝',
  Payment: '💳',
  Subscription: '📅',
  Session: '🔐',
  Clinic: '🏢',
  Product: '🏷️',
  Document: '📄',
}

export default function AuditLogs() {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [resourceTypes, setResourceTypes] = useState<string[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAction, setSelectedAction] = useState<string>("")
  const [selectedResourceType, setSelectedResourceType] = useState<string>("")
  const [selectedSuccess, setSelectedSuccess] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [showFilters, setShowFilters] = useState(false)

  // Selected log for details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async (page = 1) => {
    if (!token) return
    setLoading(true)

    try {
      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("limit", String(pagination.limit))

      if (searchTerm) params.append("search", searchTerm)
      if (selectedAction) params.append("action", selectedAction)
      if (selectedResourceType) params.append("resourceType", selectedResourceType)
      if (selectedSuccess) params.append("success", selectedSuccess)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const response = await fetch(`${baseUrl}/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs")
      }

      const result = await response.json()
      setLogs(result.data.logs)
      setPagination(result.data.pagination)
    } catch (error: any) {
      console.error("Error fetching audit logs:", error)
      toast.error(error.message || "Failed to fetch audit logs")
    } finally {
      setLoading(false)
    }
  }, [token, baseUrl, pagination.limit, searchTerm, selectedAction, selectedResourceType, selectedSuccess, startDate, endDate])

  const fetchStats = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/admin/audit-logs/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const result = await response.json()
        setStats(result.data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }, [token, baseUrl])

  const fetchActionsAndTypes = useCallback(async () => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/admin/audit-logs/actions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const result = await response.json()
        setActions(result.data.actions)
        setResourceTypes(result.data.resourceTypes)
      }
    } catch (error) {
      console.error("Error fetching actions:", error)
    }
  }, [token, baseUrl])

  useEffect(() => {
    fetchLogs()
    fetchStats()
    fetchActionsAndTypes()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLogs(1)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedAction, selectedResourceType, selectedSuccess, startDate, endDate])

  const handleExport = async () => {
    if (!token) return

    try {
      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (selectedAction) params.append("action", selectedAction)
      if (selectedResourceType) params.append("resourceType", selectedResourceType)

      const response = await fetch(`${baseUrl}/admin/audit-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error("Failed to export audit logs")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Audit logs exported successfully")
    } catch (error: any) {
      console.error("Error exporting:", error)
      toast.error(error.message || "Failed to export audit logs")
    }
  }

  const resetFilters = () => {
    setSearchTerm("")
    setSelectedAction("")
    setSelectedResourceType("")
    setSelectedSuccess("")
    setStartDate("")
    setEndDate("")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-3">
                <Shield className="h-8 w-8 text-[#4FA59C]" />
                Audit Logs
              </h1>
              <p className="text-muted-foreground text-base">
                HIPAA-compliant audit trail for PHI access and system events
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  fetchLogs(pagination.page)
                  fetchStats()
                }}
                variant="outline"
                className="rounded-full px-6 border-border text-foreground hover:bg-muted transition-all"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={handleExport}
                className="rounded-full px-6 bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Events</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.totalLogs.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                      <Activity className="h-6 w-6 text-[#4FA59C]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Last 30 Days</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.last30DaysLogs.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                      <Calendar className="h-6 w-6 text-[#3B82F6]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">PHI Accesses</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.phiAccesses.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                      <Eye className="h-6 w-6 text-[#8B5CF6]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Failed Logins</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.failedLogins.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
                      <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search and Filters */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email, resource ID, or IP address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-11 rounded-xl border-input"
                    />
                  </div>
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="outline"
                    className={`rounded-xl border-border ${showFilters ? 'bg-[#4FA59C] text-white border-[#4FA59C]' : ''}`}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                  {(selectedAction || selectedResourceType || selectedSuccess || startDate || endDate) && (
                    <Button
                      onClick={resetFilters}
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Action</label>
                      <select
                        value={selectedAction}
                        onChange={(e) => setSelectedAction(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C]"
                      >
                        <option value="">All Actions</option>
                        {actions.map((action) => (
                          <option key={action} value={action}>
                            {action.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Resource Type</label>
                      <select
                        value={selectedResourceType}
                        onChange={(e) => setSelectedResourceType(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C]"
                      >
                        <option value="">All Types</option>
                        {resourceTypes.map((type) => (
                          <option key={type} value={type}>
                            {RESOURCE_ICONS[type] || '📄'} {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Status</label>
                      <select
                        value={selectedSuccess}
                        onChange={(e) => setSelectedSuccess(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C]"
                      >
                        <option value="">All</option>
                        <option value="true">Success</option>
                        <option value="false">Failed</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Start Date</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">End Date</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-xl border-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-foreground">Event Log</CardTitle>
                  <CardDescription>
                    {pagination.total.toLocaleString()} total events
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#4FA59C]" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Shield className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No audit logs found</p>
                  <p className="text-sm mt-2">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-muted/50 border-y border-border">
                      <tr>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          User
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Action
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Resource
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          IP Address
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          className={`transition-colors cursor-pointer ${log.isSuperAdmin
                            ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border-l-4 border-red-600 dark:border-red-500'
                            : 'hover:bg-muted/50'
                            }`}
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="py-3 px-5 whitespace-nowrap">
                            <span className="text-sm text-foreground">
                              {formatDate(log.createdAt)}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">
                                {log.user
                                  ? `${log.user.firstName} ${log.user.lastName}`
                                  : log.userEmail || 'Unknown'}
                              </span>
                              {log.userEmail && (
                                <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ACTION_COLORS[log.action] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                                }`}
                            >
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              <span className="text-base">
                                {RESOURCE_ICONS[log.resourceType] || '📄'}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm text-foreground">{log.resourceType}</span>
                                {log.resourceId && (
                                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                                    {log.resourceId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span className="text-sm text-muted-foreground font-mono">
                              {log.ipAddress || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            {log.success ? (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 text-sm">
                                <XCircle className="h-4 w-4" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5">
                            {log.details && Object.keys(log.details).length > 0 ? (
                              <div className="flex items-center gap-2">
                                {log.details.templateName && (
                                  <span className="text-sm text-foreground max-w-[200px] truncate" title={log.details.templateName}>
                                    {log.details.templateName}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#4FA59C] hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedLog(log)
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total.toLocaleString()} results
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLogs(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                      className="rounded-lg"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLogs(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${selectedLog.isSuperAdmin
              ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600'
              : 'bg-card border border-border'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div className={`flex items-center justify-between pb-4 border-b ${selectedLog.isSuperAdmin ? 'border-red-300 dark:border-red-700' : 'border-border'
                }`}>
                <h2 className={`text-xl font-semibold ${selectedLog.isSuperAdmin ? 'text-red-800 dark:text-red-300' : 'text-foreground'
                  }`}>Audit Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-full px-4 py-2 border border-input text-muted-foreground hover:bg-muted transition-all text-sm font-medium"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Timestamp</p>
                  <p className="text-sm text-foreground">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Status</p>
                  <p className="text-sm">
                    {selectedLog.success ? (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                        <XCircle className="h-4 w-4" /> Failed
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">User</p>
                  <p className="text-sm text-foreground">
                    {selectedLog.user
                      ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}`
                      : 'Unknown'}
                  </p>
                  {selectedLog.userEmail && (
                    <p className="text-xs text-muted-foreground">{selectedLog.userEmail}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Action</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ACTION_COLORS[selectedLog.action] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                      }`}
                  >
                    {selectedLog.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Resource Type</p>
                  <p className="text-sm text-foreground">
                    {RESOURCE_ICONS[selectedLog.resourceType] || '📄'} {selectedLog.resourceType}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Resource ID</p>
                  <p className="text-sm text-foreground font-mono break-all">
                    {selectedLog.resourceId || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">IP Address</p>
                  <p className="text-sm text-foreground font-mono">
                    {selectedLog.ipAddress || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Clinic ID</p>
                  <p className="text-sm text-foreground font-mono break-all">
                    {selectedLog.clinicId || '—'}
                  </p>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">User Agent</p>
                  <p className="text-xs text-foreground bg-muted/50 p-3 rounded-lg font-mono break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Error Message</p>
                  <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                    {selectedLog.errorMessage}
                  </p>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Additional Details</p>
                  <pre className="text-xs text-foreground bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

