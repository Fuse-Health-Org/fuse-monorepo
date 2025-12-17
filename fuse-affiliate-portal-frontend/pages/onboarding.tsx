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

  // Form fields - Personal Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");

  // Form fields - Clinic Info
  const [clinicName, setClinicName] = useState("");
  const [clinicNameError, setClinicNameError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

  // Form fields - Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
  }, [user, authLoading, router]);

  const validateClinicName = (value: string): boolean => {
    if (!value || !value.trim()) {
      setClinicNameError("Clinic name is required");
      return false;
    }
    if (value.trim().length < 2) {
      setClinicNameError("Clinic name must be at least 2 characters");
      return false;
    }
    setClinicNameError(null);
    return true;
  };

  const handleClinicNameChange = (value: string) => {
    setClinicName(value);
    if (value.trim()) {
      validateClinicName(value);
    } else {
      setClinicNameError(null);
    }
  };

  const validateSlug = (value: string): boolean => {
    // Slug should be lowercase, alphanumeric, and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!value) {
      setSlugError("Portal URL slug is required");
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

  const generateSlugFromClinicName = () => {
    if (!clinicName.trim()) {
      setClinicNameError("Enter a clinic name first");
      return;
    }
    // Convert clinic name to slug: lowercase, replace spaces with hyphens, remove special chars
    const generatedSlug = clinicName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, "") // Remove special characters
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

    setSlug(generatedSlug);
    validateSlug(generatedSlug);
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
    setClinicNameError(null);
    setSlugError(null);

    // Validate personal info
    if (!firstName.trim() || firstName.trim().length < 2) {
      setError("First name is required (minimum 2 characters)");
      return;
    }

    if (!lastName.trim() || lastName.trim().length < 2) {
      setError("Last name is required (minimum 2 characters)");
      return;
    }

    // Validate clinic info with inline errors
    let hasClinicErrors = false;

    if (!validateClinicName(clinicName)) {
      hasClinicErrors = true;
    }

    if (!validateSlug(slug)) {
      hasClinicErrors = true;
    }

    if (hasClinicErrors) {
      return;
    }

    if (!validatePassword()) {
      return;
    }

    setSaving(true);

    try {
      // Setup affiliate clinic with name, slug, and personal info
      const clinicResponse = await apiCall("/affiliate/setup-clinic", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          website: website.trim() || undefined,
          clinicName: clinicName.trim(),
          slug: slug.trim(),
        }),
      });

      if (!clinicResponse.success) {
        // Check if the error is about slug being taken
        const errorMessage = clinicResponse.error || "Error setting up clinic";
        if (errorMessage.toLowerCase().includes("slug") && errorMessage.toLowerCase().includes("taken")) {
          setSlugError("This slug is already taken. Please choose a different one.");
        } else {
          setError(errorMessage);
        }
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
        setError(passwordResponse.error || "Error updating password");
        setSaving(false);
        return;
      }

      // Refresh user data to get updated information
      await refreshUser();
      // Redirect to branding page to continue customization
      router.push("/branding");
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
                  <Icon icon="mdi:store" className="text-2xl text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Set Up Your Affiliate Portal
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your clinic to get started
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
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-foreground">Personal Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        placeholder="e.g., John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        variant="bordered"
                        classNames={{
                          label: "text-foreground",
                          input: "text-foreground",
                        }}
                        startContent={
                          <Icon icon="mdi:account" className="text-default-400" />
                        }
                      />

                      <Input
                        label="Last Name"
                        placeholder="e.g., Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        variant="bordered"
                        classNames={{
                          label: "text-foreground",
                          input: "text-foreground",
                        }}
                        startContent={
                          <Icon icon="mdi:account" className="text-default-400" />
                        }
                      />
                    </div>

                    <Input
                      label="Website (optional)"
                      placeholder="e.g., https://mywebsite.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      variant="bordered"
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description="Your personal or business website"
                      startContent={
                        <Icon icon="mdi:web" className="text-default-400" />
                      }
                    />
                  </div>

                  {/* Clinic Information Section */}
                  <div className="space-y-4 pt-4 border-t border-divider">
                    <h3 className="text-sm font-medium text-foreground">Clinic Information</h3>

                    <Input
                      label="Clinic Name"
                      placeholder="e.g., My Health Clinic"
                      value={clinicName}
                      onChange={(e) => handleClinicNameChange(e.target.value)}
                      onBlur={() => validateClinicName(clinicName)}
                      required
                      variant="bordered"
                      errorMessage={clinicNameError || undefined}
                      isInvalid={!!clinicNameError}
                      classNames={{
                        label: "text-foreground",
                        input: "text-foreground",
                      }}
                      description={!clinicNameError ? "Your clinic's display name" : undefined}
                      startContent={
                        <Icon icon="mdi:store" className="text-default-400" />
                      }
                    />

                    <div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            label="Portal URL Slug"
                            placeholder="e.g., my-health-clinic"
                            value={slug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            onBlur={() => slug && validateSlug(slug)}
                            required
                            variant="bordered"
                            errorMessage={slugError || undefined}
                            isInvalid={!!slugError}
                            classNames={{
                              label: "text-foreground",
                              input: "text-foreground",
                            }}
                            description={!slugError ? "Subdomain for your portal (lowercase letters, numbers, and hyphens only)" : undefined}
                            startContent={
                              <Icon icon="mdi:link-variant" className="text-default-400" />
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="bordered"
                          onPress={generateSlugFromClinicName}
                          isDisabled={!clinicName.trim()}
                          size="lg"
                          className="mb-[27px]"
                        >
                          <Icon icon="mdi:auto-fix" className="text-lg" />
                          Auto
                        </Button>
                      </div>
                      {slug && !slugError && user?.clinic?.parentClinicSlug && (
                        <p className="text-xs text-success mt-1">
                          Your URL will be: <span className="font-mono">{slug}.{user.clinic.parentClinicSlug}.fusehealth.com</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-divider">
                    <h3 className="text-sm font-medium text-foreground">Change Your Password</h3>

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
                    disabled={saving || !firstName.trim() || !lastName.trim() || !clinicName.trim() || !slug.trim() || !!slugError || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || !!passwordError}
                  >
                    {saving ? "Setting Up..." : "Continue to Portal Customization"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can customize your portal appearance in the next step
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
