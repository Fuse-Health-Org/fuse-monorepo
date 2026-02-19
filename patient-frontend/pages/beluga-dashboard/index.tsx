import React from "react";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody, Input, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarEmoji } from "../../lib/avatarUtils";
import { DashboardSelector } from "../../components/DashboardSelector";
import { apiCall } from "../../lib/api";

/**
 * Beluga Dashboard - Beluga Health Portal (Placeholder)
 * 
 * This dashboard will use Beluga API for:
 * - Patient management
 * - Prescription management
 * - Provider messaging
 * - Treatment tracking
 * 
 * Currently a placeholder until Beluga API integration is complete.
 */

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface BelugaVisit {
  orderId: string;
  masterId: string;
  belugaVisitId?: string | null;
  orderStatus?: string;
  orderCreatedAt?: string;
  visitStatus?: string | null;
  resolvedStatus?: string | null;
  updateTimestamp?: string | null;
  visitType?: string | null;
  formObj?: {
    patientPreference?: Array<{
      name?: string;
      strength?: string;
      quantity?: string;
      refills?: string;
      daysSupply?: string;
      medId?: string;
    }>;
    intakeResults?: Array<{ question: string; answer: string }>;
  } | null;
  rxHistory: Array<{
    rxTimestamp?: string;
    name?: string;
    medId?: string;
    refills?: string;
    quantity?: string;
    strength?: string;
    pharmacyName?: string;
  }>;
}

interface BelugaChatMessage {
  id: string;
  masterId: string;
  eventType: string;
  senderRole: "patient" | "doctor" | "beluga_admin" | "system";
  channel: "patient_chat" | "customer_service" | "system";
  message?: string;
  source: "webhook" | "outbound";
  createdAt: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
  { id: "treatments", label: "Treatments", icon: "lucide:pill" },
  { id: "messages", label: "Messages", icon: "lucide:message-circle" },
  { id: "account", label: "Account", icon: "lucide:user" },
];

