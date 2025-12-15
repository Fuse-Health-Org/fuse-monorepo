import React, { useState, useEffect, useRef } from "react";
import { Button, Avatar, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { apiCall } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages?: TicketMessage[];
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface TicketMessage {
  id: string;
  message: string;
  senderType: "user" | "support" | "system";
  sender: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface SupportChatProps {
  onTicketCreated?: () => void;
}

export const SupportChat: React.FC<SupportChatProps> = ({ onTicketCreated }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch user's tickets
  const fetchTickets = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    
    setLoading(true);

    try {
      const response = await apiCall("/support/tickets", {
        method: "GET",
      });

      if (response.success && response.data?.data?.tickets) {
        const allTickets = response.data.data.tickets;
        // Filter out closed tickets
        const ticketsList = allTickets.filter((ticket: Ticket) => ticket.status !== "closed");
        setTickets(ticketsList);
        
        // Auto-select first ticket if exists and no ticket is currently selected
        if (ticketsList.length > 0 && !selectedTicket) {
          fetchTicketDetails(ticketsList[0].id);
        }
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ticket details with messages
  const fetchTicketDetails = async (ticketId: string) => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    setLoadingMessages(true);

    try {
      const response = await apiCall(`/support/tickets/${ticketId}`, {
        method: "GET",
      });

      if (response.success && response.data?.data) {
        setSelectedTicket(response.data.data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Show confirmation modal
  const handleShowConfirmation = () => {
    if (!newTicketTitle.trim() || !newTicketDescription.trim()) return;
    setShowConfirmModal(true);
  };

  // Create new ticket
  const handleCreateTicket = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token || !newTicketTitle.trim() || !newTicketDescription.trim()) return;
    setCreating(true);
    setShowConfirmModal(false);

    try {
      const response = await apiCall("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: newTicketTitle,
          description: newTicketDescription,
        }),
      });

      if (response.success && response.data?.data) {
        setNewTicketTitle("");
        setNewTicketDescription("");
        setShowNewTicketForm(false);
        await fetchTickets();
        setSelectedTicket(response.data.data);
        
        // Call callback if provided
        if (onTicketCreated) {
          onTicketCreated();
        }
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setCreating(false);
    }
  };

  // Send message to ticket
  const handleSendMessage = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token || !selectedTicket || !newMessage.trim()) return;
    setSending(true);

    try {
      const response = await apiCall(`/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: newMessage,
        }),
      });

      if (response.success) {
        setNewMessage("");
        await fetchTicketDetails(selectedTicket.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedTicket?.messages]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (!token) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Initialize socket connection
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Listen for new messages
    socket.on('ticket:message', (data) => {
      // Refresh tickets list to update message count
      fetchTickets();
      
      // If this message is for the currently selected ticket, reload it
      if (selectedTicket && data.ticketId === selectedTicket.id) {
        fetchTicketDetails(selectedTicket.id);
      }
    });

    // Listen for ticket updates (status changes)
    socket.on('ticket:updated', (data) => {
      fetchTickets();
      
      // If the ticket was closed and it's currently selected, deselect it
      if (selectedTicket && data.ticketId === selectedTicket.id) {
        if (data.status === 'closed') {
          setSelectedTicket(null);
        } else {
          setSelectedTicket(prev => prev ? { ...prev, status: data.status } : null);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [selectedTicket?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-yellow-100 text-yellow-700";
      case "resolved": return "bg-green-100 text-green-700";
      case "closed": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new": return "New";
      case "in_progress": return "In Progress";
      case "resolved": return "Resolved";
      case "closed": return "Closed";
      default: return status;
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-content1 rounded-xl overflow-hidden border border-content3">
      {/* Tickets List Sidebar */}
      <div className="w-80 border-r border-content3 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-content3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Support</h2>
            <Button
              size="sm"
              color="primary"
              startContent={<Icon icon="lucide:plus" />}
              onPress={() => setShowNewTicketForm(true)}
            >
              New
            </Button>
          </div>
          <p className="text-sm text-foreground-500">We're here to help!</p>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size="sm" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="lucide:message-circle" className="text-2xl text-foreground-400" />
              </div>
              <p className="text-foreground-500 mb-4">No conversations yet</p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => setShowNewTicketForm(true)}
              >
                Start a conversation
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-content3">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => fetchTicketDetails(ticket.id)}
                  className={`w-full p-4 text-left hover:bg-content2 transition-colors ${
                    selectedTicket?.id === ticket.id ? "bg-primary-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-sm truncate flex-1">{ticket.title}</h3>
                  </div>
                  <p className="text-xs text-foreground-500 truncate mb-2">{ticket.description}</p>
                  <div className="flex items-center justify-between text-xs text-foreground-400">
                    <span>{formatDate(ticket.updatedAt)}</span>
                    {ticket.messageCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Icon icon="lucide:message-circle" className="text-xs" />
                        {ticket.messageCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {showNewTicketForm ? (
          // New Ticket Form
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">New Support Request</h3>
              <Button
                isIconOnly
                variant="light"
                onPress={() => {
                  setShowNewTicketForm(false);
                  setShowConfirmModal(false);
                }}
              >
                <Icon icon="lucide:x" />
              </Button>
            </div>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <Input
                  placeholder="What do you need help with?"
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  size="lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  placeholder="Describe your issue in detail..."
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-content2 border border-content3 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                color="primary"
                size="lg"
                className="w-full"
                isDisabled={!newTicketTitle.trim() || !newTicketDescription.trim()}
                onPress={handleShowConfirmation}
              >
                Send Message
              </Button>
            </div>
          </div>
        ) : selectedTicket ? (
          // Chat View
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-content3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedTicket.title}</h3>
                </div>
                <Button
                  isIconOnly
                  variant="light"
                  onPress={() => setSelectedTicket(null)}
                  className="md:hidden"
                >
                  <Icon icon="lucide:arrow-left" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner size="sm" />
                </div>
              ) : (
                <>
                  {/* Initial message (description) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[70%]">
                      <div className="bg-blue-50 text-blue-900 rounded-2xl rounded-br-sm px-4 py-3 border border-blue-200">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>
                      <p className="text-xs text-foreground-400 mt-1 text-right px-1">
                        {formatDate(selectedTicket.createdAt)}
                      </p>
                    </div>
                  </motion.div>

                  {/* Messages */}
                  <AnimatePresence>
                    {selectedTicket.messages?.map((msg, index) => {
                      // Determine if message is from user (patient) or support
                      // Use hybrid logic: check both senderType and compare with ticket author/current user
                      let isUser = false
                      
                      // First priority: If senderType is explicitly "support", it's NOT from user
                      if (msg.senderType === "support") {
                        isUser = false
                      }
                      // Check if message is from the ticket author (patient)
                      else if (selectedTicket.author) {
                        isUser = msg.sender.firstName === selectedTicket.author.firstName && 
                                 msg.sender.lastName === selectedTicket.author.lastName
                      }
                      // Fallback: check against current logged-in user
                      else if (user) {
                        isUser = msg.sender.firstName === user.firstName && 
                                 msg.sender.lastName === user.lastName
                      }
                      // Default: if senderType is "user", treat as user message
                      else {
                        isUser = msg.senderType === "user"
                      }
                      
                      const isSupport = !isUser && msg.senderType !== "system"
                      
                      // Check if this message is from the same sender as the previous message
                      const prevMsg = index > 0 ? selectedTicket.messages?.[index - 1] : null
                      const isSameSenderAsPrevious = prevMsg && 
                        prevMsg.sender.firstName === msg.sender.firstName &&
                        prevMsg.sender.lastName === msg.sender.lastName
                      
                      // Check if next message is from the same sender
                      const nextMsg = index < (selectedTicket.messages?.length || 0) - 1 ? selectedTicket.messages?.[index + 1] : null
                      const isSameSenderAsNext = nextMsg &&
                        nextMsg.sender.firstName === msg.sender.firstName &&
                        nextMsg.sender.lastName === msg.sender.lastName
                      
                      // Determine if we should show the avatar and name (first in group)
                      const showHeader = !isSameSenderAsPrevious
                      
                      // Determine if we should show the timestamp (last in group)
                      const showTimestamp = !isSameSenderAsNext
                      
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex ${isUser ? "justify-end" : "justify-start"} ${isSameSenderAsPrevious ? "mt-0.5" : "mt-4"}`}
                        >
                          <div className={`max-w-[70%] ${!isUser ? "flex gap-2" : ""}`}>
                            {/* Avatar/Spacer for support/brand messages */}
                            {isSupport && (
                              showHeader ? (
                                <Avatar
                                  size="sm"
                                  icon={<Icon icon="lucide:building-2" />}
                                  classNames={{
                                    base: "bg-teal-100 flex-shrink-0",
                                    icon: "text-teal-600"
                                  }}
                                />
                              ) : (
                                // Spacer to maintain alignment for grouped messages
                                <div className="w-8 flex-shrink-0"></div>
                              )
                            )}
                            
                            <div className="flex-1">
                              {/* Sender name for non-user messages - only show for first message in group */}
                              {!isUser && showHeader && (
                                <p className="text-xs font-semibold mb-1 px-1" style={{ color: isSupport ? "#14b8a6" : "#6B7280" }}>
                                  {isSupport ? "Support Team" : "System"}
                                </p>
                              )}
                              
                              {/* Message bubble */}
                              <div className={`rounded-2xl px-4 py-3 ${
                                isUser
                                  ? "bg-blue-50 text-blue-900 rounded-br-sm border border-blue-200"
                                  : isSupport
                                  ? "bg-teal-50 text-teal-900 rounded-bl-sm border border-teal-200"
                                  : "bg-content2 rounded-bl-sm"
                              }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                              </div>
                              
                              {/* Timestamp - only show for last message in group */}
                              {showTimestamp && (
                                <p className={`text-xs text-foreground-400 mt-1 px-1 ${
                                  isUser ? "text-right" : ""
                                }`}>
                                  {formatDate(msg.createdAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {/* Auto-response if no messages yet */}
                  {(!selectedTicket.messages || selectedTicket.messages.length === 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex justify-start"
                    >
                      <div className="flex gap-2 max-w-[70%]">
                        <Avatar
                          size="sm"
                          icon={<Icon icon="lucide:building-2" />}
                          classNames={{
                            base: "bg-teal-100 flex-shrink-0",
                            icon: "text-teal-600"
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold mb-1 px-1" style={{ color: "#14b8a6" }}>Support Team</p>
                          <div className="bg-teal-50 text-teal-900 rounded-2xl rounded-bl-sm px-4 py-3 border border-teal-200">
                            <p className="text-sm leading-relaxed">
                              Thanks for reaching out! We've received your message and our team will get back to you shortly. 
                              You'll also receive updates via email.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            {selectedTicket.status !== "closed" && (
              <div className="p-4 border-t border-content3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    className="flex-1"
                    size="lg"
                  />
                  <Button
                    isIconOnly
                    color="primary"
                    size="lg"
                    isLoading={sending}
                    isDisabled={!newMessage.trim()}
                    onPress={handleSendMessage}
                  >
                    <Icon icon="lucide:send" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="lucide:message-circle" className="text-3xl text-foreground-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Welcome to Support</h3>
              <p className="text-foreground-500 mb-6 max-w-sm">
                Select a conversation from the list or start a new one. 
                We're here to help!
              </p>
              <Button
                color="primary"
                startContent={<Icon icon="lucide:plus" />}
                onPress={() => setShowNewTicketForm(true)}
              >
                New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <>
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => !creating && setShowConfirmModal(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-content1 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon icon="lucide:alert-triangle" className="text-yellow-600 text-xl" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Confirm Support Request</h3>
                      <p className="text-sm text-foreground-500">Please read before continuing</p>
                    </div>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => !creating && setShowConfirmModal(false)}
                    isDisabled={creating}
                  >
                    <Icon icon="lucide:x" />
                  </Button>
                </div>

                {/* Warning Content */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-yellow-800">
                      Platform Support Only
                    </p>
                    <p className="text-sm text-yellow-700 leading-relaxed">
                      This support system is for technical issues, billing questions, or platform-related concerns only.
                    </p>
                    <p className="text-sm text-yellow-700 leading-relaxed">
                      <strong>For medical concerns or prescription-related questions</strong>, please use the Messenger to communicate directly with your healthcare provider.
                    </p>
                  </div>
                </div>

                {/* Question */}
                <div className="pt-2">
                  <p className="text-sm font-medium text-center">
                    Are you sure you want to create this support ticket?
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    color="default"
                    variant="flat"
                    size="lg"
                    className="flex-1"
                    onPress={() => setShowConfirmModal(false)}
                    isDisabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    size="lg"
                    className="flex-1"
                    isLoading={creating}
                    onPress={handleCreateTicket}
                  >
                    Yes, Create Ticket
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

