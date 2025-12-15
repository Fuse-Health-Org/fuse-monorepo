import React, { useState, useEffect, useRef } from "react";
import { Button, Input, Avatar, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { apiCall } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";

interface SupportBubbleProps {
  onTicketCreated?: () => void;
  onNavigateToMessenger?: () => void;
}

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
  role: "user" | "support" | "system";
  message: string;
  createdAt: string;
}

export const SupportBubble: React.FC<SupportBubbleProps> = ({ onTicketCreated, onNavigateToMessenger }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages">("home");
  
  // Home tab state
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  
  const categories = [
    { id: "medical", label: "Medical", icon: "lucide:heart", backendCategory: "general" },
    { id: "billing", label: "Billing", icon: "lucide:credit-card", backendCategory: "billing" },
    { id: "technical", label: "Technical Issue", icon: "lucide:settings", backendCategory: "technical" },
  ];
  
  // Messages tab state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
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
        
        // Ensure messages array exists for each ticket (even if empty)
        const ticketsWithMessages = ticketsList.map((ticket: Ticket) => ({
          ...ticket,
          messages: ticket.messages || [],
        }));
        
        setTickets(ticketsWithMessages);
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

  // Home tab: Create new ticket
  const handleCreateTicket = async () => {
    const token = localStorage.getItem('auth-token');
    
    if (!token || !title.trim() || !description.trim() || !selectedCategory) {
      return;
    }
    
    setCreating(true);

    try {
      const category = categories.find(c => c.id === selectedCategory);
      const backendCategory = category?.backendCategory || "general";

      const response = await apiCall("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: backendCategory,
        }),
      });

      if (response.success) {
        const createdTicket = response.data?.data;
        
        // Reset form state first to unmount the form completely
        setTitle("");
        setDescription("");
        setSelectedCategory(null);
        setShowCategorySelection(false);
        
        // Call callback to refresh tickets count
        if (onTicketCreated) {
          await onTicketCreated();
        }
        
        // Use requestAnimationFrame to ensure DOM updates complete before tab change
        requestAnimationFrame(() => {
          // Open the chat and switch to messages tab
          setIsOpen(true);
          setActiveTab("messages");
          
          // Wait for tab to change and useEffect to fetch tickets, then select the new ticket
          setTimeout(() => {
            if (createdTicket) {
              // Fetch tickets first to ensure they're loaded
              fetchTickets().then(() => {
                // Then select the newly created ticket
                setSelectedTicket(createdTicket);
              });
            }
          }, 300);
        });
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setCreating(false);
    }
  };

  // Messages tab: Send message to ticket
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

  // Load tickets when messages tab is active
  useEffect(() => {
    if (isOpen && activeTab === "messages") {
      fetchTickets();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedTicket?.messages]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isOpen || activeTab !== "messages") return;
    
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
  }, [isOpen, activeTab, selectedTicket?.id]);

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

  const getUserName = () => {
    if (user?.firstName) {
      return user.firstName;
    }
    return "there";
  };

  return (
    <>
      {/* Backdrop when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay/30 z-40"
            onClick={() => {
              if (!creating && !sending) {
                setIsOpen(false);
                setTitle("");
                setDescription("");
                setSelectedCategory(null);
                setShowCategorySelection(false);
                // Reset to home tab when closing
                setActiveTab("home");
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Bubble or Expanded Form */}
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="bubble"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              isIconOnly
              color="primary"
              size="lg"
              className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              onPress={() => setIsOpen(true)}
              aria-label="Support"
            >
              <Icon icon="lucide:message-circle" className="text-2xl" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-50 bg-content1 rounded-2xl shadow-2xl border border-content3 w-96 h-[600px] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-content3 bg-primary text-primary-foreground flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                    <Icon icon="lucide:headphones" className="text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Support</h3>
                    <p className="text-xs opacity-90">We're here for you</p>
                  </div>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="text-primary-foreground"
                  onPress={() => {
                    if (!creating && !sending) {
                      setIsOpen(false);
                      setTitle("");
                      setDescription("");
                      setSelectedCategory(null);
                      setShowCategorySelection(false);
                      // Reset to home tab when closing
                      setActiveTab("home");
                    }
                  }}
                  isDisabled={creating || sending}
                >
                  <Icon icon="lucide:x" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === "home" ? (
                /* Home Tab */
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Greeting, Card and Warning - Only show when not in category selection or form */}
                  {!showCategorySelection && !selectedCategory && (
                    <>
                      {/* Greeting */}
                      <div className="text-center py-4">
                        <h2 className="text-xl font-semibold mb-1">
                          Hi {getUserName()} 👋
                        </h2>
                        <p className="text-sm text-foreground-500">
                          How can we help you?
                        </p>
                      </div>

                      {/* Send Message Card */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-content2 rounded-xl p-4 border border-content3 hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => setShowCategorySelection(true)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Icon icon="lucide:message-square-plus" className="text-primary text-lg" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">Send us a message</h3>
                              <p className="text-xs text-foreground-500">Get help from our support team</p>
                            </div>
                          </div>
                          <Icon icon="lucide:chevron-right" className="text-foreground-400" />
                        </div>
                      </motion.div>

                      {/* Warning Message */}
                      <div className="bg-warning-50 border-l-4 border-warning-400 rounded-lg p-4">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-warning-800">
                            Platform Support Only
                          </p>
                          <p className="text-sm text-warning-700 leading-relaxed">
                            This support system is for technical issues, billing questions, or platform-related concerns only.
                          </p>
                          <p className="text-sm text-warning-700 leading-relaxed">
                            <strong>For medical concerns or prescription-related questions</strong>, please use the Messenger to communicate directly with your healthcare provider.
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Category Selection */}
                  {showCategorySelection && !selectedCategory && (
                    /* Category Selection */
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="flex-shrink-0"
                          onPress={() => {
                            setShowCategorySelection(false);
                            setSelectedCategory(null);
                          }}
                        >
                          <Icon icon="lucide:arrow-left" />
                        </Button>
                        <h3 className="font-semibold text-sm flex-1 mt-1">What can we help you with?</h3>
                      </div>
                      
                      <div className="space-y-2">
                        {categories.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            className="w-full p-3 bg-content2 rounded-xl border border-content3 hover:border-primary/50 transition-colors text-left flex items-center gap-3"
                          >
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <Icon icon={category.icon} className="text-primary text-lg" />
                            </div>
                            <span className="font-medium text-sm">{category.label}</span>
                            <Icon icon="lucide:chevron-right" className="text-foreground-400 ml-auto" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Medical Message - Only show when medical category is selected */}
                  {selectedCategory === "medical" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="flex-shrink-0"
                          onPress={() => {
                            setSelectedCategory(null);
                          }}
                        >
                          <Icon icon="lucide:arrow-left" />
                        </Button>
                        <h3 className="font-semibold text-sm flex-1 mt-1">Medical Concerns</h3>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icon icon="lucide:info" className="text-blue-600 text-lg" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-blue-900 leading-relaxed">
                              For medical concerns or prescription-related questions, please use the{' '}
                              {onNavigateToMessenger ? (
                                <button
                                  onClick={() => {
                                    setIsOpen(false);
                                    setSelectedCategory(null);
                                    setShowCategorySelection(false);
                                    setActiveTab("home");
                                    onNavigateToMessenger();
                                  }}
                                  className="font-semibold text-blue-700 underline hover:text-blue-800 transition-colors"
                                >
                                  Messenger
                                </button>
                              ) : (
                                <strong>Messenger</strong>
                              )}{' '}
                              to communicate directly with your healthcare provider.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        color="default"
                        variant="flat"
                        size="lg"
                        className="w-full"
                        onPress={() => {
                          setSelectedCategory(null);
                          setShowCategorySelection(false);
                        }}
                      >
                        Go Back
                      </Button>
                    </motion.div>
                  )}

                  {/* Ticket Form - Only show when billing or technical category is selected */}
                  {selectedCategory && selectedCategory !== "medical" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="flex-shrink-0"
                          onPress={() => {
                            setSelectedCategory(null);
                            setTitle("");
                            setDescription("");
                          }}
                        >
                          <Icon icon="lucide:arrow-left" />
                        </Button>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mt-1">New Support Request</h3>
                          <p className="text-xs text-foreground-500">
                            {categories.find(c => c.id === selectedCategory)?.label}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Subject</label>
                        <Input
                          placeholder="What do you need help with?"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          size="sm"
                          isDisabled={creating}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Message</label>
                        <textarea
                          placeholder="Describe your issue in detail..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                          disabled={creating}
                          className="w-full px-3 py-2 rounded-xl bg-content2 border border-content3 resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        />
                      </div>

                      <Button
                        color="primary"
                        size="lg"
                        className="w-full"
                        isDisabled={!title.trim() || !description.trim()}
                        onPress={handleCreateTicket}
                        isLoading={creating}
                      >
                        Send Message
                      </Button>
                    </motion.div>
                  )}
                </div>
              ) : (
                /* Messages Tab */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {selectedTicket ? (
                    /* Chat View */
                    <>
                      {/* Chat Header */}
                      <div className="p-3 border-b border-content3 flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => setSelectedTicket(null)}
                            >
                              <Icon icon="lucide:arrow-left" />
                            </Button>
                            <div>
                              <h3 className="font-semibold text-sm truncate max-w-[200px]">{selectedTicket.title}</h3>
                              <p className="text-xs text-foreground-500">{formatDate(selectedTicket.updatedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                              <div className="max-w-[80%]">
                                <div className="bg-blue-50 text-blue-900 rounded-2xl rounded-br-sm px-3 py-2 border border-blue-200">
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                                </div>
                                <p className="text-xs text-foreground-400 mt-1 text-right px-1">
                                  {formatDate(selectedTicket.createdAt)}
                                </p>
                              </div>
                            </motion.div>

                            {/* Messages */}
                            <AnimatePresence>
                              {selectedTicket.messages?.map((msg, index) => {
                                // Determine if message is from user based on role
                                const isUser = msg.role === "user";
                                const isSupport = msg.role === "support";
                                const isSystem = msg.role === "system";
                                
                                const prevMsg = index > 0 ? selectedTicket.messages?.[index - 1] : null;
                                const isSameSenderAsPrevious = prevMsg && prevMsg.role === msg.role;
                                
                                const nextMsg = index < (selectedTicket.messages?.length || 0) - 1 ? selectedTicket.messages?.[index + 1] : null;
                                const isSameSenderAsNext = nextMsg && nextMsg.role === msg.role;
                                
                                const showHeader = !isSameSenderAsPrevious;
                                const showTimestamp = !isSameSenderAsNext;
                                
                                return (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`flex ${isUser ? "justify-end" : "justify-start"} ${isSameSenderAsPrevious ? "mt-0.5" : "mt-2"}`}
                                  >
                                    <div className={`max-w-[80%] ${!isUser ? "flex gap-2" : ""}`}>
                                      {isSupport && (
                                        showHeader ? (
                                          <Avatar
                                            size="sm"
                                            icon={<Icon icon="lucide:building-2" />}
                                            classNames={{
                                              base: "bg-teal-100 flex-shrink-0 w-6 h-6",
                                              icon: "text-teal-600 text-xs"
                                            }}
                                          />
                                        ) : (
                                          <div className="w-6 flex-shrink-0"></div>
                                        )
                                      )}
                                      
                                      <div className="flex-1">
                                        {!isUser && showHeader && (
                                          <p className="text-xs font-semibold mb-1 px-1" style={{ color: isSupport ? "#14b8a6" : "#6B7280" }}>
                                            {isSupport ? "Support Team" : "System"}
                                          </p>
                                        )}
                                        
                                        <div className={`rounded-2xl px-3 py-2 ${
                                          isUser
                                            ? "bg-blue-50 text-blue-900 rounded-br-sm border border-blue-200"
                                            : isSupport
                                            ? "bg-teal-50 text-teal-900 rounded-bl-sm border border-teal-200"
                                            : "bg-content2 rounded-bl-sm"
                                        }`}>
                                          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                        </div>
                                        
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
                                );
                              })}
                            </AnimatePresence>

                            <div ref={messagesEndRef} />
                          </>
                        )}
                      </div>

                      {/* Message Input */}
                      {selectedTicket.status !== "closed" && (
                        <div className="p-3 border-t border-content3 flex-shrink-0">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type a message..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                              className="flex-1"
                              size="sm"
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
                    /* Tickets List */
                    <div className="flex-1 overflow-y-auto">
                      {loading ? (
                        <div className="flex items-center justify-center h-32">
                          <Spinner size="sm" />
                        </div>
                      ) : tickets.length === 0 ? (
                        <div className="p-6 text-center">
                          <div className="w-12 h-12 bg-content2 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Icon icon="lucide:message-circle" className="text-xl text-foreground-400" />
                          </div>
                          <p className="text-sm text-foreground-500 mb-4">No conversations yet</p>
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => setActiveTab("home")}
                          >
                            Start a conversation
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y divide-content3">
                          {tickets.map((ticket) => {
                            // Get last message
                            const lastMessage = ticket.messages && ticket.messages.length > 0 
                              ? ticket.messages[ticket.messages.length - 1]
                              : null;
                            
                            // Determine if last message is from user or support based on role
                            const isLastMessageFromUser = lastMessage?.role === "user";
                            
                            // If no messages, use description as fallback
                            const fullMessage = lastMessage 
                              ? lastMessage.message 
                              : ticket.description || "No messages yet";
                            
                            // Truncate message to ~10 characters with ellipsis
                            const displayMessage = fullMessage.length > 10 
                              ? fullMessage.substring(0, 10) + "..." 
                              : fullMessage;
                            
                            return (
                              <button
                                key={ticket.id}
                                onClick={() => fetchTicketDetails(ticket.id)}
                                className={`w-full p-3 text-left hover:bg-content2 transition-colors ${
                                  selectedTicket?.id === ticket.id ? "bg-primary-50" : ""
                                }`}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  {/* Avatar/Icon of last sender */}
                                  {lastMessage ? (
                                    isLastMessageFromUser ? (
                                      <Avatar
                                        size="sm"
                                        name={user?.firstName || "You"}
                                        classNames={{
                                          base: "bg-blue-100 flex-shrink-0 w-10 h-10",
                                        }}
                                      />
                                    ) : (
                                      <Avatar
                                        size="sm"
                                        icon={<Icon icon="lucide:building-2" />}
                                        classNames={{
                                          base: "bg-teal-100 flex-shrink-0 w-10 h-10",
                                          icon: "text-teal-600"
                                        }}
                                      />
                                    )
                                  ) : (
                                    <Avatar
                                      size="sm"
                                      icon={<Icon icon="lucide:message-circle" />}
                                      classNames={{
                                        base: "bg-content2 flex-shrink-0 w-10 h-10",
                                        icon: "text-foreground-400"
                                      }}
                                    />
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-sm truncate mb-1">{ticket.title}</h3>
                                    <div className="text-xs text-foreground-500 truncate mb-1 flex items-center gap-1">
                                      <span>{displayMessage}</span>
                                      <span className="text-foreground-400">·</span>
                                      <span className="text-foreground-400">
                                        {lastMessage ? formatDate(lastMessage.createdAt) : formatDate(ticket.updatedAt)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Arrow icon */}
                                  <Icon 
                                    icon="lucide:chevron-right" 
                                    className="text-foreground-400 flex-shrink-0"
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Navigation Tabs */}
            <div className="border-t border-content3 bg-content1 flex-shrink-0">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("home")}
                  className={`flex-1 py-3 px-4 flex flex-col items-center justify-center gap-1 transition-colors ${
                    activeTab === "home"
                      ? "text-primary bg-primary/10"
                      : "text-foreground-500 hover:text-foreground hover:bg-content2"
                  }`}
                >
                  <Icon icon="lucide:home" className="text-xl" />
                  <span className="text-xs font-medium">Home</span>
                </button>
                <button
                  onClick={() => setActiveTab("messages")}
                  className={`flex-1 py-3 px-4 flex flex-col items-center justify-center gap-1 transition-colors ${
                    activeTab === "messages"
                      ? "text-primary bg-primary/10"
                      : "text-foreground-500 hover:text-foreground hover:bg-content2"
                  }`}
                >
                  <Icon icon="lucide:message-circle" className="text-xl" />
                  <span className="text-xs font-medium">Messages</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
};
