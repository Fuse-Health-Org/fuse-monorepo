import { useRouter } from 'next/router';
import { useState, useEffect, useMemo, useRef } from 'react';
import { extractClinicSlugFromDomain, getDashboardPrefix } from '../lib/clinic-utils';
import { apiCall } from '../lib/api';
import { PatientPortalDashboardFormat } from '@fuse/enums';
import ScrollingFeaturesBar from '../components/ScrollingFeaturesBar';
import GetStartedButton from '../components/GetStartedButton';
import TrendingProtocols from '../components/TrendingProtocols';
import { useBatchLikes } from '../hooks/useLikes';
import { UniformProductCard } from '../components/UniformProductCard';

interface FooterCategoryUrl {
  label: string;
  url: string;
}

interface FooterCategory {
  name: string;
  visible: boolean;
  urls?: FooterCategoryUrl[];
}

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
  footerColor?: string;
  footerCategories?: FooterCategory[];
  footerShowShop?: boolean;
  footerShowDailyHealth?: boolean;
  footerShowRestRestore?: boolean;
  footerShowStore?: boolean;
  footerShowLearnMore?: boolean;
  footerShowContact?: boolean;
  footerShowSupport?: boolean;
  footerShowConnect?: boolean;
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
  patientPortalDashboardFormat?: PatientPortalDashboardFormat;
  defaultFormColor?: string;
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
  // Frontend display product - used for showing product image on program cards
  frontendDisplayProductId?: string;
  frontendDisplayProduct?: {
    id: string;
    name: string;
    imageUrl?: string;
    slug?: string;
  };
  // Cheapest product price from the program
  fromPrice?: number | null;
}

// Union type for carousel items
type CarouselItem =
  | { type: 'product'; data: Product }
  | { type: 'program'; data: Program };

