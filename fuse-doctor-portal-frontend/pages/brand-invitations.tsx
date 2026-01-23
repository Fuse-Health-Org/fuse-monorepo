import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Link2,
  Copy,
  Plus,
  Calendar,
  ExternalLink,
  UserPlus,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BrandInvitation {
  id: string;
  invitationSlug: string;
  invitationType: "doctor" | "mdi";
  invitationUrl: string;
  patientPortalDashboardFormat: "fuse" | "md-integrations";
  isActive: boolean;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
  clinic: {
    id: string;
    name: string;
    slug: string;
    logo: string;
  } | null;
}

export default function BrandInvitationsPage() {
  const { authenticatedFetch, user } = useAuth();
  const router = useRouter();
  const [invitations, setInvitations] = useState<BrandInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInvitationSlug, setNewInvitationSlug] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user is doctor
  const isDoctor = user?.role === "doctor" || (user as any)?.userRoles?.doctor;

  useEffect(() => {
    if (!isDoctor) {
      router.push("/");
      return;
    }
    loadInvitations();
  }, [isDoctor, router]);

  const loadInvitations = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/brand-invitations`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvitations(data.data.invitations);
        }
      }
    } catch (err) {
      console.error("Error loading invitations:", err);
      setError("Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`${API_URL}/brand-invitations/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invitationType: "doctor",
          invitationSlug: newInvitationSlug || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess("Invitation link created successfully!");
          setShowCreateForm(false);
          setNewInvitationSlug("");
          setExpiresAt("");
          loadInvitations();
          setTimeout(() => setSuccess(null), 3000);
        } else {
          setError(data.message || "Failed to create invitation");
        }
      } else {
        const data = await response.json();
        setError(data.message || "Failed to create invitation");
      }
    } catch (err) {
      console.error("Error creating invitation:", err);
      setError("Failed to create invitation");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setSuccess("Link copied to clipboard!");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleToggleActive = async (invitation: BrandInvitation) => {
    try {
      const response = await authenticatedFetch(
        `${API_URL}/brand-invitations/${invitation.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !invitation.isActive,
          }),
        }
      );

      if (response.ok) {
        setSuccess(`Invitation ${!invitation.isActive ? "activated" : "deactivated"}`);
        loadInvitations();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to update invitation");
      }
    } catch (err) {
      console.error("Error updating invitation:", err);
      setError("Failed to update invitation");
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isDoctor) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fuse Invitations</h1>
              <p className="text-muted-foreground mt-1">
                Create and manage invitation links for brands to join your practice
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invitation
            </Button>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create Fuse Invitation Link</CardTitle>
                <CardDescription>
                  Create a special link that brands can use to sign up and automatically connect to your practice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Custom Slug (optional)
                  </label>
                  <Input
                    placeholder='Defaults to "fuse"'
                    value={newInvitationSlug}
                    onChange={(e) => setNewInvitationSlug(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use "fuse" as the default slug
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Expiration Date (optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateInvitation} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Invitation"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewInvitationSlug("");
                      setExpiresAt("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invitations List */}
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading invitations...</p>
              </CardContent>
            </Card>
          ) : invitations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invitations created yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create Your First Invitation
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="default">Doctor</Badge>
                          <Badge variant={invitation.isActive ? "default" : "secondary"}>
                            {invitation.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {invitation.expiresAt && (
                            <Badge variant={isExpired(invitation.expiresAt) ? "destructive" : "outline"}>
                              {isExpired(invitation.expiresAt) ? "Expired" : "Expires"}
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {invitation.patientPortalDashboardFormat === "md-integrations"
                              ? "MD Integrations"
                              : "Fuse"}
                          </Badge>
                        </div>

                        {invitation.clinic && (
                          <div>
                            <span className="text-sm text-muted-foreground">Clinic: </span>
                            <span className="text-sm font-medium">{invitation.clinic.name}</span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Invitation URL:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={invitation.invitationUrl}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(invitation.invitationUrl)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(invitation.invitationUrl, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Usage Count:</span>
                            <p className="font-medium">{invitation.usageCount}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <p className="font-medium">
                              {new Date(invitation.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {invitation.expiresAt && (
                            <div>
                              <span className="text-muted-foreground">Expires:</span>
                              <p className="font-medium">
                                {new Date(invitation.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={invitation.isActive}
                            onCheckedChange={() => handleToggleActive(invitation)}
                          />
                          <span className="text-sm">
                            {invitation.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
