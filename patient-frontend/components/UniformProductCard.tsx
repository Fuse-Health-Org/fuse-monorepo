/**
 * UniformProductCard - Consistent Product Display Component
 * 
 * Ensures all products display with the SAME structure and styling.
 * Only configurable by clients: name and price
 * Everything else (layout, spacing, image display) is fixed for consistency.
 */

import React from 'react';

interface Product {
  id: string;
  tenantProductId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  categories?: string[];
  price: number;
  slug?: string;
  formId?: string;
}

interface UniformProductCardProps {
  product: Product;
  index: number;
  isHovered: boolean;
  isLiked: boolean;
  likeCount: number;
  onHover: () => void;
  onLeave: () => void;
  onLikeClick: (e: React.MouseEvent) => void;
  primaryColor: string;
  renderGetStartedButton: (formId?: string, slug?: string, primaryColor?: string) => React.ReactNode;
}

// Fixed configuration - ensures consistency
const CONFIG = {
  imageAspectRatio: '1/1', // All products use square images
  rectangleColors: ['#004d4d', '#004d4d', '#8b7355', '#8b7355'], // Alternating fallback colors
  fontFamily: 'Georgia, serif',
  crossedOutMultiplier: 1.3, // 30% higher for display
};

// Fixed badge configuration - neutral colors
const BADGE_MAP: { [key: string]: { label: string; color: string } } = {
  'weightloss': { label: 'Weight Loss', color: '#525252' },
  'weight-loss': { label: 'Weight Loss', color: '#525252' },
  'hairgrowth': { label: 'Hair Growth', color: '#6b7280' },
  'hair-growth': { label: 'Hair Growth', color: '#6b7280' },
  'performance': { label: 'Muscle Growth', color: '#4b5563' },
  'recovery': { label: 'Recovery', color: '#525252' },
  'flexibility': { label: 'Flexibility', color: '#6b7280' },
  'sexual-health': { label: 'Sexual Health', color: '#4b5563' },
  'skincare': { label: 'Better Skin', color: '#525252' },
  'wellness': { label: 'Wellness', color: '#6b7280' },
  'energy': { label: 'More Energy', color: '#4b5563' },
  'sleep': { label: 'Better Sleep', color: '#525252' },
};

export const UniformProductCard: React.FC<UniformProductCardProps> = ({
  product,
  index,
  isHovered,
  isLiked,
  onHover,
  onLeave,
  onLikeClick,
  primaryColor,
  renderGetStartedButton,
}) => {
  // Get badges (max 2)
  const badges = getBadges(product);
  
  // Calculate crossed out price
  const crossedOutPrice = (product.price * CONFIG.crossedOutMultiplier).toFixed(2);
  
  // Get fallback color for products without images
  const rectangleColor = CONFIG.rectangleColors[index % CONFIG.rectangleColors.length];

  return (
    <div
      key={product.id}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Like Button - Fixed position */}
      <button
        onClick={onLikeClick}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: isLiked ? '#fee2e2' : 'white',
          border: isLiked ? '1px solid #fca5a5' : '1px solid #e2e8f0',
          borderRadius: '50%',
          width: '2.5rem',
          height: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1,
          transition: 'all 0.2s ease',
        }}
        title={isLiked ? 'Unlike' : 'Like'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={isLiked ? '#ef4444' : 'none'}
          stroke={isLiked ? '#ef4444' : 'currentColor'}
          strokeWidth="2"
          style={{ transition: 'all 0.2s ease' }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      {/* Image Container - Fixed aspect ratio */}
      <div
        style={{
          backgroundColor: '#e8e6e1',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: CONFIG.imageAspectRatio,
          overflow: 'hidden',
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease',
              borderRadius: '0.5rem',
            }}
          />
        ) : (
          <div
            style={{
              width: '10rem',
              height: '12rem',
              backgroundColor: rectangleColor,
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isHovered ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
          >
            <span style={{
              fontFamily: CONFIG.fontFamily,
              color: 'white',
              fontSize: '1.25rem',
              textAlign: 'center',
              padding: '1rem',
            }}>
              {product.name.substring(0, 30)}
            </span>
          </div>
        )}
      </div>

      {/* Product Name */}
      <h3 style={{
        fontFamily: CONFIG.fontFamily,
        fontSize: '1.25rem',
        marginBottom: '0.5rem',
        fontWeight: 400,
        color: isHovered ? '#525252' : 'inherit',
        transition: 'color 0.3s ease',
      }}>
        {product.name}
      </h3>

      {/* Description - Fixed styling */}
      <p style={{
        fontSize: '0.875rem',
        color: '#525252',
        marginBottom: '0.75rem',
        minHeight: '2.5rem',
      }}>
        {product.description || 'Premium health product'}
      </p>

      {/* Price - Fixed styling */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        <span style={{ fontWeight: 600 }}>
          From ${product.price.toFixed(2)}/mo
        </span>
        <span style={{
          fontSize: '0.875rem',
          color: '#737373',
          textDecoration: 'line-through',
        }}>
          ${crossedOutPrice}*
        </span>
      </div>

      {/* Badges - Fixed styling */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}>
        {badges.map((badge, idx) => (
          <span
            key={idx}
            style={{
              backgroundColor: badge.color,
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {badge.label}
          </span>
        ))}
      </div>

      {/* Get Started Button */}
      {renderGetStartedButton(product.formId, product.slug, primaryColor)}
    </div>
  );
};

// Helper function to get badges - ensures max 2 badges per product
function getBadges(product: Product): Array<{ label: string; color: string }> {
  const categories = product.categories || [product.category] || [];
  
  const badges = categories
    .map((cat: string) => {
      const normalized = cat.toLowerCase().replace(/\s+/g, '-');
      return BADGE_MAP[normalized];
    })
    .filter(Boolean)
    .slice(0, 2); // Max 2 badges

  // Default badge if none found
  if (badges.length === 0) {
    badges.push({ label: 'Wellness', color: '#6b7280' });
  }

  return badges;
}
