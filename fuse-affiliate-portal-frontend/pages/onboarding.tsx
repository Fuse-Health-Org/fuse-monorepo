import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardBody, CardHeader, Button, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";
import Head from "next/head";

export default function Onboarding() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
    
    if (user) {
      // Pre-fill with existing data if available
      if (user.firstName && user.firstName !== user.email?.split("@")[0]) {
        setFirstName(user.firstName);
      }
      if (user.lastName) {
        setLastName(user.lastName);
      }
      if (user.website) {
        setSlug(user.website);
      }
    }
  }, [user, authLoading, router]);

  const validateSlug = (value: string): boolean => {
    // Slug should be lowercase, alphanumeric, and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!value) {
      setSlugError("Slug is required");
      return false;
    }
    if (value.length < 3) {
      setSlugError("Slug must be at least 3 characters");
      return false;
    }
    if (value.length > 50) {
      setSlugError("Slug cannot exceed 50 characters");
      return false;
    }
    if (!slugRegex.test(value)) {
      setSlugError("Slug can only contain lowercase letters, numbers, and hyphens");
      return false;
    }
    setSlugError(null);
    return true;
  };

  const handleSlugChange = (value: string) => {
    const lowerValue = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(lowerValue);
    if (lowerValue) {
      validateSlug(lowerValue);
    } else {
      setSlugError(null);
    }
  };

  const validatePassword = (): boolean => {
    setPasswordError(null);
    
    if (!currentPassword.trim()) {
      setPasswordError("Current password is required");
      return false;
    }
    
    if (!newPassword.trim()) {
      setPasswordError("New password is required");
      return false;
    }
    
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    if (!validateSlug(slug)) {
      return;
    }

    if (!validatePassword()) {
      return;
    }

    setSaving(true);

    try {
      // Update user data and slug (website)
      // Combine firstName and lastName for the name field
      const fullName = lastName.trim() 
        ? `${firstName.trim()} ${lastName.trim()}`
        : firstName.trim();
      
      // Update branding
      const nameResponse = await apiCall("/affiliate/branding", {
        method: "PUT",
        body: JSON.stringify({
          name: fullName,
          website: slug.trim(),
        }),
      });

      if (!nameResponse.success) {
        setError(nameResponse.message || nameResponse.error || "Error saving data");
        setSaving(false);
        return;
      }

      // Update password
      const passwordResponse = await apiCall("/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      if (!passwordResponse.success) {
        setError(passwordResponse.message || passwordResponse.error || "Error updating password");
        setSaving(false);
        return;
      }

      // Refresh user data to get updated information
      await refreshUser();
      // Redirect to dashboard (it will check if onboarding is still needed)
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error saving onboarding data:", err);
      setError(err.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Initial Setup - Affiliate Portal</title>
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-col items-start gap-2 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon icon="mdi:account-plus" className="text-2xl text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Welcome to Fuse Affiliate Portal
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete your profile to get started
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <Input
                    label="First Name"
                    placeholder="e.g., Check"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    variant="bordered"
                    classNames={{
                      label: "text-foreground",
                      input: "text-foreground",
                    }}
                    description="Your first name"
                    startContent={
                      <Icon icon="mdi:account" className="text-default-400" />
                    }
                  />

                  <Input
                    label="Last Name"
                    placeholder="e.g., Two"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    variant="bordered"
                    classNames={{
                      label: "text-foreground",
                      input: "text-foreground",
                    }}
                    description="Your last name (optional)"
                    startContent={
                      <Icon icon="mdi:account" className="text-default-400" />
                    }
                  />

                  <div>
                    <Input
                      label="Affiliate Slug"
                      placeholder="e.g., checktwo"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      required
                      variant="bordered"
                      errorMessage={slugError || undefined}
                      isInvalid={!!slugError}
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description="Subdomain for your portal (lowercase letters, numbers, and hyphens only)"
                      startContent={
                        <Icon icon="mdi:link-variant" className="text-default-400" />
                      }
                    />
                    {slug && !slugError && (
                      <p className="text-xs text-success mt-1">
                        Your URL will be: <span className="font-mono">{slug}.limitless.health</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-2 border-t border-divider">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter your temporary password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      variant="bordered"
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description="Enter the temporary password you received via email"
                      startContent={
                        <Icon icon="mdi:lock" className="text-default-400" />
                      }
                    />

                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      variant="bordered"
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description="Must be at least 8 characters"
                      startContent={
                        <Icon icon="mdi:lock-outline" className="text-default-400" />
                      }
                    />

                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      variant="bordered"
                      errorMessage={passwordError || undefined}
                      isInvalid={!!passwordError}
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description="Re-enter your new password"
                      startContent={
                        <Icon icon="mdi:lock-check" className="text-default-400" />
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    color="primary"
                    size="lg"
                    className="flex-1"
                    isLoading={saving}
                    disabled={saving || !firstName.trim() || !slug.trim() || !!slugError || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || !!passwordError}
                  >
                    {saving ? "Saving..." : "Continue"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can change this information later in the Branding section
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
