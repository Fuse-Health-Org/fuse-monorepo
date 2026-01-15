import React from "react";
import { useDashboardPrefix } from "../hooks/useClinicFromDomain";

interface GetStartedButtonProps {
  formId?: string | null;
  slug?: string;
  primaryColor?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  variant?: "default" | "pill";
}

export default function GetStartedButton({
  formId,
  slug,
  primaryColor = "#004d4d",
  disabled = false,
  style = {},
  variant = "default",
}: GetStartedButtonProps) {
  const { buildRoute } = useDashboardPrefix();
  const isEnabled = formId && slug && !disabled;

  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: variant === "pill" ? "0.75rem 1.5rem" : "0.5rem 1.25rem",
    borderRadius: variant === "pill" ? "25px" : "0.25rem",
    fontSize: variant === "pill" ? "0.9rem" : "0.875rem",
    fontWeight: variant === "pill" ? 500 : 600,
    textDecoration: "none",
    cursor: isEnabled ? "pointer" : "not-allowed",
    border: "none",
    ...style,
  };

  if (isEnabled) {
    return (
      <a
        href={buildRoute(`/my-products/${formId}/${slug}`)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...baseStyles,
          backgroundColor: primaryColor,
          color: "white",
        }}
      >
        Get Started
      </a>
    );
  }

  return (
    <button
      disabled
      style={{
        ...baseStyles,
        backgroundColor: "#9ca3af",
        color: "white",
      }}
    >
      Coming Soon
    </button>
  );
}