function BelugaSidebar({ 
  activeTab, 
  setActiveTab,
  isMobile = false,
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
}) {
  const { user, signOut } = useAuth();

  return (
    <div className={`
      ${isMobile ? 'w-full' : 'w-64'} 
      h-full bg-content1 border-r border-content3 flex flex-col
    `}>
      {/* Logo */}
      <div className="p-4 border-b border-content3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <Icon icon="lucide:activity" className="text-white text-lg" />
          </div>
          <span className="font-semibold text-lg">
            <span className="text-teal-500">Beluga</span> Health
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "flat" : "light"}
            className={`w-full justify-start gap-3 ${
              activeTab === item.id 
                ? "bg-teal-500/10 text-teal-600" 
                : "text-foreground-600"
            }`}
            onPress={() => setActiveTab(item.id)}
            startContent={<Icon icon={item.icon} className="text-lg" />}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-content3">
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            size="sm"
            fallback={<span className="text-lg">{getAvatarEmoji(user)}</span>}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-foreground-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="light"
          className="w-full justify-start text-danger"
          startContent={<Icon icon="lucide:log-out" />}
          onPress={signOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function BelugaDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [visits, setVisits] = React.useState<BelugaVisit[]>([]);
  const [selectedMasterId, setSelectedMasterId] = React.useState("");
  const [messageDrafts, setMessageDrafts] = React.useState<Record<string, string>>({});
  const [csDrafts, setCsDrafts] = React.useState<Record<string, string>>({});
  const [messageResults, setMessageResults] = React.useState<Record<string, string>>({});
  const [chatMessagesByMaster, setChatMessagesByMaster] = React.useState<Record<string, BelugaChatMessage[]>>({});
  const [chatLoadingByMaster, setChatLoadingByMaster] = React.useState<Record<string, boolean>>({});
  const [nameFirst, setNameFirst] = React.useState("");
  const [nameLast, setNameLast] = React.useState("");
  const [accountResult, setAccountResult] = React.useState<string | null>(null);

  const loadBelugaData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall("/beluga/my-visits");
      if (!res.success) {
        throw new Error((res as any).error || "Failed to load Beluga visits");
      }

      const visitList: BelugaVisit[] = Array.isArray((res.data as any)?.data) ? (res.data as any).data : [];
      setVisits(visitList);
      setSelectedMasterId(visitList[0]?.masterId || "");
      setNameFirst(user?.firstName || "");
      setNameLast(user?.lastName || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load Beluga dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [user?.firstName, user?.lastName]);

  // Close mobile menu when tab changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  React.useEffect(() => {
    loadBelugaData();
  }, [loadBelugaData]);

  const loadChatMessages = React.useCallback(async (masterId: string) => {
    if (!masterId) return;
    setChatLoadingByMaster((prev) => ({ ...prev, [masterId]: true }));
    try {
      const response = await apiCall(`/beluga/chats/${encodeURIComponent(masterId)}/messages`);
      if (!response.success) {
        throw new Error(response.error || "Failed to load messages");
      }
      const messages = Array.isArray((response.data as any)?.data)
        ? ((response.data as any).data as BelugaChatMessage[])
        : [];
      setChatMessagesByMaster((prev) => ({ ...prev, [masterId]: messages }));
    } catch {
      setChatMessagesByMaster((prev) => ({ ...prev, [masterId]: [] }));
    } finally {
      setChatLoadingByMaster((prev) => ({ ...prev, [masterId]: false }));
    }
  }, []);

  React.useEffect(() => {
    if (activeTab !== "messages" || visits.length === 0) return;
    visits.forEach((visit) => {
      if (!chatMessagesByMaster[visit.masterId]) {
        loadChatMessages(visit.masterId);
      }
    });
  }, [activeTab, visits, chatMessagesByMaster, loadChatMessages]);

  const handleSendMessage = async (masterId: string, customerService = false) => {
    const draft = customerService ? csDrafts[masterId] : messageDrafts[masterId];
    if (!masterId || !draft?.trim()) return;
    setMessageResults((prev) => ({ ...prev, [masterId]: "" }));
    const endpoint = customerService ? "/beluga/messages/customer-service" : "/beluga/messages/patient";
    const payload = customerService
      ? { masterId, content: draft.trim() }
      : { masterId, content: draft.trim(), isMedia: false };

    const response = await apiCall(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.success) {
      setMessageResults((prev) => ({ ...prev, [masterId]: response.error || "Failed to send message." }));
      return;
    }

    setMessageResults((prev) => ({ ...prev, [masterId]: "Message sent to Beluga successfully." }));
    if (customerService) {
      setCsDrafts((prev) => ({ ...prev, [masterId]: "" }));
    } else {
      setMessageDrafts((prev) => ({ ...prev, [masterId]: "" }));
    }

    await loadChatMessages(masterId);
  };

  const handleNameUpdate = async () => {
    if (!selectedMasterId || !nameFirst.trim() || !nameLast.trim()) return;
    setAccountResult(null);

    const response = await apiCall(`/beluga/patients/${encodeURIComponent(selectedMasterId)}/name`, {
      method: "POST",
      body: JSON.stringify({
        firstName: nameFirst.trim(),
        lastName: nameLast.trim(),
      }),
    });

    if (!response.success) {
      setAccountResult(response.error || "Failed to update name in Beluga.");
      return;
    }

    setAccountResult("Patient name update sent to Beluga.");
  };

  const totalRx = visits.reduce((acc, item) => acc + item.rxHistory.length, 0);
  const activeVisits = visits.filter((v) => v.visitStatus && ["active", "pending", "holding", "admin"].includes(v.visitStatus.toLowerCase())).length;
  const resolvedVisits = visits.filter((v) => (v.resolvedStatus || "").toLowerCase() === "closed").length;
  const isOutboundMessage = (message: BelugaChatMessage) => message.source === "outbound";
  const getSenderLabel = (message: BelugaChatMessage) => {
    if (isOutboundMessage(message)) return "You";
    if (message.channel === "customer_service") return "Customer Service";
    if (message.senderRole === "doctor") return "Provider";
    if (message.senderRole === "beluga_admin") return "Beluga Admin";
    return "System";
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row h-screen bg-background">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between h-16 border-b border-content3 bg-content1 px-4">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Icon icon={isMobileMenuOpen ? "lucide:x" : "lucide:menu"} className="text-lg" />
            </Button>
            <div className="font-semibold text-lg text-foreground">
              <span className="text-teal-500">Beluga</span> Health
            </div>
          </div>
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            className="cursor-pointer"
            size="sm"
            fallback={<span className="text-xl">{getAvatarEmoji(user)}</span>}
          />
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-overlay/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Hidden on mobile unless menu is open */}
        <div className={`
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 fixed md:relative z-50 h-full transition-transform duration-300 ease-in-out
          md:h-screen md:flex md:flex-col
        `}>
          <BelugaSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between h-16 border-b border-content3 bg-content1 px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">
                {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <DashboardSelector />
              <Avatar
                name={user?.firstName || user?.email || 'User'}
                className="cursor-pointer"
                size="sm"
                fallback={<span className="text-xl">{getAvatarEmoji(user)}</span>}
              />
            </div>
          </div>

          {/* Content Area */}
          <motion.main
            className="flex-1 overflow-y-auto p-4 md:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {error && (
              <Card className="max-w-4xl mx-auto mb-6 border border-danger/40">
                <CardBody className="p-4 text-danger text-sm flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <Button size="sm" variant="flat" onPress={loadBelugaData}>
                    Retry
                  </Button>
                </CardBody>
              </Card>
            )}

            {activeTab === "dashboard" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card><CardBody className="p-5"><p className="text-sm text-foreground-500">Total Visits</p><p className="text-2xl font-semibold">{visits.length}</p></CardBody></Card>
                  <Card><CardBody className="p-5"><p className="text-sm text-foreground-500">Active Visits</p><p className="text-2xl font-semibold">{activeVisits}</p></CardBody></Card>
                  <Card><CardBody className="p-5"><p className="text-sm text-foreground-500">Resolved Visits</p><p className="text-2xl font-semibold">{resolvedVisits}</p></CardBody></Card>
                </div>

                <Card>
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Patient Snapshot</h3>
                    <div className="text-sm space-y-2">
                      <p><span className="text-foreground-500">Name:</span> {user?.firstName || "-"} {user?.lastName || ""}</p>
                      <p><span className="text-foreground-500">Email:</span> {user?.email || "-"}</p>
                      <p><span className="text-foreground-500">Total Visits:</span> {visits.length}</p>
                      <p><span className="text-foreground-500">Total Prescriptions in History:</span> {totalRx}</p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {activeTab === "treatments" && (
              <div className="max-w-4xl mx-auto space-y-4">
                {loading && <p className="text-sm text-foreground-500">Loading treatments...</p>}
                {!loading && visits.length === 0 && (
                  <Card><CardBody className="p-6 text-sm text-foreground-500">No Beluga visits found yet.</CardBody></Card>
                )}
                {visits.map((visit) => (
                  <Card key={visit.masterId}>
                    <CardBody className="p-6 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold">
                            {visit.formObj?.patientPreference?.map(p => p.name).filter(Boolean).join(", ") || "Beluga Visit"}
                          </h3>
                          <p className="text-xs text-foreground-400 mt-0.5">
                            Visit Type: {visit.visitType || "-"} &nbsp;·&nbsp; Ordered: {visit.orderCreatedAt ? new Date(visit.orderCreatedAt).toLocaleDateString() : "-"}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          visit.visitStatus === "active" || visit.visitStatus === "pending"
                            ? "bg-teal-500/10 text-teal-600"
                            : visit.visitStatus === "resolved"
                            ? "bg-success/10 text-success"
                            : "bg-content2 text-foreground-500"
                        }`}>
                          {(visit.visitStatus || "pending").toUpperCase()}
                        </span>
                      </div>

                      {/* Requested Treatment */}
                      {Array.isArray(visit.formObj?.patientPreference) && visit.formObj!.patientPreference!.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground-500 mb-1.5 uppercase tracking-wide">Requested Treatment</p>
                          <div className="space-y-2">
                            {visit.formObj!.patientPreference!.map((pref, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-content2 text-sm">
                                <p className="font-medium">{pref.name || "Medication"}</p>
                                <p className="text-foreground-500 text-xs mt-0.5">
                                  {[
                                    pref.strength && `Strength: ${pref.strength}`,
                                    pref.quantity && `Qty: ${pref.quantity}`,
                                    pref.refills && `Refills: ${pref.refills}`,
                                    pref.daysSupply && `Days Supply: ${pref.daysSupply}`,
                                  ].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prescription History */}
                      <div>
                        <p className="text-xs font-medium text-foreground-500 mb-1.5 uppercase tracking-wide">Prescription History</p>
                        {visit.rxHistory.length === 0 ? (
                          <p className="text-sm text-foreground-400">No prescriptions written yet — visit is pending doctor review.</p>
                        ) : (
                          <div className="space-y-2">
                            {visit.rxHistory.map((rx, idx) => (
                              <div key={`${visit.masterId}-${idx}`} className="p-3 rounded-lg bg-content2 text-sm">
                                <p className="font-medium">{rx.name || "Medication"}</p>
                                <p className="text-foreground-500 text-xs mt-0.5">
                                  {[
                                    rx.strength && `Strength: ${rx.strength}`,
                                    rx.quantity && `Qty: ${rx.quantity}`,
                                    rx.refills && `Refills: ${rx.refills}`,
                                    rx.pharmacyName && `Pharmacy: ${rx.pharmacyName}`,
                                  ].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-foreground-400">
                        Last updated: {visit.updateTimestamp ? new Date(visit.updateTimestamp).toLocaleString() : "—"}
                        &nbsp;·&nbsp; Visit ID: {visit.belugaVisitId || visit.masterId}
                      </p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "messages" && (
              <div className="max-w-4xl mx-auto space-y-4">
                {loading && (
                  <Card>
                    <CardBody className="p-6 text-sm text-foreground-500">
                      Syncing visits and chat threads from Beluga...
                    </CardBody>
                  </Card>
                )}
                {visits.length === 0 && (
                  <Card>
                    <CardBody className="p-6 text-sm text-foreground-500">
                      No Beluga visits available yet. Messages are tied to an existing visit masterId.
                    </CardBody>
                  </Card>
                )}
                {visits.map((visit) => (
                  <Card key={`chat-${visit.masterId}`}>
                    <CardBody className="p-6 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {visit.formObj?.patientPreference?.map(p => p.name).filter(Boolean).join(", ") || "Beluga Visit"}
                          </h3>
                          <p className="text-xs text-foreground-400 mt-0.5">masterId: {visit.masterId}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-content2">
                          {(visit.visitStatus || "pending").toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-content2 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground-700">Provider Chat</h4>
                            <span className="text-[11px] text-foreground-500">patient_chat</span>
                          </div>
                          <div className="max-h-72 overflow-y-auto space-y-2 rounded-lg bg-content1 p-3">
                            {chatLoadingByMaster[visit.masterId] ? (
                              <p className="text-xs text-foreground-400">Loading provider conversation...</p>
                            ) : (chatMessagesByMaster[visit.masterId] || []).filter((message) => message.channel === "patient_chat").length > 0 ? (
                              (chatMessagesByMaster[visit.masterId] || [])
                                .filter((message) => message.channel === "patient_chat")
                                .map((message) => {
                                  const outbound = isOutboundMessage(message);
                                  return (
                                    <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${outbound ? "bg-teal-600 text-white" : "bg-content2 text-foreground-700"}`}>
                                        <p className={`text-[11px] font-semibold ${outbound ? "text-white/90" : "text-foreground-500"}`}>
                                          {getSenderLabel(message)}
                                        </p>
                                        <p className={`text-sm ${outbound ? "text-white" : "text-foreground-700"}`}>
                                          {message.message || "(no text)"}
                                        </p>
                                        <p className={`text-[11px] mt-1 ${outbound ? "text-white/80" : "text-foreground-400"}`}>
                                          {new Date(message.createdAt).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <p className="text-xs text-foreground-400">No provider messages for this visit yet.</p>
                            )}
                          </div>
                          <Textarea
                            label="Message to Provider"
                            value={messageDrafts[visit.masterId] || ""}
                            onValueChange={(value) =>
                              setMessageDrafts((prev) => ({ ...prev, [visit.masterId]: value }))
                            }
                            placeholder="Type message for Beluga doctor..."
                          />
                          <Button
                            className="bg-teal-600 text-white"
                            onPress={() => handleSendMessage(visit.masterId, false)}
                            isDisabled={!messageDrafts[visit.masterId]?.trim()}
                          >
                            Send Patient Message
                          </Button>
                        </div>

                        <div className="rounded-xl bg-content2 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground-700">Customer Service Chat</h4>
                            <span className="text-[11px] text-foreground-500">customer_service</span>
                          </div>
                          <div className="max-h-72 overflow-y-auto space-y-2 rounded-lg bg-content1 p-3">
                            {chatLoadingByMaster[visit.masterId] ? (
                              <p className="text-xs text-foreground-400">Loading customer service conversation...</p>
                            ) : (chatMessagesByMaster[visit.masterId] || []).filter((message) => message.channel === "customer_service").length > 0 ? (
                              (chatMessagesByMaster[visit.masterId] || [])
                                .filter((message) => message.channel === "customer_service")
                                .map((message) => {
                                  const outbound = isOutboundMessage(message);
                                  return (
                                    <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${outbound ? "bg-teal-600 text-white" : "bg-content2 text-foreground-700"}`}>
                                        <p className={`text-[11px] font-semibold ${outbound ? "text-white/90" : "text-foreground-500"}`}>
                                          {getSenderLabel(message)}
                                        </p>
                                        <p className={`text-sm ${outbound ? "text-white" : "text-foreground-700"}`}>
                                          {message.message || "(no text)"}
                                        </p>
                                        <p className={`text-[11px] mt-1 ${outbound ? "text-white/80" : "text-foreground-400"}`}>
                                          {new Date(message.createdAt).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <p className="text-xs text-foreground-400">No CS messages for this visit yet.</p>
                            )}
                          </div>
                          <Textarea
                            label="Message to Customer Service"
                            value={csDrafts[visit.masterId] || ""}
                            onValueChange={(value) =>
                              setCsDrafts((prev) => ({ ...prev, [visit.masterId]: value }))
                            }
                            placeholder="Type message for Beluga admin..."
                          />
                          <Button
                            variant="flat"
                            onPress={() => handleSendMessage(visit.masterId, true)}
                            isDisabled={!csDrafts[visit.masterId]?.trim()}
                          >
                            Send CS Message
                          </Button>
                        </div>
                      </div>
                      {messageResults[visit.masterId] && (
                        <p className="text-sm text-foreground-500">{messageResults[visit.masterId]}</p>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "account" && (
              <div className="max-w-4xl mx-auto space-y-4">
                <Card>
                  <CardBody className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Beluga Account</h2>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-content2">
                        <Avatar
                          name={user?.firstName || user?.email || 'User'}
                          size="lg"
                          fallback={<span className="text-2xl">{getAvatarEmoji(user)}</span>}
                        />
                        <div>
                          <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                          <p className="text-sm text-foreground-500">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <h3 className="font-semibold mb-2">Update Name in Beluga</h3>
                    <div className="mb-3">
                      <label className="block text-sm mb-1 text-foreground-500">Visit (masterId)</label>
                      <select
                        className="w-full rounded-md border border-default-200 bg-content1 px-3 py-2 text-sm"
                        value={selectedMasterId}
                        onChange={(e) => setSelectedMasterId(e.target.value)}
                      >
                        <option value="">Select a visit</option>
                        {visits.map((visit) => (
                          <option key={`master-${visit.masterId}`} value={visit.masterId}>
                            {visit.formObj?.patientPreference?.map(p => p.name).filter(Boolean).join(", ") || visit.masterId}
                            {visit.orderCreatedAt ? ` (${new Date(visit.orderCreatedAt).toLocaleDateString()})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <Input label="First Name" value={nameFirst} onValueChange={setNameFirst} />
                      <Input label="Last Name" value={nameLast} onValueChange={setNameLast} />
                    </div>
                    <Button
                      className="bg-teal-600 text-white"
                      onPress={handleNameUpdate}
                      isDisabled={!selectedMasterId || !nameFirst.trim() || !nameLast.trim()}
                    >
                      Send Name Update to Beluga
                    </Button>
                    {accountResult && <p className="text-sm text-foreground-500 mt-3">{accountResult}</p>}
                  </CardBody>
                </Card>
              </div>
            )}
          </motion.main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden flex items-center justify-around border-t border-content3 bg-content1 h-16">
            {navItems.map((item) => (
              <Button
                key={item.id}
                isIconOnly
                variant="light"
                className={activeTab === item.id ? "text-teal-500" : "text-foreground-500"}
                onPress={() => setActiveTab(item.id)}
                aria-label={item.label}
              >
                <Icon icon={item.icon} className="text-xl" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function BelugaDashboardRoute() {
  return <BelugaDashboardPage />;
}
