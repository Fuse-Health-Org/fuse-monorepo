import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { AffiliateAnalytics } from "../components/affiliate-analytics";
import Layout from "../components/Layout";
import { Spinner } from "@heroui/react";
import Head from "next/head";

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAffiliate = useMemo(() => {
    if (!user) return false;
    return user.role === "affiliate" || user.userRoles?.affiliate === true;
  }, [user]);

  // Check if user needs onboarding
  const needsOnboarding = useMemo(() => {
    if (!user || !isAffiliate) return false;

    // Check if clinic is not set up (no clinicId or placeholder slug)
    // Placeholder slugs start with "affiliate-" and are auto-generated during invite
    const hasNoClinic = !user.clinicId;

    // Check if clinic has a placeholder slug (auto-generated during invite)
    const hasPlaceholderSlug = user.clinic?.slug?.startsWith('affiliate-');

    // Check if clinic is not active (not yet configured)
    const isClinicInactive = user.clinic && !user.clinic.isActive;

    // Needs onboarding if clinic is not properly configured
    return hasNoClinic || hasPlaceholderSlug || isClinicInactive;
  }, [user, isAffiliate]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
      return;
    }
    if (!loading && user && !isAffiliate) {
      // User is not an affiliate, redirect to signin with error
      router.push("/signin?error=Access denied. Affiliate role required.");
      return;
    }
    if (!loading && user && isAffiliate && needsOnboarding) {
      router.push("/onboarding");
      return;
    }
  }, [user, loading, isAffiliate, needsOnboarding, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !isAffiliate) {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>Analytics - Fuse Affiliate Portal</title>
      </Head>
      <div className="max-w-7xl mx-auto">
        <AffiliateAnalytics />
      </div>
    </Layout>
  );
}

