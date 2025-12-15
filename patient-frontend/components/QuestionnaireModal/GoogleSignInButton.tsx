import React from 'react';
import { Icon } from "@iconify/react";

interface GoogleSignInButtonProps {
  clinicId?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ clinicId }) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent default form submission
    e.stopPropagation(); // Stop event bubbling

    // Get current URL to return to after OAuth, only path, no query params
    const returnUrl = window.location.origin + window.location.pathname;

    // Redirect to backend OAuth initiation
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const params = new URLSearchParams({
      returnUrl,
      ...(clinicId && { clinicId })
    });

    console.log('🔵 [GOOGLE] Redirecting to:', `${apiUrl}/auth/google/login?${params.toString()}`);
    window.location.href = `${apiUrl}/auth/google/login?${params.toString()}`;
  };

  return (
    <button
      type="button" // Explicitly set type to button to prevent form submission
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
    >
      <Icon icon="flat-color-icons:google" className="text-xl" />
      <span>Continue with Google</span>
    </button>
  );
};
