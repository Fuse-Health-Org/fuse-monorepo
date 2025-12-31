import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { extractClinicSlugFromDomain } from '../lib/clinic-utils';
import { apiCall } from '../lib/api';
import ScrollingFeaturesBar from '../components/ScrollingFeaturesBar';
import GetStartedButton from '../components/GetStartedButton';
import { useBatchLikes } from '../hooks/useLikes';

interface CustomWebsite {
  portalTitle?: string;
  portalDescription?: string;
  primaryColor?: string;
  fontFamily?: string;
  logo?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  isActive?: boolean;
}

interface ClinicInfo {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  isAffiliate?: boolean;
  parentClinicLogo?: string;
  parentClinicName?: string;
  parentClinicHeroImageUrl?: string;
}

interface Product {
  id: string;
  tenantProductId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  categories?: string[];
  price: number;
  wholesalePrice?: number;
  slug?: string;
  formId?: string;
}

interface Program {
  id: string;
  name: string;
  description?: string;
  medicalTemplateId?: string;
  medicalTemplate?: {
    id: string;
    title: string;
    description?: string;
  };
  isActive: boolean;
}

// Union type for carousel items
type CarouselItem =
  | { type: 'product'; data: Product }
  | { type: 'program'; data: Program };

export default function LandingPage() {
  const router = useRouter();
  const [customWebsite, setCustomWebsite] = useState<CustomWebsite | null>(null);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<string | null>(null);

  // Extract tenant product IDs for batch likes
  const tenantProductIds = useMemo(() =>
    products.map(p => p.tenantProductId).filter((id): id is string => !!id),
    [products]
  );

  // Fetch likes for all products
  const { likeCounts, userLikes, toggle: toggleLike } = useBatchLikes(tenantProductIds);

  useEffect(() => {
    const loadCustomWebsite = async () => {
      try {
        const domainInfo = await extractClinicSlugFromDomain();
        console.log('🔍 Domain info:', domainInfo);

        let websiteData: CustomWebsite | null = null;

        // Try to load custom website if we have a clinic slug
        // For affiliates, fetch the affiliate's custom website (affiliateSlug), not the brand's (clinicSlug)
        const slugToFetch = domainInfo.affiliateSlug || domainInfo.clinicSlug;
        if (domainInfo.hasClinicSubdomain && slugToFetch) {
          console.log('🌐 Fetching custom website for slug:', slugToFetch, domainInfo.affiliateSlug ? '(affiliate)' : '(brand)');
          const result = await apiCall(`/custom-website/by-slug/${slugToFetch}`);
          console.log('✅ Custom website data:', result);

          // Extract clinic info from response (check both nested and top-level locations)
          const clinicData = result.data?.clinic || (result as any).clinic;
          if (clinicData) {
            console.log('🏥 Clinic info:', clinicData);
            setClinicInfo(clinicData);
          }

          if (result.success && result.data?.data) {
            // API returns { success, data: { data: {...}, clinic: {...} } }
            websiteData = result.data.data;
          } else if (result.success && result.data) {
            websiteData = result.data;
          }
        } else {
          // For localhost testing: fetch the default/first available custom website
          console.log('🏠 No clinic subdomain detected, loading default custom website for testing...');
          try {
            const result = await apiCall('/custom-website/default');
            console.log('✅ Loaded default custom website:', result);
            if (result.success && result.data?.data) {
              // API returns { success, data: { data: {...} } }
              websiteData = result.data.data;
            } else if (result.success && result.data) {
              websiteData = result.data;
            }
          } catch (error) {
            console.log('ℹ️ No custom website found');
          }
        }

        // Check if custom website is active - if not, redirect to dashboard
        if (!websiteData || websiteData.isActive === false) {
          console.log('🔀 Custom website is not active, redirecting to dashboard...');
          setIsRedirecting(true);
          router.replace('/dashboard');
          return; // Don't set isLoading to false - keep showing nothing while redirecting
        }

        setCustomWebsite(websiteData);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Error loading custom website:', error);
        setIsLoading(false);
      }
    };

    loadCustomWebsite();
  }, [router]);

  // Fetch products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const domainInfo = await extractClinicSlugFromDomain();

        // Build endpoint with affiliate slug if present
        let endpoint = domainInfo.hasClinicSubdomain && domainInfo.clinicSlug
          ? `/public/products/${domainInfo.clinicSlug}`
          : `/public/products`;

        // Add affiliateSlug as query parameter if present
        if (domainInfo.affiliateSlug) {
          endpoint += `?affiliateSlug=${encodeURIComponent(domainInfo.affiliateSlug)}`;
        }

        console.log('🛍️ Fetching products from:', endpoint);
        const result = await apiCall(endpoint);

        if (result.success && result.data?.data) {
          setProducts(result.data.data);
        } else if (result.success && result.data) {
          setProducts(result.data);
        }
        console.log('✅ Loaded products:', result);
      } catch (error) {
        console.error('❌ Error loading products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Load programs for the clinic/affiliate
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        setProgramsLoading(true);
        const domainInfo = await extractClinicSlugFromDomain();

        if (!domainInfo.clinicSlug) {
          console.log('ℹ️ No clinic slug found, skipping programs load');
          setPrograms([]);
          return;
        }

        // Build the API URL with affiliate slug if present
        let apiUrl = `/public/programs/by-clinic/${domainInfo.clinicSlug}`;
        if (domainInfo.affiliateSlug) {
          apiUrl += `?affiliateSlug=${encodeURIComponent(domainInfo.affiliateSlug)}`;
        }

        console.log('📋 Fetching programs:', apiUrl);
        const result = await apiCall(apiUrl);
        console.log('📋 Programs response:', result);

        // Handle nested data structure
        let programsData = result.data;
        if (result.data?.data) {
          programsData = result.data.data;
        }

        console.log('📋 Programs data:', programsData);

        if (Array.isArray(programsData)) {
          setPrograms(programsData);
        } else {
          console.error('❌ Programs data is not an array:', programsData);
          setPrograms([]);
        }
      } catch (error) {
        console.error('❌ Error loading programs:', error);
        setPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    };

    loadPrograms();
  }, []);

  // No longer using JS-based scroll - using CSS animation instead

  // Handle nested data structure from API response
  const websiteData = (customWebsite as any)?.data || customWebsite;

  // Hero image logic for affiliates: fallback to parent's hero image if affiliate has none
  const affiliateHeroImageUrl = websiteData?.heroImageUrl;
  const parentHeroImageUrl = clinicInfo?.parentClinicHeroImageUrl;
  const heroImageUrl = affiliateHeroImageUrl || parentHeroImageUrl || "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80";

  const heroTitle = websiteData?.heroTitle || "Your Daily Health, Simplified";
  const heroSubtitle = websiteData?.heroSubtitle || "All-in-one nutritional support in one simple drink";
  const primaryColor = websiteData?.primaryColor || "#004d4d";
  const fontFamily = websiteData?.fontFamily || "Georgia, serif";

  // Logo logic for affiliates:
  // - If affiliate has no logo: show parent logo only
  // - If affiliate has logo: show "Parent Logo × Affiliate Logo"
  const affiliateLogo = websiteData?.logo;
  const parentLogo = clinicInfo?.parentClinicLogo;
  const isAffiliate = clinicInfo?.isAffiliate;
  const logo = affiliateLogo || parentLogo; // Fallback to parent logo if affiliate has none

  // Helper function to render a product card
  const renderProductCard = (product: Product, index: number) => {
    const badges = getBadges(product);
    // Calculate 30% higher price for crossed out display
    const crossedOutPrice = (product.price * 1.3).toFixed(2);

    // Alternate rectangle colors: green, green, brown, brown, repeat
    const rectangleColors = ["#004d4d", "#004d4d", "#8b7355", "#8b7355"];
    const rectangleColor = rectangleColors[index % 4];

    const cardId = `product-${product.id}-${index}`;
    const isHovered = hoveredCardIndex === cardId;

    // Get like status for this product
    const tenantProductId = product.tenantProductId;
    const isLiked = tenantProductId && userLikes ? userLikes[tenantProductId] || false : false;
    const likeCount = tenantProductId && likeCounts ? likeCounts[tenantProductId] || 0 : 0;

    const handleLikeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (tenantProductId) {
        toggleLike(tenantProductId);
      }
    };

    return (
      <div
        key={product.id}
        onMouseEnter={() => setHoveredCardIndex(cardId)}
        onMouseLeave={() => setHoveredCardIndex(null)}
        style={{
          cursor: "pointer",
          position: "relative",
          transform: isHovered ? "scale(1.05)" : "scale(1)",
          transition: "transform 0.3s ease",
        }}
      >
        <button
          onClick={handleLikeClick}
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            background: isLiked ? "#fee2e2" : "white",
            border: isLiked ? "1px solid #fca5a5" : "1px solid #e2e8f0",
            borderRadius: "50%",
            width: "2.5rem",
            height: "2.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 1,
            transition: "all 0.2s ease",
          }}
          title={isLiked ? "Unlike" : "Like"}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isLiked ? "#ef4444" : "none"}
            stroke={isLiked ? "#ef4444" : "currentColor"}
            strokeWidth="2"
            style={{ transition: "all 0.2s ease" }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <div
          style={{
            backgroundColor: "#e8e6e1",
            borderRadius: "0.5rem",
            padding: "2rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "1/1",
            overflow: "hidden",
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: isHovered ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.3s ease",
              }}
            />
          ) : (
            <div
              style={{
                width: "8rem",
                height: "12rem",
                backgroundColor: rectangleColor,
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: isHovered ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.3s ease",
              }}
            >
              <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.25rem", textAlign: "center", padding: "1rem" }}>
                {product.name.substring(0, 30)}
              </span>
            </div>
          )}
        </div>
        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.25rem",
          marginBottom: "0.5rem",
          fontWeight: 400,
          color: isHovered ? "#38bdf8" : "inherit",
          transition: "color 0.3s ease",
        }}>
          {product.name}
        </h3>
        <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem", minHeight: "2.5rem" }}>
          {product.description || "Premium health product"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span style={{ fontWeight: 600 }}>From ${product.price.toFixed(2)}/mo</span>
          <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>
            ${crossedOutPrice}*
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {badges.map((badge, idx) => (
            <span
              key={idx}
              style={{
                backgroundColor: badge.color,
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <GetStartedButton
          formId={product.formId}
          slug={product.slug}
          primaryColor={primaryColor}
        />
      </div>
    );
  };

  // Helper function to get badges based on product category/categories
  const getBadges = (product: Product) => {
    const categories = product.categories || [product.category] || [];
    const badgeMap: { [key: string]: { label: string; color: string } } = {
      'weightloss': { label: 'Weight Loss', color: '#ef4444' },
      'weight-loss': { label: 'Weight Loss', color: '#ef4444' },
      'hairgrowth': { label: 'Hair Growth', color: '#8b5cf6' },
      'hair-growth': { label: 'Hair Growth', color: '#8b5cf6' },
      'performance': { label: 'Muscle Growth', color: '#3b82f6' },
      'recovery': { label: 'Recovery', color: '#10b981' },
      'flexibility': { label: 'Flexibility', color: '#a855f7' },
      'sexual-health': { label: 'Sexual Health', color: '#ec4899' },
      'skincare': { label: 'Better Skin', color: '#f59e0b' },
      'wellness': { label: 'Wellness', color: '#06b6d4' },
      'energy': { label: 'More Energy', color: '#eab308' },
      'sleep': { label: 'Better Sleep', color: '#6366f1' },
    };

    const badges = categories
      .map((cat: string) => {
        const normalized = cat.toLowerCase().replace(/\s+/g, '-');
        return badgeMap[normalized];
      })
      .filter(Boolean)
      .slice(0, 2); // Max 2 badges per product

    // Default badges if none found
    if (badges.length === 0) {
      badges.push({ label: 'Wellness', color: '#06b6d4' });
    }

    return badges;
  };

  // Helper function to render a program card (matches product card style)
  const renderProgramCard = (program: Program, index: number) => {
    const cardId = `program-${program.id}-${index}`;
    const isHovered = hoveredCardIndex === cardId;
    const hasTemplate = !!program.medicalTemplateId;

    // Program colors - purple-ish tones to differentiate from products
    const programColors = ["#6366f1", "#8b5cf6", "#7c3aed", "#6d28d9"];
    const cardColor = programColors[index % 4];

    return (
      <div
        key={program.id}
        onClick={() => {
          if (hasTemplate) {
            window.open(`/my-products/${program.id}/program`, '_blank');
          }
        }}
        onMouseEnter={() => setHoveredCardIndex(cardId)}
        onMouseLeave={() => setHoveredCardIndex(null)}
        style={{
          cursor: hasTemplate ? "pointer" : "default",
          position: "relative",
          transform: isHovered ? "scale(1.05)" : "scale(1)",
          transition: "transform 0.3s ease",
        }}
      >
        {/* Program badge - top left */}
        <span style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "white",
          fontSize: "0.625rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.25rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          zIndex: 2,
        }}>
          Program
        </span>
        {/* Heart button like products have */}
        <button style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "50%",
          width: "2.5rem",
          height: "2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <div
          style={{
            backgroundColor: "#e8e6e1",
            borderRadius: "0.5rem",
            padding: "2rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "1/1",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "8rem",
              height: "12rem",
              background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%)`,
              borderRadius: "0.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: isHovered ? "scale(1.15)" : "scale(1)",
              transition: "transform 0.3s ease",
            }}
          >
            {/* Stethoscope icon */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              style={{ marginBottom: "0.5rem" }}
            >
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
            <span style={{
              fontFamily: "Georgia, serif",
              color: "white",
              fontSize: "0.875rem",
              textAlign: "center",
              padding: "0 0.5rem",
              lineHeight: 1.3,
            }}>
              {program.name.length > 30 ? program.name.substring(0, 30) + '...' : program.name}
            </span>
          </div>
        </div>
        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.25rem",
          marginBottom: "0.5rem",
          fontWeight: 400,
          color: isHovered ? "#6366f1" : "inherit",
          transition: "color 0.3s ease",
        }}>
          {program.name}
        </h3>
        <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem", minHeight: "2.5rem" }}>
          {program.description || program.medicalTemplate?.title || "Comprehensive health program"}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span
            style={{
              backgroundColor: "#6366f1",
              color: "white",
              padding: "0.25rem 0.75rem",
              borderRadius: "1rem",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Health Program
          </span>
        </div>
        {hasTemplate ? (
          <a
            href={`/my-products/${program.id}/program`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
              backgroundColor: primaryColor,
              color: "white",
              cursor: "pointer",
              border: "none",
            }}
          >
            Get Started
          </a>
        ) : (
          <button
            disabled
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              backgroundColor: "#9ca3af",
              color: "white",
              cursor: "not-allowed",
              border: "none",
            }}
          >
            Coming Soon
          </button>
        )}
      </div>
    );
  };

  // Combine programs and products into carousel items
  // Programs appear first, then products
  const carouselItems: CarouselItem[] = [
    ...programs.map((program): CarouselItem => ({ type: 'program', data: program })),
    ...products.slice(0, 6).map((product): CarouselItem => ({ type: 'product', data: product })),
  ];

  const isCarouselLoading = productsLoading || programsLoading;

  console.log('🎨 Rendering with values:', {
    heroImageUrl,
    heroTitle,
    heroSubtitle,
    primaryColor,
    fontFamily,
    logo,
    customWebsite
  });

  // Show nothing while redirecting (prevents flash of content)
  if (isRedirecting) {
    return null;
  }

  // Show loading skeleton while fetching custom website
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f3ef", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Header Skeleton */}
        <header style={{ borderBottom: "1px solid #e5e5e5", backgroundColor: "white" }}>
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "3rem" }}>
              <div style={{ width: "120px", height: "32px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
              <div style={{ display: "flex", gap: "2rem" }}>
                <div style={{ width: "100px", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                <div style={{ width: "80px", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                <div style={{ width: "90px", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: "100px", height: "36px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
              <div style={{ width: "32px", height: "32px", backgroundColor: "#e0e0e0", borderRadius: "50%" }}></div>
            </div>
          </div>
        </header>

        {/* Hero Skeleton */}
        <div
          style={{
            height: "100vh",
            width: "100%",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#e8e6e1"
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 10,
              textAlign: "center",
              maxWidth: "800px",
              padding: "0 2rem"
            }}
          >
            <div style={{ width: "600px", height: "64px", backgroundColor: "#d0d0d0", borderRadius: "8px", margin: "0 auto 1.5rem" }}></div>
            <div style={{ width: "400px", height: "24px", backgroundColor: "#d0d0d0", borderRadius: "8px", margin: "0 auto 2rem" }}></div>
            <div style={{ width: "180px", height: "56px", backgroundColor: "#d0d0d0", borderRadius: "4px", margin: "0 auto" }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f3ef", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #e5e5e5", backgroundColor: "white" }}>
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "3rem" }}>
            {/* Logo display: Parent × Affiliate if both exist, otherwise just one */}
            {isAffiliate && parentLogo && affiliateLogo ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <img src={parentLogo} alt="Brand Logo" style={{ height: "2rem", objectFit: "contain" }} />
                <span style={{ color: "#9ca3af", fontSize: "1.25rem", fontWeight: 300 }}>×</span>
                <img src={affiliateLogo} alt="Affiliate Logo" style={{ height: "2rem", objectFit: "contain" }} />
              </div>
            ) : logo ? (
              <img src={logo} alt="Logo" style={{ height: "2rem", objectFit: "contain" }} />
            ) : (
              <h1 style={{ fontFamily: fontFamily, fontSize: "1.875rem", fontWeight: 400 }}>AG1</h1>
            )}
            <nav style={{ display: "flex", alignItems: "center", gap: "2rem", fontSize: "0.875rem" }}>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
                AG1 for Daily Health
              </a>
              <a
                href="#"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                AG2 for Rest
                <span
                  style={{
                    backgroundColor: "#10b981",
                    color: "white",
                    fontSize: "0.75rem",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  NEW
                </span>
              </a>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>
                Learn More
              </a>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              style={{
                backgroundColor: primaryColor,
                color: "white",
                padding: "0.5rem 1.5rem",
                border: "none",
                borderRadius: "0.125rem",
                cursor: "pointer",
              }}
            >
              Shop All
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              style={{ padding: "0.5rem", border: "none", background: "none", cursor: "pointer" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div
        style={{
          height: "100vh",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e8e6e1"
        }}
      >
        <img
          src={heroImageUrl}
          alt="Hero"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            top: 0,
            left: 0
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            color: "white",
            maxWidth: "800px",
            padding: "0 2rem"
          }}
        >
          <h1 style={{
            fontSize: "4rem",
            fontWeight: 700,
            marginBottom: "1.5rem",
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            fontFamily: fontFamily
          }}>
            {heroTitle}
          </h1>
          <p style={{
            fontSize: "1.5rem",
            marginBottom: "2rem",
            textShadow: "0 2px 10px rgba(0,0,0,0.3)"
          }}>
            {heroSubtitle}
          </p>
          <button
            style={{
              backgroundColor: primaryColor,
              color: "white",
              padding: "1rem 3rem",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontSize: "1.125rem",
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
          >
            Shop Now
          </button>
        </div>
        {/* Scrolling Features Bar - positioned at bottom of hero */}
        <ScrollingFeaturesBar textColor="white" position="absolute" />
      </div>

      {/* Main Content */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Title Section */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#737373", marginBottom: "0.5rem" }}>SHOP</p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "3rem", marginBottom: "0.75rem", fontWeight: 400 }}>
            {programs.length > 0 ? "Trending Programs & Products" : "Trending Products"}
          </h2>
          <p style={{ color: "#404040" }}>
            {programs.length > 0
              ? "Discover our health programs and member favorites here."
              : "AG1 is so much more than greens. Discover our member favorites here."}
          </p>
        </div>
        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "3rem" }}>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#8b7355",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={() => window.location.href = "/bundles"}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Bundles
          </button>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Daily Health
          </button>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",

            }}
          >
            Rest & Restore
          </button>
        </div>
        {/* Programs & Products Carousel */}
        {isCarouselLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>Loading...</p>
          </div>
        ) : carouselItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>No programs or products available at the moment.</p>
          </div>
        ) : (
          <>
            <style jsx global>{`
              @keyframes scrollProducts {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
              .products-carousel {
                display: flex;
                gap: 1.5rem;
                animation: scrollProducts 40s linear infinite;
              }
              .products-carousel:hover {
                animation-play-state: paused;
              }
            `}</style>
            <div
              style={{
                overflow: "hidden",
                marginBottom: "4rem",
                paddingBottom: "1rem",
              }}
            >
              <div className="products-carousel">
                {/* Duplicate items for infinite scroll effect */}
                {[...carouselItems, ...carouselItems].map((item, index) => (
                  <div key={`${item.type}-${item.data.id}-${index}`} style={{ minWidth: "280px", maxWidth: "280px", flexShrink: 0 }}>
                    {item.type === 'program'
                      ? renderProgramCard(item.data, index)
                      : renderProductCard(item.data, index)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {/* Removed hardcoded products - now showing dynamic products from API */}
        <div style={{ display: 'none' }}>
          {/* AG1 Pouch */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AG1</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG1 Pouch
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              All-in-one gut and health support in one Daily Health Drink.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $79/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$99*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Recovery</span>
            </div>
          </div>
          {/* AG1 Travel Packs */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AG1</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG1 Travel Packs
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Plan your Daily Health Dose on-the-go with 30 individual Travel Packs.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $89/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$109*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Recovery</span>
              <span style={{
                backgroundColor: "#a855f7",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Flexibility</span>
            </div>
          </div>
          {/* AGZ */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#8b7355",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AGZ</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AGZ
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Individual Travel Packs, 30 servings. Ease your mind & body into restful sleep without feeling groggy,
              magnesium & adaptogens.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $79/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$99*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Muscle Growth</span>
              <span style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Fat Loss</span>
            </div>
          </div>
          {/* AG2 Variety Pack */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#7c3aed", borderRadius: "0.25rem" }}
                ></div>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#f9a8d4", borderRadius: "0.25rem" }}
                ></div>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#6ee7b7", borderRadius: "0.25rem" }}
                ></div>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG2 Variety Pack (3Pk)
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Ease your mind and body into restful sleep with calming tones, magnesium & adaptogens. Try 10 individual
              packs in Berry, Chocolate, Chocolate Mint.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>$39.99</span>
            </div>
          </div>
          {/* AG Omega3 */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "8rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.5rem" }}>AG</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG Omega3
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Complements AG1 for added brain support with high quality fish oil.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $35/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$59*</span>
            </div>
          </div>
          {/* AG Vitamin D3+K2 */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div style={{ width: "6rem", height: "10rem", backgroundColor: "#004d4d", borderRadius: "0.5rem" }}></div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG Vitamin D3+K2
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Complements AG1 for added immune support with liquid drops.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>$29</span>
            </div>
          </div>
        </div>


        {/* SECOND PART */}

        {/* Title Section */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#737373", marginBottom: "0.5rem" }}>SHOP</p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "3rem", marginBottom: "0.75rem", fontWeight: 400 }}>
            Trending Protocols
          </h2>
          <p style={{ color: "#404040" }}>AG1 is so much more than greens. Discover our member favorites here.</p>
        </div>
        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "3rem" }}>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#8b7355",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={() => window.location.href = "/bundles"}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Bundles
          </button>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Daily Health
          </button>
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "inherit",
              border: "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Rest & Restore
          </button>
        </div>
        {/* Products Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.5rem",
            marginBottom: "4rem",
          }}
        >
          {/* AG1 Pouch */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AG1</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG1 Pouch
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              All-in-one gut and health support in one Daily Health Drink.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $79/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$99*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Recovery</span>
            </div>
          </div>
          {/* AG1 Travel Packs */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AG1</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG1 Travel Packs
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Plan your Daily Health Dose on-the-go with 30 individual Travel Packs.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $89/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$109*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Recovery</span>
              <span style={{
                backgroundColor: "#a855f7",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Flexibility</span>
            </div>
          </div>
          {/* AGZ */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "12rem",
                  backgroundColor: "#8b7355",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>AGZ</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AGZ
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Individual Travel Packs, 30 servings. Ease your mind & body into restful sleep without feeling groggy,
              magnesium & adaptogens.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $79/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$99*</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Muscle Growth</span>
              <span style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}>Fat Loss</span>
            </div>
          </div>
          {/* AG2 Variety Pack */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#7c3aed", borderRadius: "0.25rem" }}
                ></div>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#f9a8d4", borderRadius: "0.25rem" }}
                ></div>
                <div
                  style={{ width: "2.5rem", height: "10rem", backgroundColor: "#6ee7b7", borderRadius: "0.25rem" }}
                ></div>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG2 Variety Pack (3Pk)
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Ease your mind and body into restful sleep with calming tones, magnesium & adaptogens. Try 10 individual
              packs in Berry, Chocolate, Chocolate Mint.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>$39.99</span>
            </div>
          </div>
          {/* AG Omega3 */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div
                style={{
                  width: "8rem",
                  height: "8rem",
                  backgroundColor: "#004d4d",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.5rem" }}>AG</span>
              </div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG Omega3
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Complements AG1 for added brain support with high quality fish oil.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>From $35/mo</span>
              <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>$59*</span>
            </div>
          </div>
          {/* AG Vitamin D3+K2 */}
          <div style={{ cursor: "pointer", position: "relative" }}>
            <button style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "2.5rem",
              height: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              <div style={{ width: "6rem", height: "10rem", backgroundColor: "#004d4d", borderRadius: "0.5rem" }}></div>
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              AG Vitamin D3+K2
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem" }}>
              Complements AG1 for added immune support with liquid drops.*
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>$29</span>
            </div>
          </div>
        </div>

        {/* Show All Products Button */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "4rem" }}>
          <button
            onClick={() => router.push('/all-products')}
            style={{
              backgroundColor: primaryColor,
              color: "white",
              padding: "1rem 3rem",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Show All Products
          </button>
        </div>

      </main>
      {/* Footer */}
      <footer style={{ backgroundColor: "#0d3d3d", color: "white", padding: "4rem 0 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "3rem",
              marginBottom: "3rem",
            }}
          >
            {/* SHOP Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                SHOP
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    All Products
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Gut Health
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Shop Support
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Bundles
                  </a>
                </li>
              </ul>
            </div>
            {/* DAILY HEALTH Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                DAILY HEALTH
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    What is AG1?
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Research
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Quality & Testing
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Benefits
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Ingredients
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Quiz
                  </a>
                </li>
              </ul>
            </div>
            {/* REST & RESTORE Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                REST & RESTORE
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    What is AG2?
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG2 Quality & Testing
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG2 Ingredients
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG2 Recipes
                  </a>
                </li>
              </ul>
            </div>
            {/* LEARN MORE Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                LEARN MORE
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    About Us
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Leadership
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Refer Friends
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Partnerships
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Impact Reports
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Membership
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Accessibility Statement
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    AG1 Reviews
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Blog
                  </a>
                </li>
              </ul>
            </div>
            {/* CONTACT & SUPPORT Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                CONTACT & SUPPORT
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    My Account
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Track Your Order
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Help
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Careers
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    Product Authentication
                  </a>
                </li>
                <li style={{ marginBottom: "0.75rem" }}>
                  <a href="#" style={{ color: "white", textDecoration: "none", opacity: 0.9 }}>
                    FAQs
                  </a>
                </li>
              </ul>
            </div>
            {/* CONNECT Column */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                CONNECT
              </h4>
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.875rem", marginBottom: "1rem", opacity: 0.9 }}>Join Our Newsletter</p>
                <input
                  type="email"
                  placeholder="Your Email"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "24px",
                    border: "none",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <a href="#" style={{ color: "white", fontSize: "1.25rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a href="#" style={{ color: "white", fontSize: "1.25rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a href="#" style={{ color: "white", fontSize: "1.25rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </a>
                <a href="#" style={{ color: "white", fontSize: "1.25rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </a>
                <a href="#" style={{ color: "white", fontSize: "1.25rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginBottom: "3rem" }}></div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1fr",
              gap: "3rem",
              alignItems: "start",
              marginBottom: "3rem",
            }}
          >
            {/* AG1 Logo */}
            <div>
              <div
                style={{ fontSize: "4rem", fontWeight: "bold", fontFamily: "Playfair Display, serif", lineHeight: "1" }}
              >
                AG1<sup style={{ fontSize: "1.5rem" }}>®</sup>
              </div>
            </div>
            {/* Disclaimer Box */}
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "1.5rem",
                fontSize: "0.75rem",
                lineHeight: "1.6",
                opacity: 0.8,
              }}
            >
              <p style={{ margin: "0 0 1rem 0" }}>
                *These statements have not been evaluated by the Food and Drug Administration. This product is not
                intended to diagnose, treat, cure or prevent any disease.
              </p>
              <p style={{ margin: "0 0 1rem 0" }}>
                Information on this site is provided for informational purposes only. It is not meant to substitute for
                medical advice from your physician or other medical professional. You should not use the information
                contained herein for diagnosing or treating a health problem or disease, or prescribing any medication.
                Carefully read all product documentation. If you have or suspect that you have a medical problem,
                promptly contact your regular health care provider.
              </p>
              <p style={{ margin: "0 0 1rem 0" }}>
                **AG1 Wellness ID Offer valid for new AG1 subscriptions only. AGZ Prebiotic Offer valid for first AG1
                subscription only.
              </p>
              <p style={{ margin: "0 0 1rem 0" }}>Annual Packaging May Vary</p>
              <p style={{ margin: "0" }}>*Free shipping for subscription purchases for select U.S. customers only.</p>
            </div>
            {/* Language & Currency Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>English</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <span>🇺🇸</span>
                <span>United States (USD)</span>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid rgba(255,255,255,0.2)",
              paddingTop: "2rem",
              fontSize: "0.75rem",
              opacity: 0.8,
            }}
          >
            <div style={{ display: "flex", gap: "2rem" }}>
              <a href="#" style={{ color: "white", textDecoration: "none" }}>
                Privacy
              </a>
              <a href="#" style={{ color: "white", textDecoration: "none" }}>
                Do Not Sell My Personal Info
              </a>
              <a href="#" style={{ color: "white", textDecoration: "none" }}>
                Terms & Conditions
              </a>
            </div>
            <div>© 2025 AG1</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

