import { useRouter } from 'next/router';
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import { extractClinicSlugFromDomain, getDashboardPrefix } from '../lib/clinic-utils';
import { apiCall } from '../lib/api';
import ScrollingFeaturesBar from '../components/ScrollingFeaturesBar';
import GetStartedButton from '../components/GetStartedButton';
import TrendingProtocols from '../components/TrendingProtocols';
import { useBatchLikes } from '../hooks/useLikes';
import { UniformProductCard } from '../components/UniformProductCard';

// Helper function to extract solid color from gradient or return the color as-is
const getContrastColor = (hex: string): string => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000000' : '#ffffff';
};

const extractColorFromGradient = (colorValue: string): string => {
  if (!colorValue) return '';
  // Check if it's a gradient
  if (colorValue.includes('linear-gradient')) {
    // Extract first hex color from the gradient
    const hexMatch = colorValue.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
    return hexMatch ? hexMatch[0] : colorValue;
  }
  return colorValue;
};

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
  footerDisclaimer?: string;
  socialMediaLinks?: {
    instagram?: { enabled: boolean; url: string };
    facebook?: { enabled: boolean; url: string };
    twitter?: { enabled: boolean; url: string };
    tiktok?: { enabled: boolean; url: string };
    youtube?: { enabled: boolean; url: string };
  };
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
  patientPortalDashboardFormat?: string;
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
  frontendDisplayProductId?: string;
  frontendDisplayProduct?: {
    id: string;
    name: string;
    imageUrl?: string;
    slug?: string;
  };
  fromPrice?: number | null;
}

type CarouselItem =
  | { type: 'product'; data: Product }
  | { type: 'program'; data: Program };

// ============================================
// DESIGN SYSTEM - Premium Pharma + DTC Wellness
// ============================================
const DESIGN = {
  colors: {
    background: '#faf9f7',           // Soft neutral background
    cardBackground: '#f5f0e8',       // Warm beige for product cards
    white: '#ffffff',
    text: {
      primary: '#1f2937',            // Deep charcoal
      secondary: '#6b7280',          // Muted gray
      muted: '#9ca3af',              // Light gray
    },
    accent: {
      badge: '#525252',              // Neutral badge color
    },
    footer: '#f3f4f6',               // Soft gray footer
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headingFamily: '"Inter", -apple-system, sans-serif',
  },
  spacing: {
    section: '5rem',
    sectionMobile: '3rem',
    container: '1200px',        // Reduced from 1280px
    cardGap: '1.5rem',
  },
  borderRadius: {
    small: '0.5rem',
    medium: '0.75rem',
    large: '1rem',
    full: '9999px',
  },
  shadows: {
    soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
    card: '0 4px 12px rgba(0, 0, 0, 0.05)',
    button: '0 4px 14px rgba(124, 58, 237, 0.25)',
  },
};

