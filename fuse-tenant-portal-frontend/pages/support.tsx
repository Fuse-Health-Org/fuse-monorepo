import { useState, useEffect, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { io, Socket } from "socket.io-client"
import {
  MessageSquare,
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Tag,
  Loader2,
  Send,
  ArrowRight,
  Check,
  ChevronDown,
  User,
  Mail,
  Hash,
  MapPin,
  Building2,
  Globe,
  Copy,
} from "lucide-react"

interface Ticket {
  id: string
  title: string
  description: string
  status: "new" | "in_progress" | "resolved" | "closed"
  category: "technical" | "billing" | "general" | "feature_request"
  createdAt: string
  updatedAt: string
  author: {
    id: string
    firstName: string
    lastName: string
    email: string
    city?: string
    state?: string
    address?: string
    role?: string
    clinic?: {
      id: string
      name: string
    }
  }
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  assignedTeam?: string
  lastUpdatedBy?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  messageCount: number
  tags?: string[]
  messages?: TicketMessage[]
}

interface TicketMessage {
  role: "user" | "support" | "system"
  message: string
  createdAt: string
}


const statusConfig = {
  new: {
    label: "New",
    color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: AlertCircle
  },
  in_progress: {
    label: "In Progress",
    color: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    icon: Clock
  },
  resolved: {
    label: "Resolved",
    color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    icon: CheckCircle2
  },
  closed: {
    label: "Closed",
    color: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    icon: XCircle
  }
}

const categoryConfig = {
  technical: { label: "Technical", icon: "🔧" },
  billing: { label: "Billing", icon: "💳" },
  general: { label: "General", icon: "💬" },
  feature_request: { label: "Feature Request", icon: "✨" }
}

export default function Support() {
  const { token, user } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  const socketRef = useRef<Socket | null>(null)

  // Load filter assignment from localStorage
  const getStoredFilterAssignment = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('support_filter_assignment') || 'all'
    }
    return 'all'
  }

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterAssignment, setFilterAssignment] = useState<string>(getStoredFilterAssignment())
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<Array<{id: string, firstName: string, lastName: string, email: string, role: string}>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedTicketRef = useRef<Ticket | null>(null)
  const assignDropdownRef = useRef<HTMLDivElement>(null)
  
  // Keep ref updated with current selected ticket
  useEffect(() => {
    selectedTicketRef.current = selectedTicket
  }, [selectedTicket])

  // Close assign dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setAssignDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Save filter assignment to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('support_filter_assignment', filterAssignment)
    }
  }, [filterAssignment])

  // Fetch tickets
  const fetchTickets = async () => {
    if (!token) return
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (filterStatus !== "all") params.append("status", filterStatus)
      if (searchQuery) params.append("search", searchQuery)
      
      // Add assignment filter
      if (filterAssignment === "mine" && user?.id) {
        params.append("assignedToId", user.id)
      } else if (filterAssignment === "unassigned") {
        params.append("assignedToId", "null")
      }

      const response = await fetch(`${baseUrl}/support/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error("Failed to fetch tickets")

      const data = await response.json()
      setTickets(data.data.tickets || [])
    } catch (error: any) {
      console.error("Error fetching tickets:", error)
      // Silently handle errors - don't show toast when there are no tickets
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch ticket details with messages
  const fetchTicketDetails = async (ticketId: string, silent = false) => {
    if (!token) return
    
    // Only show loading state if it's not a silent update (background refresh)
    if (!silent) {
      setLoadingMessages(true)
    }

    try {
      const response = await fetch(`${baseUrl}/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error("Failed to fetch ticket details")

      const data = await response.json()
      setSelectedTicket(data.data)
      
      // Only scroll on initial load, not on silent updates
      if (!silent) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }
    } catch (error: any) {
      console.error("Error fetching ticket details:", error)
      if (!silent) {
        toast.error("Failed to load ticket details")
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false)
      }
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!token || !selectedTicket || !newMessage.trim()) return
    setSending(true)

    const messageContent = newMessage.trim()
    
    // Optimistic update - add message immediately
    const optimisticMessage: TicketMessage = {
      role: "support",
      message: messageContent,
      createdAt: new Date().toISOString(),
    }

    // Update local state immediately
    setSelectedTicket({
      ...selectedTicket,
      messages: [...(selectedTicket.messages || []), optimisticMessage],
      messageCount: selectedTicket.messageCount + 1,
    })
    setNewMessage("")

    // Scroll to bottom immediately
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 50)

    try {
      const response = await fetch(`${baseUrl}/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageContent,
          role: "support",
        }),
      })

      if (!response.ok) throw new Error("Failed to send message")

      const data = await response.json()
      
      // Replace optimistic message with real one from server
      // The server returns the new message, so we replace the last one
      setSelectedTicket(prev => {
        if (!prev) return prev;
        const messages = prev.messages || [];
        const updatedMessages = [...messages];
        // Replace the last message (optimistic) with the real one
        if (updatedMessages.length > 0) {
          updatedMessages[updatedMessages.length - 1] = data.data;
        }
        return {
          ...prev,
          messages: updatedMessages,
        };
      })

      toast.success("Message sent successfully")
      
      // Refresh tickets list in background to update message count
      fetchTickets()
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
      
      // Remove optimistic message on error (remove the last message)
      setSelectedTicket(prev => {
        if (!prev) return prev;
        const messages = prev.messages || [];
        return {
          ...prev,
          messages: messages.slice(0, -1), // Remove last message
          messageCount: Math.max(0, prev.messageCount - 1),
        };
      })
    } finally {
      setSending(false)
    }
  }

  // Get next status in workflow
  const getNextStatus = (currentStatus: string) => {
    const statusFlow: Record<string, { next: string; label: string; icon: any } | null> = {
      new: { next: "in_progress", label: "In Progress", icon: Clock },
      in_progress: { next: "resolved", label: "Resolved", icon: CheckCircle2 },
      resolved: { next: "closed", label: "Closed", icon: XCircle },
      closed: null,
    }
    return statusFlow[currentStatus]
  }

  // Get icon for next status
  const getNextStatusIcon = (currentStatus: string) => {
    const nextStatus = getNextStatus(currentStatus)
    if (!nextStatus) return null
    const IconComponent = nextStatus.icon
    return <IconComponent className="h-5 w-5" />
  }

  // Update ticket status
  const updateTicketStatus = async () => {
    if (!token || !selectedTicket) return
    
    const nextStatusInfo = getNextStatus(selectedTicket.status)
    if (!nextStatusInfo) return

    const previousStatus = selectedTicket.status
    setUpdatingStatus(true)

    // Optimistic update - change status immediately
    setSelectedTicket({
      ...selectedTicket,
      status: nextStatusInfo.next as any,
    })

    try {
      const response = await fetch(`${baseUrl}/support/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatusInfo.next,
        }),
      })

      if (!response.ok) throw new Error("Failed to update ticket status")

      toast.success(`Ticket marked as ${nextStatusInfo.label}`)
      
      // Refresh tickets list in background
      fetchTickets()
    } catch (error: any) {
      console.error("Error updating ticket status:", error)
      toast.error("Failed to update ticket status")
      
      // Revert to previous status on error
      setSelectedTicket(prev => ({
        ...prev!,
        status: previousStatus,
      }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [token, filterStatus, filterAssignment, user?.id])

  // Fetch assignable users
  const fetchAssignableUsers = async () => {
    if (!token) return
    setLoadingUsers(true)

    try {
      const response = await fetch(`${baseUrl}/support/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error("Failed to fetch users")

      const data = await response.json()
      setAssignableUsers(data.data.users || [])
    } catch (error: any) {
      console.error("Error fetching users:", error)
      toast.error("Failed to load users")
    } finally {
      setLoadingUsers(false)
    }
  }

  // Assign ticket to user
  const assignTicket = async (userId: string | null) => {
    if (!token || !selectedTicket) return
    setAssignDropdownOpen(false)

    try {
      const response = await fetch(`${baseUrl}/support/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedToId: userId || null,
        }),
      })

      if (!response.ok) throw new Error("Failed to assign ticket")

      const data = await response.json()
      setSelectedTicket(data.data)
      toast.success(userId ? "Ticket assigned successfully" : "Ticket unassigned")
      
      // Refresh tickets list
      fetchTickets()
    } catch (error: any) {
      console.error("Error assigning ticket:", error)
      toast.error("Failed to assign ticket")
    }
  }

  // Load users when dropdown opens
  useEffect(() => {
    if (assignDropdownOpen && assignableUsers.length === 0) {
      fetchAssignableUsers()
    }
  }, [assignDropdownOpen])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!token) return

    // Initialize socket connection
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    // Listen for new tickets
    socket.on('ticket:created', (data) => {
      toast.success('New support ticket received!', {
        description: data.title
      })
      fetchTickets()
    })

    // Listen for ticket updates
    socket.on('ticket:updated', (data) => {
      toast.info('Ticket updated')
      fetchTickets()
      
      // Update selected ticket status if it's the one being updated
      const currentTicket = selectedTicketRef.current
      if (currentTicket && data.ticketId === currentTicket.id) {
        setSelectedTicket(prev => prev ? { ...prev, status: data.status } : null)
      }
    })

    // Listen for new messages
    socket.on('ticket:message', (data) => {
      fetchTickets()
      
      // Only fetch details if this is not our own message (to avoid double refresh)
      // We already optimistically updated our own messages
      const currentTicket = selectedTicketRef.current
      if (currentTicket && data.ticketId === currentTicket.id) {
        // Silently fetch new messages without loading state
        fetchTicketDetails(currentTicket.id, true)
        
        // Scroll to new message after a brief delay
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 200)
      }
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
    }
  }, [token, baseUrl])

  // Search with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        fetchTickets()
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  // Filter tickets
  const filteredTickets = searchQuery
    ? tickets.filter((ticket) =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tickets
  
  // Sort tickets by priority: resolved -> in_progress -> new -> closed
  const sortedTickets = filterStatus === "all" 
    ? [...filteredTickets].sort((a, b) => {
        const statusOrder: Record<string, number> = {
          'resolved': 0,
          'in_progress': 1,
          'new': 2,
          'closed': 3
        };
        return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
      })
    : filteredTickets

  // Statistics
  const stats = {
    total: tickets.length,
    new: tickets.filter(t => t.status === "new").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  }

  // Copy to clipboard functions
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      console.error("Failed to copy:", error)
      toast.error("Failed to copy to clipboard")
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Less than 1 hour ago"
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 flex overflow-hidden p-4">
          {/* Main Content Card */}
          <div className="flex-1 flex rounded-2xl shadow-sm border border-border bg-card overflow-hidden">
            {/* Left Sidebar: Filters */}
            <div className="w-64 bg-[#1F2937] dark:bg-gray-900 flex flex-col">
              <div className="p-4 border-b border-[#374151]">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-5 w-5 text-white" />
                  <h2 className="text-white font-semibold">Support</h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#374151] border border-[#4B5563] text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3 px-2">Status</h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => setFilterStatus("all")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === "all"
                          ? "bg-[#4FA59C] text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>All</span>
                        <span className="text-xs opacity-70">({tickets.length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterStatus("new")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === "new"
                          ? "bg-blue-600 text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>New</span>
                        <span className="text-xs opacity-70">({tickets.filter(t => t.status === "new").length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterStatus("in_progress")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === "in_progress"
                          ? "bg-yellow-600 text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>In Progress</span>
                        <span className="text-xs opacity-70">({tickets.filter(t => t.status === "in_progress").length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterStatus("resolved")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === "resolved"
                          ? "bg-green-600 text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Resolved</span>
                        <span className="text-xs opacity-70">({tickets.filter(t => t.status === "resolved").length})</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterStatus("closed")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === "closed"
                          ? "bg-gray-600 text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Closed</span>
                        <span className="text-xs opacity-70">({tickets.filter(t => t.status === "closed").length})</span>
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* Assignment Filter */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3 px-2">Assignment</h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => setFilterAssignment("all")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterAssignment === "all"
                          ? "bg-[#4FA59C] text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>All Tickets</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterAssignment("mine")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterAssignment === "mine"
                          ? "bg-[#4FA59C] text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>My Tickets</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setFilterAssignment("unassigned")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterAssignment === "unassigned"
                          ? "bg-[#4FA59C] text-white"
                          : "text-[#D1D5DB] hover:bg-[#374151]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Unassigned</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Middle Column: Tickets List */}
            <div className="w-96 border-r border-border bg-card flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {filterStatus === "all" ? "All Tickets" : 
                   filterStatus === "new" ? "New Tickets" :
                   filterStatus === "in_progress" ? "In Progress" :
                   filterStatus === "resolved" ? "Resolved" :
                   filterStatus === "closed" ? "Closed" : "Tickets"}
                </h1>
                <span className="text-sm text-muted-foreground">({sortedTickets.length})</span>
              </div>
            </div>

            {/* Tickets List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 text-[#4FA59C] animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading tickets...</p>
                </div>
              ) : sortedTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground mb-1">No tickets found</p>
                  <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sortedTickets.map((ticket) => {
                    const StatusIcon = statusConfig[ticket.status].icon
                    const isSelected = selectedTicket?.id === ticket.id
                    return (
                      <div
                        key={ticket.id}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#4FA59C]/10 dark:bg-[#4FA59C]/20 border-l-4 border-[#4FA59C]"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => fetchTicketDetails(ticket.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-sm font-semibold truncate ${
                                isSelected ? "text-[#4FA59C]" : "text-foreground"
                              }`}>
                                {ticket.title}
                              </h3>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${statusConfig[ticket.status].color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig[ticket.status].label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {ticket.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{ticket.author.firstName} {ticket.author.lastName}</span>
                              <span>•</span>
                              <span>{formatDate(ticket.updatedAt)}</span>
                              {ticket.messageCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" />
                                    {ticket.messageCount}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

            {/* Right Column: Ticket Details */}
            <div className="flex-1 flex flex-col bg-card">
              {selectedTicket ? (
                loadingMessages ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 text-[#4FA59C] animate-spin mx-auto mb-4" />
                      <p className="text-lg text-foreground">Loading ticket details...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="p-6 border-b border-border bg-card">
                      <div className="flex items-center justify-between h-9">
                        {/* Left side: Patient name */}
                        <div className="flex items-center">
                          <p className="text-lg font-semibold text-foreground">
                            {selectedTicket.author.firstName} {selectedTicket.author.lastName}
                          </p>
                        </div>
                        
                        {/* Right side: Badges and actions */}
                        <div className="flex items-center gap-3">
                          {/* Badges */}
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusConfig[selectedTicket.status].color}`}>
                              {statusConfig[selectedTicket.status].label}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              {categoryConfig[selectedTicket.category].icon} {categoryConfig[selectedTicket.category].label}
                            </span>
                          </div>
                          
                          {/* Assign dropdown */}
                          <div className="relative" ref={assignDropdownRef}>
                            <button
                              onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-input bg-background hover:bg-muted transition-all text-sm text-foreground"
                            >
                              <User className="h-4 w-4" />
                              <span>
                                {selectedTicket.assignedTo 
                                  ? `${selectedTicket.assignedTo.firstName} ${selectedTicket.assignedTo.lastName}`
                                  : selectedTicket.assignedTeam || "Unassigned"
                                }
                              </span>
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            
                            {assignDropdownOpen && (
                              <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                <div className="p-2">
                                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                                    Assign to
                                  </div>
                                  {loadingUsers ? (
                                    <div className="px-3 py-4 text-center">
                                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <>
                                      <div 
                                        className={`px-3 py-2 hover:bg-muted cursor-pointer rounded flex items-center gap-2 ${
                                          !selectedTicket.assignedTo ? "bg-muted" : ""
                                        }`}
                                        onClick={() => assignTicket(null)}
                                      >
                                        {!selectedTicket.assignedTo && (
                                          <Check className="h-4 w-4 text-[#4FA59C]" />
                                        )}
                                        {selectedTicket.assignedTo && (
                                          <div className="h-4 w-4" />
                                        )}
                                        <span className="text-sm text-muted-foreground">Unassigned</span>
                                      </div>
                                      {assignableUsers.map((user) => (
                                        <div
                                          key={user.id}
                                          className={`px-3 py-2 hover:bg-muted cursor-pointer rounded flex items-center gap-2 ${
                                            selectedTicket.assignedTo?.id === user.id ? "bg-muted" : ""
                                          }`}
                                          onClick={() => assignTicket(user.id)}
                                        >
                                          {selectedTicket.assignedTo?.id === user.id ? (
                                            <Check className="h-4 w-4 text-[#4FA59C]" />
                                          ) : (
                                            <div className="h-4 w-4" />
                                          )}
                                          <div className="flex-1">
                                            <div className="text-sm text-foreground">
                                              {user.firstName} {user.lastName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                          </div>
                                        </div>
                                      ))}
                                      {assignableUsers.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground italic">
                                          No users available
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Status update icon */}
                          {getNextStatus(selectedTicket.status) && (
                            <button 
                              onClick={updateTicketStatus}
                              disabled={updatingStatus}
                              className="p-2 rounded-lg border border-input bg-background hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Mark as ${getNextStatus(selectedTicket.status)?.label}`}
                            >
                              {getNextStatusIcon(selectedTicket.status) && (
                                <span className={`${
                                  selectedTicket.status === "new" ? "text-yellow-600 dark:text-yellow-400" :
                                  selectedTicket.status === "in_progress" ? "text-green-600 dark:text-green-400" :
                                  selectedTicket.status === "resolved" ? "text-gray-600 dark:text-gray-400" :
                                  "text-muted-foreground"
                                }`}>
                                  {updatingStatus ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    getNextStatusIcon(selectedTicket.status)
                                  )}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                  {/* Content Area */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left: Comments/Chat */}
                    <div className="w-1/2 border-r border-border flex flex-col bg-muted/50">
                      {/* Comments Header */}
                      <div className="p-6 border-b border-border bg-card">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-5 w-5 text-[#4FA59C]" />
                          <h2 className="text-lg font-semibold text-foreground">
                            Comments
                          </h2>
                          <span className="text-sm text-muted-foreground">
                            ({selectedTicket.messageCount})
                          </span>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                          selectedTicket.messages.map((msg, index) => {
                            // Determine message type based on role
                            const isSystem = msg.role === "system";
                            const isSupport = msg.role === "support";
                            const isUser = msg.role === "user";
                            
                            // Green messages: system or support
                            const isGreenMessage = isSystem || isSupport;
                            
                            // Determine sender name based on role
                            let senderName = "";
                            if (isSystem) {
                              senderName = "System";
                            } else if (isSupport) {
                              senderName = selectedTicket.assignedTo 
                                ? `${selectedTicket.assignedTo.firstName} ${selectedTicket.assignedTo.lastName}`
                                : "Support Team";
                            } else {
                              senderName = `${selectedTicket.author.firstName} ${selectedTicket.author.lastName}`;
                            }
                            
                            return (
                            <div
                              key={index}
                              className={`flex ${isGreenMessage ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl p-4 shadow-sm ${
                                  isGreenMessage
                                    ? "bg-teal-50 dark:bg-teal-900/30 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                                    : "bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold">
                                    {senderName}
                                  </span>
                                  <span className={`text-xs ${
                                    isGreenMessage
                                      ? "text-teal-600 dark:text-teal-400"
                                      : "text-blue-600 dark:text-blue-400"
                                  }`}>
                                    {formatDate(msg.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {msg.message}
                                </p>
                              </div>
                            </div>
                            )
                          })
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-foreground">No comments yet</p>
                              <p className="text-xs text-muted-foreground mt-1">Be the first to reply</p>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Message Input */}
                      <div className="bg-card border-t border-border p-4">
                        <div className="flex gap-3">
                          <input
                            type="text"
                            placeholder="Write a comment..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                              }
                            }}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                            disabled={sending}
                          />
                          <button
                            onClick={sendMessage}
                            disabled={sending || !newMessage.trim()}
                            className="px-5 py-2.5 bg-[#4FA59C] text-white rounded-lg hover:bg-[#3d8479] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {sending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Ticket Details */}
                    <div className="w-1/2 overflow-y-auto bg-card">
                      {/* User Profile Section */}
                      <div className="p-6 border-b border-border bg-card">
                        <div className="flex gap-4">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4FA59C] to-[#3D8B84] flex items-center justify-center text-white font-semibold text-xl">
                              {selectedTicket.author.firstName.charAt(0)}{selectedTicket.author.lastName.charAt(0)}
                            </div>
                          </div>
                          
                          {/* Name and Details */}
                          <div className="flex-1 min-w-0">
                            <div className="mb-3">
                              <h2 className="text-lg font-semibold text-foreground">
                                {selectedTicket.author.firstName} {selectedTicket.author.lastName}
                              </h2>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {selectedTicket.author.email}
                              </p>
                            </div>

                            {/* User Info */}
                            <div className="space-y-2">
                              {/* Location */}
                              {(selectedTicket.author.city || selectedTicket.author.state) && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate">
                                    {selectedTicket.author.city && selectedTicket.author.state
                                      ? `${selectedTicket.author.city}, ${selectedTicket.author.state}`
                                      : selectedTicket.author.city || selectedTicket.author.state || 'Location not available'}
                                  </span>
                                </div>
                              )}
                              
                              {/* Company/Clinic */}
                              {selectedTicket.author.clinic && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate">{selectedTicket.author.clinic.name}</span>
                                </div>
                              )}
                              
                              {/* Role */}
                              {selectedTicket.author.role && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="capitalize">{selectedTicket.author.role}</span>
                                </div>
                              )}
                              
                              {/* Source */}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span>Support Ticket</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-6 space-y-6">
                        {/* Title */}
                        <div>
                          <h1 className="text-2xl font-bold text-foreground mb-4">
                            {selectedTicket.title}
                          </h1>
                        </div>
                      
                      {/* Description */}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedTicket.description}
                          </p>
                        </div>
                      </div>

                      {/* Tags if any */}
                      {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">Tags</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedTicket.tags.map((tag, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                              >
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>

                      {/* Separator - Full Width */}
                      <div className="border-t border-border"></div>

                      {/* Data Section */}
                      <div className="p-6 pt-6">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Data</h3>
                        <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-3">
                          {/* Email */}
                          <div className="flex items-center gap-3 py-2">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="text-sm font-medium text-foreground truncate">{selectedTicket.author.email}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(selectedTicket.author.email, "Email")}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Copy email"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>

                          {/* ID */}
                          <div className="flex items-center gap-3 py-2">
                            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">ID</p>
                              <p className="text-sm font-medium text-foreground font-mono truncate">{selectedTicket.id}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(selectedTicket.id, "ID")}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Copy ID"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Last updated */}
                          <div className="flex items-center gap-3 py-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">Last updated</p>
                              <p className="text-sm font-medium text-foreground">
                                {formatDate(selectedTicket.updatedAt)}
                              </p>
                              {selectedTicket.lastUpdatedBy && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  by {selectedTicket.lastUpdatedBy.firstName} {selectedTicket.lastUpdatedBy.lastName}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  </>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">Select a ticket to view details</p>
                    <p className="text-sm text-muted-foreground">Choose a ticket from the list on the left</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

