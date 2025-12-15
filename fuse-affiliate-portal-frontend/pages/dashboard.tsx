import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { AffiliateDashboard } from "../components/affiliate-dashboard";
import Layout from "../components/Layout";
import { Spinner } from "@heroui/react";
import Head from "next/head";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAffiliate = useMemo(() => {
    if (!user) return false;
    return user.role === "affiliate" || user.userRoles?.affiliate === true;
  }, [user]);

  // Check if user needs onboarding
  const needsOnboarding = useMemo(() => {
    if (!user || !isAffiliate) return false;
    
    // Check if firstName is just the email prefix (auto-generated during invite)
    const emailPrefix = user.email?.split("@")[0] || "";
    const firstNameMatchesEmailPrefix = user.firstName === emailPrefix;
    
    // Check if website/slug is missing
    const hasNoWebsite = !user.website || user.website.trim() === "";
    
    // Needs onboarding if firstName is auto-generated OR website is missing
    return firstNameMatchesEmailPrefix || hasNoWebsite;
  }, [user, isAffiliate]);

  useEffect(() => {
    console.log('📊 Dashboard - State:', { 
      loading, 
      user: user ? { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        userRoles: user.userRoles,
        firstName: user.firstName,
        website: user.website
      } : null, 
      isAffiliate,
      needsOnboarding
    });
    
    if (!loading && !user) {
      console.log('❌ No user, redirecting to signin');
      router.push("/signin");
      return;
    }
    if (!loading && user && !isAffiliate) {
      console.log('❌ User is not an affiliate, redirecting to signin');
      // User is not an affiliate, redirect to signin with error
      router.push("/signin?error=Access denied. Affiliate role required.");
      return;
    }
    if (!loading && user && isAffiliate && needsOnboarding) {
      console.log('🔄 User needs onboarding, redirecting to onboarding');
      router.push("/onboarding");
      return;
    }
    if (!loading && user && isAffiliate && !needsOnboarding) {
      console.log('✅ User is affiliate and completed onboarding, showing dashboard');
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
        <title>Affiliate Dashboard</title>
      </Head>
      <div className="max-w-7xl mx-auto">
        <AffiliateDashboard />
      </div>
    </Layout>
  );
}

