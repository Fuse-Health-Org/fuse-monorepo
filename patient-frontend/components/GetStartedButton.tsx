import React from "react";
import { useDashboardPrefix } from "../hooks/useClinicFromDomain";

interface GetStartedButtonProps {
  formId?: string | null;
  slug?: string;
  primaryColor?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  variant?: "default" | "pill";
  label?: string;
}

export default function GetStartedButton({
  formId,
  slug,
  primaryColor = "#374151",
  disabled = false,
  style = {},
  variant = "default",
  label,
}: GetStartedButtonProps) {
  const { buildRoute } = useDashboardPrefix();
  const isEnabled = formId && slug && !disabled;

  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: variant === "pill" ? "0.5rem 1rem" : "0.5rem 1.25rem",
    borderRadius: variant === "pill" ? "9999px" : "0.25rem",
    fontSize: variant === "pill" ? "0.8125rem" : "0.875rem",
    fontWeight: 500,
    textDecoration: "none",
    cursor: isEnabled ? "pointer" : "not-allowed",
    transition: "all 0.2s ease",
  };

  const buttonLabel = label || (variant === "pill" ? "Buy now" : "Get Started");
  const disabledLabel = "Coming Soon";

  if (isEnabled) {
    const [isHovered, setIsHovered] = React.useState(false);
    
    // Determine if this is an outline button (has transparent background)
    const isOutlineButton = style.background === 'transparent' || style.backgroundColor === 'transparent';
    const isGradient = primaryColor?.includes('linear-gradient');
    
    // Extract solid color from gradient for text
    const getSolidColor = (color: string) => {
      if (color?.includes('linear-gradient')) {
        const hexMatch = color.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
        return hexMatch ? hexMatch[0] : color;
      }
      return color;
    };
    
    const solidColor = getSolidColor(primaryColor);
    
    // If it's an outline button with gradient, use wrapper technique
    if (isOutlineButton && isGradient) {
      return (
        <div
          style={{
            background: primaryColor,
            padding: '2px',
            borderRadius: variant === "pill" ? "9999px" : "0.25rem",
            display: 'inline-flex',
          }}
        >
          <a
            href={buildRoute(`/my-products/${formId}/${slug}`)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              ...baseStyles,
              background: isHovered ? primaryColor : 'white',
              color: isHovered ? 'white' : (style.color || solidColor),
              border: 'none',
              borderRadius: variant === "pill" ? "9999px" : "0.25rem",
            }}
          >
            {buttonLabel}
          </a>
        </div>
      );
    }
    
    return (
      <a
        href={buildRoute(`/my-products/${formId}/${slug}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          ...baseStyles,
          background: isOutlineButton 
            ? (isHovered ? primaryColor : 'transparent')
            : (style.background || style.backgroundColor || primaryColor),
          color: isOutlineButton 
            ? (isHovered ? 'white' : (style.color || solidColor))
            : (style.color || "white"),
          border: style.border || "none",
        }}
      >
        {buttonLabel}
      </a>
    );
  }

  return (
    <button
      disabled
      style={{
        ...baseStyles,
        backgroundColor: "#e5e5e5",
        color: "#9ca3af",
        border: "none",
      }}
    >
      {disabledLabel}
    </button>
  );
}