export default function LandingPage() {
  const router = useRouter();

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Extract unique categories from all products
  const productCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    products.forEach(product => {
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
        if (hash === 'all') {
          setActiveFilter('all');
        } else if (hash === 'bundles') {
          setActiveFilter('bundles');
        } else if (hash === 'programs') {
          setActiveFilter('programs');
        } else {
          const normalizedHash = hash.replace(/-/g, ' ');
          const hashNoSpaces = hash.replace(/\s+/g, '');

          const matchedCategory = productCategories.find(cat => {
            const catLower = cat.toLowerCase();
            const catNoSpaces = catLower.replace(/[\s_-]+/g, '');
            const catNormalized = catLower.replace(/[-_]/g, ' ');

            return catLower === hash ||
              catLower === normalizedHash ||
              catNoSpaces === hash ||
              catNoSpaces === hashNoSpaces ||
              catNormalized === hash ||
              catNormalized === normalizedHash;
          });

          if (matchedCategory) {
            setActiveFilter(matchedCategory);
          }
        }

        setTimeout(() => {
          shopSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    if (productCategories.length > 0 || window.location.hash) {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [productCategories]);

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

  const { likeCounts, userLikes, toggle: toggleLike } = useBatchLikes(tenantProductIds);

  useEffect(() => {
    const loadCustomWebsite = async () => {
      try {
        const domainInfo = await extractClinicSlugFromDomain();

        let websiteData: CustomWebsite | null = null;

        const slugToFetch = domainInfo.affiliateSlug || domainInfo.clinicSlug;
        if (domainInfo.hasClinicSubdomain && slugToFetch) {
          const result = await apiCall(`/custom-website/by-slug/${slugToFetch}`);

          const clinicData = result.data?.clinic || (result as any).clinic;
          if (clinicData) {
            setClinicInfo(clinicData);
          }

          if (result.success && result.data?.data) {
            websiteData = result.data.data;
          } else if (result.success && result.data) {
            websiteData = result.data;
          }

          if (!websiteData || websiteData.isActive === false) {
            setIsRedirecting(true);
            router.replace(getDashboardPrefix(clinicData));
            return;
          }
        } else {
          try {
            const result = await apiCall('/custom-website/default');
            if (result.success && result.data?.data) {
              websiteData = result.data.data;
            } else if (result.success && result.data) {
              websiteData = result.data;
            }
          } catch (error) {
            console.log('ℹ️ No custom website found');
          }

          if (!websiteData || websiteData.isActive === false) {
            setIsRedirecting(true);
            router.replace('/fuse-dashboard');
            return;
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

        let endpoint = domainInfo.hasClinicSubdomain && domainInfo.clinicSlug
          ? `/public/products/${domainInfo.clinicSlug}`
          : `/public/products`;

        if (domainInfo.affiliateSlug) {
          endpoint += `?affiliateSlug=${encodeURIComponent(domainInfo.affiliateSlug)}`;
        }

        const result = await apiCall(endpoint);

        if (result.success && result.data?.data) {
          setProducts(result.data.data);
        } else if (result.success && result.data) {
          setProducts(result.data);
        }
      } catch (error) {
        console.error('❌ Error loading products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Load programs
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        setProgramsLoading(true);
        const domainInfo = await extractClinicSlugFromDomain();

        if (!domainInfo.clinicSlug) {
          setPrograms([]);
          return;
        }

        let apiUrl = `/public/programs/by-clinic/${domainInfo.clinicSlug}`;
        if (domainInfo.affiliateSlug) {
          apiUrl += `?affiliateSlug=${encodeURIComponent(domainInfo.affiliateSlug)}`;
        }

        const result = await apiCall(apiUrl);

        let programsData = result.data;
        if (result.data?.data) {
          programsData = result.data.data;
        }

        if (Array.isArray(programsData)) {
          const filteredPrograms = programsData.filter((program: Program) => {
            if (program.medicalTemplateId) {
              return program.fromPrice !== null && program.fromPrice !== undefined;
            }
            return true;
          });
          setPrograms(filteredPrograms);
        } else {
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

  // Handle nested data structure from API response
  const websiteData = (customWebsite as any)?.data || customWebsite;

  // Dynamic values from API
  const affiliateHeroImageUrl = websiteData?.heroImageUrl;
  const parentHeroImageUrl = clinicInfo?.parentClinicHeroImageUrl;
  const heroImageUrl = affiliateHeroImageUrl || parentHeroImageUrl || "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80";

  const heroTitle = websiteData?.heroTitle || "Premium Peptide Solutions.";
  const heroSubtitle = websiteData?.heroSubtitle || "Distributed with Confidence.";
  const primaryColor = websiteData?.primaryColor || "#7c3aed"; // Default purple if not set
  const backgroundColor = websiteData?.backgroundColor || DESIGN.colors.white;
  const fontFamily = websiteData?.fontFamily || DESIGN.typography.fontFamily;
  const navDisplayMode = websiteData?.navDisplayMode || "brandName";
  const navBrandName = websiteData?.navBrandName || "";
  const navFooterColor = websiteData?.navFooterColor || websiteData?.footerColor || "#000000";
  const navFooterTextColor = getContrastColor(navFooterColor);
  const primaryColorSolid = extractColorFromGradient(primaryColor);
  const primaryColorText = getContrastColor(primaryColorSolid);
  const backgroundTextColor = getContrastColor(backgroundColor);
  const backgroundTextColorSecondary = backgroundTextColor === '#000000' ? '#6b7280' : 'rgba(255,255,255,0.70)';
  const backgroundTextColorMuted = backgroundTextColor === '#000000' ? '#9ca3af' : 'rgba(255,255,255,0.50)';

  const affiliateLogo = websiteData?.logo;
  const parentLogo = clinicInfo?.parentClinicLogo;
  const isAffiliate = clinicInfo?.isAffiliate;
  const logo = affiliateLogo || parentLogo;

  // Get visible footer categories
  const visibleFooterCategories = useMemo(() => {
    if (websiteData?.footerCategories && Array.isArray(websiteData.footerCategories)) {
      return websiteData.footerCategories.filter(cat => cat.visible);
    }
    const categories: FooterCategory[] = [];
    if (websiteData?.footerShowShop !== false) categories.push({ name: "Shop", visible: true, urls: [] });
    if (websiteData?.footerShowLearnMore !== false) categories.push({ name: "Learn More", visible: true, urls: [] });
    if (websiteData?.footerShowContact !== false) categories.push({ name: "Contact", visible: true, urls: [] });
    if (websiteData?.footerShowSupport !== false) categories.push({ name: "Support", visible: true, urls: [] });
    return categories;
  }, [websiteData]);

  // Filter items based on active filter and category
  const carouselItems = useMemo(() => {
    const items: CarouselItem[] = [];

    // Add programs
    if (activeFilter === 'all' || activeFilter === 'programs') {
      programs.forEach(program => items.push({ type: 'program', data: program }));
    }

    // Add products
    let filteredProducts = products;

    if (activeFilter === 'bundles') {
      filteredProducts = [];
    } else if (activeFilter !== 'all' && activeFilter !== 'programs') {
      filteredProducts = products.filter(product => {
        const productCategories = product.categories || [product.category] || [];
        return productCategories.some(cat =>
          cat && cat.toLowerCase() === activeFilter.toLowerCase()
        );
      });
    }

    filteredProducts.forEach(product => items.push({ type: 'product', data: product }));

    return items;
  }, [products, programs, activeFilter]);

  // Filter products by selected category dropdown
  const filteredProductsForGrid = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter(product => {
      const cats = product.categories || [product.category] || [];
      return cats.some(cat => cat && cat.toLowerCase() === selectedCategory.toLowerCase());
    });
  }, [products, selectedCategory]);

  const isCarouselLoading = productsLoading || programsLoading;

  // Render product card with new design
  const renderProductCard = (product: Product, index: number) => {
    const cardId = `product-${product.id}-${index}`;
    const isHovered = hoveredCardIndex === cardId;
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

    const buttonColor = clinicInfo?.defaultFormColor || primaryColor;
    const buttonColorSolid = extractColorFromGradient(buttonColor);
    const buttonColorText = getContrastColor(buttonColorSolid);
    const firstCategory = product.categories?.[0] || product.category;

    return (
      <div
        key={product.id}
        onMouseEnter={() => setHoveredCardIndex(cardId)}
        onMouseLeave={() => setHoveredCardIndex(null)}
        style={{
          backgroundColor: DESIGN.colors.white,
          borderRadius: '12px',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Image Container */}
        <div
          style={{
            backgroundColor: '#f7f7f7',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            position: 'relative',
          }}
        >
          {/* Category Badge */}
          {firstCategory && (
            <span style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              backgroundColor: DESIGN.colors.white,
              color: DESIGN.colors.text.secondary,
              fontSize: '0.625rem',
              fontWeight: 600,
              padding: '0.375rem 0.75rem',
              borderRadius: DESIGN.borderRadius.full,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: `1px solid ${DESIGN.colors.text.muted}25`,
            }}>
              {formatCategoryName(firstCategory)}
            </span>
          )}

          {/* Like Button */}
          <button
            onClick={handleLikeClick}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'transparent',
              border: 'none',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isLiked ? '#ef4444' : 'none'} stroke={isLiked ? '#ef4444' : '#6b7280'} strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                maxWidth: '120px',
                maxHeight: '120px',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              width: '120px',
              height: '120px',
              backgroundColor: '#2d3748',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}>
              <span style={{ 
                color: 'white', 
                fontSize: '0.875rem', 
                fontWeight: 500,
                textAlign: 'center', 
                lineHeight: 1.4,
              }}>
                {product.name.substring(0, 30)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem 1.25rem 1.5rem 1.25rem' }}>
          <h3 style={{
            fontFamily: DESIGN.typography.headingFamily,
            fontSize: '1rem',
            fontWeight: 500,
            color: DESIGN.colors.text.primary,
            marginBottom: '0.5rem',
            lineHeight: 1.4,
            height: '1.4rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {product.name}
          </h3>

          <p style={{
            fontSize: '0.8125rem',
            color: DESIGN.colors.text.muted,
            marginBottom: '1rem',
            lineHeight: 1.5,
            height: '2.4375rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {product.description || 'Edit product details below'}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: DESIGN.colors.text.primary,
              }}>
                ${Math.floor(product.price)}
              </span>
              <span style={{
                fontSize: '0.8125rem',
                color: DESIGN.colors.text.muted,
                marginLeft: '0.25rem',
              }}>
                /mo
              </span>
            </div>
            <GetStartedButton
              formId={product.formId}
              slug={product.slug}
              primaryColor={buttonColor}
              variant="pill"
              style={{
                background: 'transparent',
                color: buttonColorSolid,
                border: `1.5px solid ${buttonColorSolid}`,
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '6px',
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Render program card with new design
  const renderProgramCard = (program: Program, index: number) => {
    const cardId = `program-${program.id}-${index}`;
    const isHovered = hoveredCardIndex === cardId;
    const hasTemplate = !!program.medicalTemplateId;
    const displayImageUrl = program.frontendDisplayProduct?.imageUrl;
    const buttonColor = primaryColor;
    const buttonColorSolid = extractColorFromGradient(buttonColor);
    const buttonColorText = getContrastColor(buttonColorSolid);

    return (
      <div
        key={program.id}
        onClick={() => {
          if (hasTemplate) {
            window.location.href = `${getDashboardPrefix(clinicInfo)}/my-products/${program.id}/program`;
          }
        }}
        onMouseEnter={() => setHoveredCardIndex(cardId)}
        onMouseLeave={() => setHoveredCardIndex(null)}
        style={{
          backgroundColor: DESIGN.colors.white,
          borderRadius: DESIGN.borderRadius.large,
          overflow: 'hidden',
          boxShadow: isHovered ? DESIGN.shadows.card : DESIGN.shadows.soft,
          transition: 'all 0.3s ease',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
          cursor: hasTemplate ? 'pointer' : 'default',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Image Container */}
        <div
          style={{
            backgroundColor: '#f5f5f5',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            aspectRatio: '1/1',
            position: 'relative',
          }}
        >
          {/* Program Badge */}
          <span style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            backgroundColor: DESIGN.colors.white,
            color: DESIGN.colors.text.secondary,
            fontSize: '0.625rem',
            fontWeight: 600,
            padding: '0.375rem 0.75rem',
            borderRadius: DESIGN.borderRadius.full,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: `1px solid ${DESIGN.colors.text.muted}25`,
          }}>
            PROGRAM
          </span>

          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={program.name}
              style={{
                maxWidth: '75%',
                maxHeight: '75%',
                objectFit: 'contain',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.3s ease',
              }}
            />
          ) : (
            <div style={{
              width: '65%',
              aspectRatio: '1/1',
              backgroundColor: '#1f2937',
              borderRadius: DESIGN.borderRadius.medium,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" style={{ marginBottom: '0.75rem' }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ 
                color: 'white', 
                fontSize: '0.875rem', 
                fontWeight: 500,
                textAlign: 'center', 
                lineHeight: 1.4,
              }}>
                {program.name.length > 25 ? program.name.substring(0, 25) + '...' : program.name}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem 1.25rem 1.5rem 1.25rem' }}>
          <h3 style={{
            fontFamily: DESIGN.typography.headingFamily,
            fontSize: '1rem',
            fontWeight: 500,
            color: DESIGN.colors.text.primary,
            marginBottom: '0.5rem',
            lineHeight: 1.4,
            height: '1.4rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {program.name}
          </h3>

          <p style={{
            fontSize: '0.8125rem',
            color: DESIGN.colors.text.muted,
            marginBottom: '1rem',
            lineHeight: 1.5,
            height: '2.4375rem',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {program.description || 'Edit product details below'}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              {program.fromPrice && program.fromPrice > 0 && (
                <>
                  <span style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: DESIGN.colors.text.primary,
                  }}>
                    ${Math.floor(program.fromPrice)}
                  </span>
                  <span style={{
                    fontSize: '0.8125rem',
                    color: DESIGN.colors.text.muted,
                    marginLeft: '0.25rem',
                  }}>
                    /mo
                  </span>
                </>
              )}
            </div>
            {hasTemplate ? (
              buttonColor.includes('linear-gradient') ? (
                <div
                  style={{
                    background: buttonColor,
                    padding: '2px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                  }}
                >
                  <a
                    href={`${getDashboardPrefix(clinicInfo)}/my-products/${program.id}/program`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.style.background = buttonColor;
                      e.currentTarget.style.background = buttonColor;
                      e.currentTarget.style.color = buttonColorText;
                    }}
                    onMouseLeave={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.style.background = buttonColor;
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = buttonColorSolid;
                    }}
                    style={{
                      background: 'white',
                      color: buttonColorSolid,
                      padding: '0.5rem 1rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: '6px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                      border: 'none',
                    }}
                  >
                    Buy now
                  </a>
                </div>
              ) : (
                <a
                  href={`${getDashboardPrefix(clinicInfo)}/my-products/${program.id}/program`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = buttonColor;
                    e.currentTarget.style.color = buttonColorText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = buttonColorSolid;
                  }}
                  style={{
                    background: 'transparent',
                    color: buttonColorSolid,
                    border: `1.5px solid ${buttonColorSolid}`,
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Buy now
                </a>
              )
            ) : (
              <span style={{
                color: DESIGN.colors.text.muted,
                fontSize: '0.8125rem',
              }}>
                Coming Soon
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading || isRedirecting) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: DESIGN.colors.background, fontFamily: DESIGN.typography.fontFamily }}>
        <header style={{ backgroundColor: DESIGN.colors.white, borderBottom: `1px solid ${DESIGN.colors.text.muted}20` }}>
          <div style={{ maxWidth: DESIGN.spacing.container, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
            <div style={{ width: '100px', height: '36px', backgroundColor: '#e5e5e5', borderRadius: '4px' }} />
            <div style={{ width: '120px', height: '36px', backgroundColor: '#e5e5e5', borderRadius: '20px' }} />
          </div>
        </header>
        <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '500px', height: '48px', backgroundColor: '#e5e5e5', borderRadius: '8px', margin: '0 auto 1rem' }} />
            <div style={{ width: '300px', height: '24px', backgroundColor: '#e5e5e5', borderRadius: '8px', margin: '0 auto' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        {/* Load custom font from Google Fonts if it's not a system font */}
        {fontFamily && !['Georgia', 'Arial', 'Helvetica', 'Times New Roman'].includes(fontFamily) && (
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`}
          />
        )}
        <style>{`
          html {
            scroll-behavior: smooth;
            scroll-padding-top: 72px;
          }
          
          @media (prefers-reduced-motion: reduce) {
            html {
              scroll-behavior: auto;
            }
          }
        `}</style>
      </Head>
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: backgroundColor, 
        fontFamily: fontFamily,
      }}>
      {/* ========== HEADER ========== */}
      <header style={{
        backgroundColor: navFooterColor,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 3rem',
          height: '72px',
        }}>
          {/* Nav identity — brand name or logo based on portal settings */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {navDisplayMode === 'logo' && affiliateLogo ? (
              <img
                src={affiliateLogo}
                alt="Brand logo"
                style={{ maxHeight: '40px', maxWidth: '160px', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color: navFooterTextColor, fontFamily: fontFamily }}>
                {navBrandName || clinicInfo?.name || 'FUSE'}
              </span>
            )}
          </div>

          {/* Navigation - Centered */}
          <nav style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '2rem',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <a href="#products" style={{ 
              color: navFooterTextColor, 
              textDecoration: 'none', 
              fontSize: '0.9375rem', 
              fontWeight: 500,
              opacity: 0.85,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            >
              Products
            </a>
            <a href="#how-it-works" style={{ 
              color: navFooterTextColor, 
              textDecoration: 'none', 
              fontSize: '0.9375rem', 
              fontWeight: 500,
              opacity: 0.85,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            >
              How It Works
            </a>
            <a href="#footer" style={{ 
              color: navFooterTextColor, 
              textDecoration: 'none', 
              fontSize: '0.9375rem', 
              fontWeight: 500,
              opacity: 0.85,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            >
              Contact
            </a>
          </nav>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => router.push(getDashboardPrefix(clinicInfo))}
              style={{
                backgroundColor: 'transparent',
                color: navFooterTextColor,
                padding: '0 1rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: 500,
                opacity: 0.85,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            >
              Login
            </button>
            {(() => {
              const headerButtonColor = primaryColor;
              const headerButtonColorSolid = extractColorFromGradient(headerButtonColor);
              const isGradient = headerButtonColor.includes('linear-gradient');
              
              if (isGradient) {
                return (
                  <div
                    style={{
                      background: headerButtonColor,
                      padding: '2px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                    }}
                  >
                    <button
                      onClick={() => shopSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = headerButtonColor;
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = headerButtonColorSolid;
                      }}
                      style={{
                        background: 'white',
                        color: headerButtonColorSolid,
                        padding: '0.5rem 1.25rem',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Order now
                    </button>
                  </div>
                );
              }
              
              return (
                <button
                  onClick={() => shopSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = headerButtonColor;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = headerButtonColor;
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    color: headerButtonColor,
                    padding: '0.5rem 1.25rem',
                    border: `1.5px solid ${headerButtonColor}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  Order now
                </button>
              );
            })()}
          </div>
        </div>
      </header>

      {/* ========== HERO SECTION ========== */}
      <section style={{
        height: '600px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Background Image */}
        <img
          src={heroImageUrl}
          alt="Hero"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        
        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.3) 100%)',
        }} />

        {/* Hero Content */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          color: 'white',
          maxWidth: '800px',
          padding: '0 2rem',
        }}>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            whiteSpace: 'pre-line',
          }}>
            {heroTitle}
          </h1>
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '2rem',
            fontWeight: 400,
            lineHeight: 1.5,
            maxWidth: '600px',
            margin: '0 auto 2rem',
            whiteSpace: 'pre-line',
          }}>
            {heroSubtitle}
          </p>
          
          {/* CTA Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => {
                const portfolioSection = document.getElementById('full-portfolio');
                portfolioSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: primaryColor,
                color: primaryColorText,
                padding: '0.75rem 1.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              View all products
            </button>
            <button
              onClick={() => {
                const howItWorksSection = document.getElementById('how-it-works');
                howItWorksSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                backgroundColor: 'white',
                color: '#1f2937',
                padding: '0.75rem 1.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* ========== TOP PROGRAMS SECTION ========== */}
      {programs.length > 0 && (
        <section ref={shopSectionRef} id="products" style={{
          padding: '3rem 0',
          backgroundColor: backgroundColor,
        }}>
          <div style={{ maxWidth: DESIGN.spacing.container, margin: '0 auto', padding: '0 4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{
                fontFamily: DESIGN.typography.headingFamily,
                fontSize: '2rem',
                fontWeight: 600,
                color: backgroundTextColor,
              }}>
                Top Programs
              </h2>
            </div>

            {/* Programs Grid - Fixed 3 columns - Centered */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1.5rem',
            }}>
              {programs.slice(0, 3).map((program, index) => renderProgramCard(program, index))}
            </div>
          </div>
        </section>
      )}

      {/* ========== HOW IT WORKS SECTION ========== */}
      <section id="how-it-works" style={{
        padding: '3rem 0',
        backgroundColor: backgroundColor,
      }}>
        <div style={{ maxWidth: DESIGN.spacing.container, margin: '0 auto', padding: '0 2rem' }}>
          <div style={{
            backgroundColor: '#f3f0ff',
            borderRadius: DESIGN.borderRadius.large,
            padding: '2.5rem 2rem',
          }}>
          <h2 style={{
            fontFamily: DESIGN.typography.headingFamily,
            fontSize: '2rem',
            fontWeight: 600,
            color: DESIGN.colors.text.primary,
            textAlign: 'center',
            marginBottom: '2.5rem',
          }}>
            How this works
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2rem',
          }}>
            {/* Step 1 */}
            <div style={{
              backgroundColor: DESIGN.colors.white,
              borderRadius: DESIGN.borderRadius.large,
              padding: '2rem',
              boxShadow: DESIGN.shadows.soft,
              width: '100%',
              maxWidth: '100%',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-block',
                  background: primaryColor,
                  color: primaryColorText,
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '2rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}>1</span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: DESIGN.colors.text.primary }}>
                Peptide Selection
              </h3>
              <p style={{ fontSize: '0.875rem', color: DESIGN.colors.text.secondary, marginBottom: '1.5rem' }}>
                Browse our catalog and select the peptides that match your health goals.
              </p>
              {/* Peptide Vials Illustration */}
              <div style={{
                backgroundColor: '#f5f5f5',
                borderRadius: DESIGN.borderRadius.large,
                padding: '1.5rem',
                height: '200px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                position: 'relative',
              }}>
                {/* Left Vial (Background) */}
                <div style={{
                  width: '70px',
                  height: '120px',
                  backgroundColor: '#e8e4d8',
                  borderRadius: '12px',
                  opacity: 0.6,
                  position: 'relative',
                  border: '3px solid #d4ceb8',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '10px',
                }}>
                  <div style={{
                    width: '20px',
                    height: '8px',
                    backgroundColor: '#8b7355',
                    borderRadius: '4px',
                  }} />
                </div>

                {/* Center Vial (Featured) - Inside card */}
                <div style={{
                  backgroundColor: DESIGN.colors.white,
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: '80px',
                    height: '130px',
                    backgroundColor: '#e8e4d8',
                    borderRadius: '12px',
                    border: '3px solid #d4ceb8',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: '10px',
                    marginBottom: '0.75rem',
                  }}>
                    <div style={{
                      width: '22px',
                      height: '10px',
                      backgroundColor: '#8b7355',
                      borderRadius: '4px',
                    }} />
                  </div>
                  <div style={{
                    textAlign: 'center',
                    fontSize: '0.625rem',
                    color: DESIGN.colors.text.secondary,
                    marginBottom: '0.25rem',
                  }}>
                    NAD+ 200mg/mL 6ml
                  </div>
                  <button style={{
                    backgroundColor: DESIGN.colors.white,
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.625rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}>
                    Get Started
                  </button>
                </div>

                {/* Right Vial (Background) */}
                <div style={{
                  width: '70px',
                  height: '120px',
                  backgroundColor: '#e8e4d8',
                  borderRadius: '12px',
                  opacity: 0.6,
                  position: 'relative',
                  border: '3px solid #d4ceb8',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '10px',
                }}>
                  <div style={{
                    width: '20px',
                    height: '8px',
                    backgroundColor: '#8b7355',
                    borderRadius: '4px',
                  }} />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{
              backgroundColor: DESIGN.colors.white,
              borderRadius: DESIGN.borderRadius.large,
              padding: '2rem',
              boxShadow: DESIGN.shadows.soft,
              width: '100%',
              maxWidth: '100%',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-block',
                  background: primaryColor,
                  color: primaryColorText,
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '2rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}>2</span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: DESIGN.colors.text.primary }}>
                Online Consultation
              </h3>
              <p style={{ fontSize: '0.875rem', color: DESIGN.colors.text.secondary, marginBottom: '1.5rem' }}>
                Complete a quick health questionnaire and consult with a licensed provider.
              </p>
              {/* Questionnaire Card Illustration */}
              <div style={{
                backgroundColor: '#f5f5f5',
                borderRadius: DESIGN.borderRadius.large,
                padding: '1rem',
                height: '200px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <div style={{
                  backgroundColor: DESIGN.colors.white,
                  borderRadius: '8px',
                  padding: '0.875rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  width: '100%',
                  maxHeight: '100%',
                  border: '1px solid #e5e5e5',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontSize: '0.5625rem',
                    color: '#ef4444',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    <span style={{ fontSize: '0.4rem' }}>●</span> QUESTION 1/8
                  </div>
                  <p style={{
                    fontSize: '0.75rem',
                    color: DESIGN.colors.text.primary,
                    marginBottom: '0.625rem',
                    fontWeight: 500,
                    lineHeight: 1.3,
                  }}>
                    Have you ever used NAD+ before?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <button style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontWeight: 500,
                    }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                        }} />
                      </div>
                      Yes
                    </button>
                    <button style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: DESIGN.colors.white,
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      color: DESIGN.colors.text.secondary,
                    }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '2px solid #d1d5db',
                        backgroundColor: 'white',
                        flexShrink: 0,
                      }} />
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{
              backgroundColor: DESIGN.colors.white,
              borderRadius: DESIGN.borderRadius.large,
              padding: '2rem',
              boxShadow: DESIGN.shadows.soft,
              width: '100%',
              maxWidth: '100%',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-block',
                  background: primaryColor,
                  color: primaryColorText,
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '2rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}>3</span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: DESIGN.colors.text.primary }}>
                Shipping
              </h3>
              <p style={{ fontSize: '0.875rem', color: DESIGN.colors.text.secondary, marginBottom: '1.5rem' }}>
                Receive your prescription peptides delivered discreetly to your door.
              </p>
              {/* Shipping Confirmation Card Illustration */}
              <div style={{
                backgroundColor: '#f5f5f5',
                borderRadius: DESIGN.borderRadius.large,
                padding: '1rem',
                height: '200px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <div style={{
                  backgroundColor: DESIGN.colors.white,
                  borderRadius: '8px',
                  padding: '0.875rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  width: '100%',
                  maxHeight: '100%',
                  border: '1px solid #e5e5e5',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: DESIGN.colors.text.primary,
                    marginBottom: '0.375rem',
                  }}>
                    Shipping Confirmation
                  </div>
                  <div style={{
                    fontSize: '0.5625rem',
                    color: DESIGN.colors.text.muted,
                    marginBottom: '0.625rem',
                  }}>
                    Tracking Number: 00067829732
                  </div>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    padding: '0.625rem',
                    marginBottom: '0.5rem',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.375rem',
                    }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: DESIGN.colors.text.primary,
                      }}>
                        Hi Jane!
                      </span>
                      <span style={{
                        fontSize: '0.5625rem',
                        backgroundColor: '#d1fae5',
                        color: '#059669',
                        padding: '0.1875rem 0.375rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}>
                        Approved
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.625rem',
                      color: DESIGN.colors.text.secondary,
                      lineHeight: 1.4,
                    }}>
                      Great news, your NAD+ prescription (200 mg/ mL, 6 mL) has been approved and is officially on the way.
                    </p>
                  </div>
                  <p style={{
                    fontSize: '0.625rem',
                    color: DESIGN.colors.text.secondary,
                    lineHeight: 1.4,
                  }}>
                    It has shipped with next day delivery, so you can expected delivery is January 25, 2026.
                  </p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ========== FULL PRODUCT PORTFOLIO ========== */}
      <section id="full-portfolio" style={{
        padding: '3rem 0',
        backgroundColor: backgroundColor,
      }}>
        <div style={{ maxWidth: DESIGN.spacing.container, margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{
                fontFamily: DESIGN.typography.headingFamily,
                fontSize: '2rem',
                fontWeight: 600,
                color: backgroundTextColor,
                marginBottom: '0.75rem',
              }}>
                Full Peptide Portfolio
              </h2>
              <p style={{
                fontSize: '0.9375rem',
                color: backgroundTextColorSecondary,
                lineHeight: 1.6,
                maxWidth: '700px',
              }}>
                A comprehensive list of high-quality peptide formulations available through our partner pharmacies.
              </p>
            </div>

            {/* Category Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: backgroundTextColor === '#000000' ? DESIGN.colors.white : 'rgba(255,255,255,0.10)',
                  border: `1px solid ${backgroundTextColor === '#000000' ? `${DESIGN.colors.text.muted}30` : 'rgba(255,255,255,0.20)'}`,
                  borderRadius: DESIGN.borderRadius.medium,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: backgroundTextColorSecondary,
                  fontWeight: 400,
                }}
              >
                {selectedCategory === 'all' ? 'Category' : formatCategoryName(selectedCategory)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isCategoryDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  backgroundColor: DESIGN.colors.white,
                  borderRadius: DESIGN.borderRadius.medium,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  minWidth: '180px',
                  zIndex: 50,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setSelectedCategory('all'); setIsCategoryDropdownOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      backgroundColor: selectedCategory === 'all' ? DESIGN.colors.cardBackground : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: DESIGN.colors.text.primary,
                    }}
                  >
                    All Categories
                  </button>
                  {productCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setIsCategoryDropdownOpen(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        backgroundColor: selectedCategory === cat ? DESIGN.colors.cardBackground : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: DESIGN.colors.text.primary,
                      }}
                    >
                      {formatCategoryName(cat)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Products Grid - Fixed 4 columns (smaller cards) */}
          {productsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: backgroundTextColorMuted }}>
              Loading products...
            </div>
          ) : filteredProductsForGrid.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: backgroundTextColorMuted }}>
              No products available.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1.5rem',
            }}>
              {filteredProductsForGrid.map((product, index) => renderProductCard(product, index))}
            </div>
          )}
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer id="footer" style={{
        backgroundColor: navFooterColor,
        padding: '4rem 0 2rem',
      }}>
        <div style={{ maxWidth: DESIGN.spacing.container, margin: '0 auto', padding: '0 2rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '2rem',
            marginBottom: '3rem',
          }}>
            {/* Brand Column */}
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: navFooterTextColor,
                marginBottom: '1rem',
              }}>
                {clinicInfo?.name || 'FUSE'}
              </h3>
            </div>

            {/* Footer Categories */}
            {visibleFooterCategories.slice(0, 4).map((category, idx) => (
              <div key={idx}>
                <h4 style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: navFooterTextColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '1rem',
                }}>
                  {category.name}
                </h4>
                {category.urls && category.urls.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {category.urls.map((urlItem, urlIdx) => (
                      <li key={urlIdx} style={{ marginBottom: '0.625rem' }}>
                        <a
                          href={ensureProtocol(urlItem.url)}
                          target={urlItem.url.startsWith('#') || urlItem.url.startsWith('/') ? '_self' : '_blank'}
                          rel="noopener noreferrer"
                          style={{
                            color: navFooterTextColor,
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                        >
                          {urlItem.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Footer Disclaimer */}
          {websiteData?.footerDisclaimer && (
            <div style={{
              borderTop: `1px solid ${navFooterTextColor}30`,
              paddingTop: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: navFooterTextColor,
                opacity: 0.6,
                lineHeight: 1.6,
              }}>
                {websiteData.footerDisclaimer}
              </p>
            </div>
          )}

          {/* Copyright */}
          <div style={{
            borderTop: `1px solid ${navFooterTextColor}30`,
            paddingTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: navFooterTextColor, opacity: 0.6 }}>
              © {new Date().getFullYear()} {clinicInfo?.name || 'FUSE Health'}. All rights reserved.
            </p>

            {/* Social Links */}
            {websiteData?.socialMediaLinks && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                {websiteData.socialMediaLinks.instagram?.enabled && websiteData.socialMediaLinks.instagram?.url && (
                  <a href={ensureProtocol(websiteData.socialMediaLinks.instagram.url)} target="_blank" rel="noopener noreferrer" style={{ color: navFooterTextColor, opacity: 0.6 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                {websiteData.socialMediaLinks.facebook?.enabled && websiteData.socialMediaLinks.facebook?.url && (
                  <a href={ensureProtocol(websiteData.socialMediaLinks.facebook.url)} target="_blank" rel="noopener noreferrer" style={{ color: navFooterTextColor, opacity: 0.6 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                {websiteData.socialMediaLinks.twitter?.enabled && websiteData.socialMediaLinks.twitter?.url && (
                  <a href={ensureProtocol(websiteData.socialMediaLinks.twitter.url)} target="_blank" rel="noopener noreferrer" style={{ color: navFooterTextColor, opacity: 0.6 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                {websiteData.socialMediaLinks.tiktok?.enabled && websiteData.socialMediaLinks.tiktok?.url && (
                  <a href={ensureProtocol(websiteData.socialMediaLinks.tiktok.url)} target="_blank" rel="noopener noreferrer" style={{ color: navFooterTextColor, opacity: 0.6 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                    </svg>
                  </a>
                )}
                {websiteData.socialMediaLinks.youtube?.enabled && websiteData.socialMediaLinks.youtube?.url && (
                  <a href={ensureProtocol(websiteData.socialMediaLinks.youtube.url)} target="_blank" rel="noopener noreferrer" style={{ color: navFooterTextColor, opacity: 0.6 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