export default function LandingPage() {
  const router = useRouter();

  // Helper function to ensure URLs have proper protocol
  const ensureProtocol = (url: string): string => {
    if (!url || url === '#') return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const [customWebsite, setCustomWebsite] = useState<CustomWebsite | null>(null);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'bundles' | 'programs' | string>('all');
  const [shouldDuplicate, setShouldDuplicate] = useState(false);
  const shopSectionRef = useRef<HTMLElement>(null);

  // Extract unique categories from all products
  const productCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    products.forEach(product => {
      // Support both single category and categories array
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (cat && cat.trim()) {
            categoriesSet.add(cat.trim());
          }
        });
      } else if (product.category && product.category.trim()) {
        categoriesSet.add(product.category.trim());
      }
    });
    return Array.from(categoriesSet).sort();
  }, [products]);

  // Handle URL hash for category filtering
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash) {
        // Handle special cases first
        if (hash === 'all') {
          setActiveFilter('all');
        } else if (hash === 'bundles') {
          setActiveFilter('bundles');
        } else if (hash === 'programs') {
          setActiveFilter('programs');
        } else {
          // Try to find a matching category (case-insensitive)
          // Handle both "weight-loss", "weightloss", and "weight loss" formats
          const normalizedHash = hash.replace(/-/g, ' ');
          const hashNoSpaces = hash.replace(/\s+/g, '');

          const matchedCategory = productCategories.find(cat => {
            const catLower = cat.toLowerCase();
            const catNoSpaces = catLower.replace(/[\s_-]+/g, ''); // Remove spaces, underscores, and hyphens
            const catNormalized = catLower.replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces

            const matches = catLower === hash ||
              catLower === normalizedHash ||
              catNoSpaces === hash ||
              catNoSpaces === hashNoSpaces ||
              catNormalized === hash ||
              catNormalized === normalizedHash;

            if (matches) {
              console.log('✅ MATCH FOUND:', cat, 'for hash:', hash);
            }

            return matches;
          });

          if (matchedCategory) {
            console.log('Setting active filter to:', matchedCategory);
            setActiveFilter(matchedCategory);
          } else {
            console.log('❌ No match found for hash:', hash);
            console.log('Available categories:', productCategories);
            console.log('Normalized hash (with spaces):', normalizedHash);
            console.log('Hash (no spaces):', hashNoSpaces);
            console.log('Checking each category:');
            productCategories.forEach(cat => {
              const catLower = cat.toLowerCase();
              const catNoSpaces = catLower.replace(/\s+/g, '');
              console.log(`  - "${cat}" -> lower: "${catLower}", no spaces: "${catNoSpaces}"`);
            });
          }
        }

        // Scroll to the shop section
        setTimeout(() => {
          shopSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    // Check hash on initial load (only when productCategories is loaded)
    if (productCategories.length > 0 || window.location.hash) {
      handleHashChange();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [productCategories]);

  // Format category name for display (capitalize and replace underscores with spaces)
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

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

          // Check if custom website is active - if not, redirect to dashboard
          if (!websiteData || websiteData.isActive === false) {
            console.log('🔀 Custom website is not active, redirecting to dashboard...');
            setIsRedirecting(true);
            router.replace(getDashboardPrefix(clinicData));
            return; // Don't set isLoading to false - keep showing nothing while redirecting
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

          // Check if custom website is active - if not, redirect to dashboard (default)
          if (!websiteData || websiteData.isActive === false) {
            console.log('🔀 Custom website is not active, redirecting to dashboard...');
            setIsRedirecting(true);
            router.replace('/fuse-dashboard');
            return; // Don't set isLoading to false - keep showing nothing while redirecting
          }
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
          // Filter out programs that have a medical template but no products attached
          const filteredPrograms = programsData.filter((program: Program) => {
            // If program has a medical template, it must have products (fromPrice will be set)
            if (program.medicalTemplateId) {
              // Only show if fromPrice exists (meaning template has products)
              return program.fromPrice !== null && program.fromPrice !== undefined;
            }
            // Programs without templates can still show (though they might be disabled)
            return true;
          });
          setPrograms(filteredPrograms);
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

  // Drag to scroll functionality
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setIsAutoScrollPaused(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
    e.preventDefault();
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    // Don't immediately resume auto-scroll on mouse leave
    // Let it resume after a short delay or when mouse re-enters
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Multiply by 2 for faster scroll
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseEnterCarousel = () => {
    setIsAutoScrollPaused(true);
  };

  const handleMouseLeaveCarousel = () => {
    setIsAutoScrollPaused(false);
  };

  // Add global mouse event listeners for drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !carouselRef.current) return;
      e.preventDefault();
      const x = e.pageX - carouselRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, startX, scrollLeft]);

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

  // Helper function to check if a footer category should be shown
  const shouldShowFooterCategory = (categoryName: string, fallbackBoolean?: boolean): boolean => {
    if (websiteData?.footerCategories && Array.isArray(websiteData.footerCategories)) {
      const category = websiteData.footerCategories.find(cat =>
        cat.name.toLowerCase() === categoryName.toLowerCase()
      );
      return category ? category.visible : false;
    }
    // Fallback to boolean fields for backward compatibility
    return fallbackBoolean ?? true;
  };

  // Get visible footer categories with their URLs
  const visibleFooterCategories = useMemo(() => {
    if (websiteData?.footerCategories && Array.isArray(websiteData.footerCategories)) {
      return websiteData.footerCategories.filter(cat => cat.visible);
    }
    // Fallback: create categories from boolean fields for backward compatibility
    const categories: FooterCategory[] = [];
    if (websiteData?.footerShowShop !== false) categories.push({ name: "Shop", visible: true, urls: [] });
    if (websiteData?.footerShowDailyHealth !== false) categories.push({ name: "Daily Health", visible: true, urls: [] });
    if (websiteData?.footerShowRestRestore !== false) categories.push({ name: "Rest & Restore", visible: true, urls: [] });
    if (websiteData?.footerShowStore !== false) categories.push({ name: "Store", visible: true, urls: [] });
    if (websiteData?.footerShowLearnMore !== false) categories.push({ name: "Learn More", visible: true, urls: [] });
    if (websiteData?.footerShowContact !== false || websiteData?.footerShowSupport !== false) {
      categories.push({
        name: websiteData?.footerShowContact !== false && websiteData?.footerShowSupport !== false
          ? "Contact & Support"
          : websiteData?.footerShowContact !== false ? "Contact" : "Support",
        visible: true,
        urls: []
      });
    }
    if (websiteData?.footerShowConnect !== false) categories.push({ name: "Connect", visible: true, urls: [] });
    return categories;
  }, [websiteData?.footerCategories, websiteData?.footerShowShop, websiteData?.footerShowDailyHealth, websiteData?.footerShowRestRestore, websiteData?.footerShowStore, websiteData?.footerShowLearnMore, websiteData?.footerShowContact, websiteData?.footerShowSupport, websiteData?.footerShowConnect]);

  // Helper function to render a product card using uniform template
  const renderProductCard = (product: Product, index: number) => {
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

    // Use clinic's default form color or fallback to neutral gray
    const buttonColor = clinicInfo?.defaultFormColor || "#374151";

    return (
      <UniformProductCard
        key={product.id}
        product={product}
        index={index}
        isHovered={isHovered}
        isLiked={isLiked}
        likeCount={likeCount}
        onHover={() => setHoveredCardIndex(cardId)}
        onLeave={() => setHoveredCardIndex(null)}
        onLikeClick={handleLikeClick}
        primaryColor={buttonColor}
        renderGetStartedButton={(formId, slug) => (
          <GetStartedButton
            formId={formId}
            slug={slug}
            primaryColor={buttonColor}
          />
        )}
      />
    );
  };

  // Badge logic is now in UniformProductCard component for consistency

  // Helper function to render a program card (matches product card style)
  const renderProgramCard = (program: Program, index: number) => {
    const cardId = `program-${program.id}-${index}`;
    const isHovered = hoveredCardIndex === cardId;
    const hasTemplate = !!program.medicalTemplateId;

    // Program colors - neutral tones
    const programColors = ["#525252", "#4b5563", "#6b7280", "#374151"];
    const cardColor = programColors[index % 4];

    // Use clinic's default form color or fallback to neutral gray
    const buttonColor = clinicInfo?.defaultFormColor || "#374151";

    // Use the frontend display product image if available
    const displayImageUrl = program.frontendDisplayProduct?.imageUrl;

    return (
      <div
        key={program.id}
        onClick={() => {
          if (hasTemplate) {
            window.open(`${getDashboardPrefix(clinicInfo)}/my-products/${program.id}/program`, '_blank');
          }
        }}
        onMouseEnter={() => setHoveredCardIndex(cardId)}
        onMouseLeave={() => setHoveredCardIndex(null)}
        style={{
          cursor: hasTemplate ? "pointer" : "default",
          position: "relative",
        }}
      >
        {/* Program badge - top left */}
        <span style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          background: "#525252",
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
            padding: "1rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "1/1",
            overflow: "hidden",
          }}
        >
          {displayImageUrl ? (
            // Show product image if frontendDisplayProduct is set
            <img
              src={displayImageUrl}
              alt={program.frontendDisplayProduct?.name || program.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: isHovered ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.3s ease",
              }}
            />
          ) : (
            // Default gradient with stethoscope icon
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
          )}
        </div>
        {/* Program Name - Fixed 2 lines max */}
        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.25rem",
          marginBottom: "0.5rem",
          fontWeight: 400,
          color: isHovered ? "#525252" : "inherit",
          transition: "color 0.3s ease",
          height: "3rem", // Fixed height for 2 lines
          lineHeight: "1.5rem",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {program.name}
        </h3>
        {/* Description - Fixed 3 lines max */}
        <p style={{
          fontSize: "0.875rem",
          color: "#525252",
          marginBottom: "0.75rem",
          height: "3.75rem", // Fixed height for 3 lines
          lineHeight: "1.25rem",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical" as const,
        }}>
          {program.description || program.medicalTemplate?.title || "Comprehensive health program"}
        </p>
        {/* Price - Fixed height */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
          height: "1.5rem", // Fixed height
        }}>
          {program.fromPrice && program.fromPrice > 0 && (
            <span style={{ fontWeight: 600 }}>From ${program.fromPrice.toFixed(2)}/mo</span>
          )}
        </div>
        {/* Badges - Fixed height */}
        <div style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
          height: "1.75rem", // Fixed height for single row of badges
          overflow: "hidden",
        }}>
          <span
            style={{
              backgroundColor: "#6b7280",
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
            href={`${getDashboardPrefix(clinicInfo)}/my-products/${program.id}/program`}
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
              backgroundColor: buttonColor,
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

  // Combine programs and products into carousel items based on active filter
  const carouselItems: CarouselItem[] = (() => {
    if (activeFilter === 'programs') {
      return programs.map((program): CarouselItem => ({ type: 'program', data: program }));
    } else if (activeFilter === 'bundles') {
      // Filter products that are bundles (you can add bundle logic here)
      return products.map((product): CarouselItem => ({ type: 'product', data: product }));
    } else if (activeFilter !== 'all' && productCategories.includes(activeFilter)) {
      // Filter by category
      const filteredProducts = products.filter(product => {
        if (product.categories && Array.isArray(product.categories)) {
          return product.categories.some(cat => cat?.trim() === activeFilter);
        } else if (product.category) {
          return product.category.trim() === activeFilter;
        }
        return false;
      });
      return filteredProducts.map((product): CarouselItem => ({ type: 'product', data: product }));
    } else {
      // Show all: programs first, then products
      return [
        ...programs.map((program): CarouselItem => ({ type: 'program', data: program })),
        ...products.slice(0, 6).map((product): CarouselItem => ({ type: 'product', data: product })),
      ];
    }
  })();

  const isCarouselLoading = productsLoading || programsLoading;

  // Detect if carousel needs duplication (has overflow)
  useEffect(() => {
    if (!carouselRef.current) return;

    const checkOverflow = () => {
      if (carouselRef.current) {
        const hasOverflow = carouselRef.current.scrollWidth > carouselRef.current.clientWidth;
        setShouldDuplicate(hasOverflow);
      }
    };

    // Check on mount and when items change
    checkOverflow();

    // Also check after a short delay to ensure items are rendered
    const timeoutId = setTimeout(checkOverflow, 100);

    return () => clearTimeout(timeoutId);
  }, [carouselItems.length, activeFilter]);

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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => router.push(getDashboardPrefix(clinicInfo))}
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
            All Products
          </button>
        </div>
        {/* Scrolling Features Bar - positioned at bottom of hero */}
        <ScrollingFeaturesBar textColor="white" position="absolute" />
      </div>

      {/* Main Content */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Title Section */}
        <section ref={shopSectionRef} style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#737373", marginBottom: "0.5rem" }}>SHOP</p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "3rem", marginBottom: "0.75rem", fontWeight: 400 }}>
            {programs.length > 0 ? "Trending Programs & Products" : "Trending Products"}
          </h2>
          <p style={{ color: "#404040" }}>
            {programs.length > 0
              ? "Discover our health programs and member favorites here."
              : "AG1 is so much more than greens. Discover our member favorites here."}
          </p>
        </section>
        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "3rem" }}>
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: activeFilter === 'all' ? "#8b7355" : "white",
              color: activeFilter === 'all' ? "white" : "inherit",
              border: activeFilter === 'all' ? "none" : "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('bundles')}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: activeFilter === 'bundles' ? "#8b7355" : "white",
              color: activeFilter === 'bundles' ? "white" : "inherit",
              border: activeFilter === 'bundles' ? "none" : "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Bundles
          </button>
          <button
            onClick={() => setActiveFilter('programs')}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: activeFilter === 'programs' ? "#8b7355" : "white",
              color: activeFilter === 'programs' ? "white" : "inherit",
              border: activeFilter === 'programs' ? "none" : "1px solid #d4d4d4",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Programs
          </button>
          {/* Category Filters */}
          {productCategories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveFilter(category)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: activeFilter === category ? "#8b7355" : "white",
                color: activeFilter === category ? "white" : "inherit",
                border: activeFilter === category ? "none" : "1px solid #d4d4d4",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {formatCategoryName(category)}
            </button>
          ))}
        </div>
        {/* Programs & Products Grid */}
        {isCarouselLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>Loading...</p>
          </div>
        ) : carouselItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>No programs or products available at the moment.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '2rem',
              marginBottom: '3rem',
            }}
          >
            {carouselItems.map((item, index) => (
              <div key={`${item.type}-${item.data.id}-${index}`}>
                {item.type === 'program'
                  ? renderProgramCard(item.data, index)
                  : renderProductCard(item.data, index)}
              </div>
            ))}
          </div>
        )}

        {/* Trending Protocols Section */}
        {/* <TrendingProtocols primaryColor={primaryColor} /> */}

      </main>
      {/* Footer */}
      <footer style={{ backgroundColor: websiteData?.footerColor || "#0d3d3d", color: "white", padding: "4rem 0 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
          {/* Main Footer Grid: Left Sections | Middle Disclaimers | Right Sections. Single column on mobile via .brand-portal-footer-grid */}
          <div
            className="brand-portal-footer-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1fr",
              gap: "2rem",
              alignItems: "start",
            }}
          >
            {/* Left: Clinic Name + Section 1 & Section 2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Clinic Name */}
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{(clinicInfo?.name || "LOGO").toUpperCase()}</h2>
              </div>
              {/* Section 1 */}
              {visibleFooterCategories[0] && (
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                    {visibleFooterCategories[0].name.toUpperCase()}
                  </h4>
                  {visibleFooterCategories[0].urls && visibleFooterCategories[0].urls.length > 0 && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                      {visibleFooterCategories[0].urls.map((urlItem, urlIndex) => {
                        // Check if link is internal (same domain or relative)
                        let isInternal = urlItem.url.startsWith('#') || urlItem.url.startsWith('/');
                        if (!isInternal && typeof window !== 'undefined') {
                          try {
                            const linkUrl = new URL(urlItem.url, window.location.origin);
                            isInternal = linkUrl.hostname === window.location.hostname;
                          } catch (e) {
                            // Invalid URL, treat as external
                          }
                        }
                        return (
                          <li key={urlIndex} style={{ marginBottom: "0.5rem" }}>
                            <a
                              href={urlItem.url}
                              target={isInternal ? undefined : "_blank"}
                              rel={isInternal ? undefined : "noopener noreferrer"}
                              style={{ color: "white", textDecoration: "none", opacity: 0.9 }}
                            >
                              {urlItem.label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {/* Section 2 */}
              {visibleFooterCategories[1] && (
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                    {visibleFooterCategories[1].name.toUpperCase()}
                  </h4>
                  {visibleFooterCategories[1].urls && visibleFooterCategories[1].urls.length > 0 && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                      {visibleFooterCategories[1].urls.map((urlItem, urlIndex) => {
                        // Check if link is internal (same domain or relative)
                        let isInternal = urlItem.url.startsWith('#') || urlItem.url.startsWith('/');
                        if (!isInternal && typeof window !== 'undefined') {
                          try {
                            const linkUrl = new URL(urlItem.url, window.location.origin);
                            isInternal = linkUrl.hostname === window.location.hostname;
                          } catch (e) {
                            // Invalid URL, treat as external
                          }
                        }
                        return (
                          <li key={urlIndex} style={{ marginBottom: "0.5rem" }}>
                            <a
                              href={urlItem.url}
                              target={isInternal ? undefined : "_blank"}
                              rel={isInternal ? undefined : "noopener noreferrer"}
                              style={{ color: "white", textDecoration: "none", opacity: 0.9 }}
                            >
                              {urlItem.label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Middle: Disclaimers */}
            <div>
              <div style={{ fontSize: "0.625rem", lineHeight: "1.6", opacity: 0.7, whiteSpace: "pre-wrap" }}>
                {websiteData?.footerDisclaimer || "* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease. The information provided on this site is for informational purposes only and is not intended as a substitute for advice from your physician or other health care professional."}
              </div>
            </div>

            {/* Right: Language/Currency + Section 3 & Section 4 + Newsletter + Social + Copyright */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem", justifyContent: "space-between", minHeight: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {/* Language/Currency - At Top */}
                <div style={{ fontSize: "0.75rem", opacity: 0.7, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "1px solid white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                  }}>
                    <span style={{
                      fontSize: "1.5rem",
                      lineHeight: 1,
                      transform: "scale(1.5)",
                      display: "block"
                    }}>
                      🇺🇸
                    </span>
                  </div>
                  English | $ United States (USD)
                </div>

                {/* Section 3 */}
                {visibleFooterCategories[2] && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                      {visibleFooterCategories[2].name.toUpperCase()}
                    </h4>
                    {visibleFooterCategories[2].urls && visibleFooterCategories[2].urls.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                        {visibleFooterCategories[2].urls.map((urlItem, urlIndex) => {
                          // Check if link is internal (same domain or relative)
                          let isInternal = urlItem.url.startsWith('#') || urlItem.url.startsWith('/');
                          if (!isInternal && typeof window !== 'undefined') {
                            try {
                              const linkUrl = new URL(urlItem.url, window.location.origin);
                              isInternal = linkUrl.hostname === window.location.hostname;
                            } catch (e) {
                              // Invalid URL, treat as external
                            }
                          }
                          return (
                            <li key={urlIndex} style={{ marginBottom: "0.5rem" }}>
                              <a
                                href={urlItem.url}
                                target={isInternal ? undefined : "_blank"}
                                rel={isInternal ? undefined : "noopener noreferrer"}
                                style={{ color: "white", textDecoration: "none", opacity: 0.9 }}
                              >
                                {urlItem.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {/* Section 4 */}
                {visibleFooterCategories[3] && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                      {visibleFooterCategories[3].name.toUpperCase()}
                    </h4>
                    {visibleFooterCategories[3].urls && visibleFooterCategories[3].urls.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
                        {visibleFooterCategories[3].urls.map((urlItem, urlIndex) => {
                          // Check if link is internal (same domain or relative)
                          let isInternal = urlItem.url.startsWith('#') || urlItem.url.startsWith('/');
                          if (!isInternal && typeof window !== 'undefined') {
                            try {
                              const linkUrl = new URL(urlItem.url, window.location.origin);
                              isInternal = linkUrl.hostname === window.location.hostname;
                            } catch (e) {
                              // Invalid URL, treat as external
                            }
                          }
                          return (
                            <li key={urlIndex} style={{ marginBottom: "0.5rem" }}>
                              <a
                                href={urlItem.url}
                                target={isInternal ? undefined : "_blank"}
                                rel={isInternal ? undefined : "noopener noreferrer"}
                                style={{ color: "white", textDecoration: "none", opacity: 0.9 }}
                              >
                                {urlItem.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {/* Social Media */}
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: "1rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                    {(websiteData?.socialMediaSection || "SOCIAL MEDIA").toUpperCase()}
                  </h4>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    {/* Instagram */}
                    {(websiteData?.socialMediaLinks?.instagram?.enabled ?? true) && (
                      <a
                        href={ensureProtocol(websiteData?.socialMediaLinks?.instagram?.url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", fontSize: "1.25rem" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                      </a>
                    )}
                    {/* Facebook */}
                    {(websiteData?.socialMediaLinks?.facebook?.enabled ?? true) && (
                      <a
                        href={ensureProtocol(websiteData?.socialMediaLinks?.facebook?.url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", fontSize: "1.25rem" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </a>
                    )}
                    {/* Twitter/X */}
                    {(websiteData?.socialMediaLinks?.twitter?.enabled ?? true) && (
                      <a
                        href={ensureProtocol(websiteData?.socialMediaLinks?.twitter?.url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", fontSize: "1.25rem" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    )}
                    {/* TikTok */}
                    {(websiteData?.socialMediaLinks?.tiktok?.enabled ?? true) && (
                      <a
                        href={ensureProtocol(websiteData?.socialMediaLinks?.tiktok?.url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", fontSize: "1.25rem" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                        </svg>
                      </a>
                    )}
                    {/* YouTube */}
                    {(websiteData?.socialMediaLinks?.youtube?.enabled ?? true) && (
                      <a
                        href={ensureProtocol(websiteData?.socialMediaLinks?.youtube?.url || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "white", fontSize: "1.25rem" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Copyright - At Bottom */}
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                © {new Date().getFullYear()} {(clinicInfo?.name || "").toUpperCase()}
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.2)",
              paddingTop: "2rem",
              marginTop: "3rem",
              fontSize: "0.75rem",
              opacity: 0.8,
              textAlign: "center",
            }}
          >
            <div>© {new Date().getFullYear()} {clinicInfo?.name || ""}. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

