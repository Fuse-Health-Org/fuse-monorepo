"use client";

import React, { useRef, useEffect, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[]; componentRestrictions?: { country: string }; fields?: string[] }
          ) => {
            addListener: (event: string, fn: () => void) => void;
            getPlace: () => {
              address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
              formatted_address?: string;
            };
          };
        };
      };
    };
  }
}

export interface AddressAutocompleteFields {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface AddressAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  onAddressSelect?: (fields: AddressAutocompleteFields) => void;
  country?: string;
  placeholder?: string;
  label?: string;
  isRequired?: boolean;
  disabled?: boolean;
  "data-testid"?: string;
  className?: string;
  id?: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const SCRIPT_URL = API_KEY ? `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places` : "";

type PlaceAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const getComponent = (components: PlaceAddressComponent[], type: string): PlaceAddressComponent | undefined => {
  return components.find((component) => component.types.includes(type));
};

export function AddressAutocomplete({
  value,
  onValueChange,
  onAddressSelect,
  country = "us",
  placeholder = "Start typing your address",
  label = "Street Address",
  isRequired,
  disabled,
  "data-testid": dataTestId,
  className = "",
  id,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<unknown>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const onValueChangeRef = useRef(onValueChange);
  const onAddressSelectRef = useRef(onAddressSelect);
  onValueChangeRef.current = onValueChange;
  onAddressSelectRef.current = onAddressSelect;

  useEffect(() => {
    if (typeof window !== "undefined" && window.google?.maps?.places) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !window.google?.maps?.places || !inputRef.current || autocompleteRef.current) return;

    const input = inputRef.current;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      types: ["address"],
      componentRestrictions: { country: country === "us" ? "us" : country },
      fields: ["address_components", "formatted_address"],
    });

    const preventSubmit = (e: KeyboardEvent) => {
      if (e.key === "Enter") e.preventDefault();
    };
    input.addEventListener("keydown", preventSubmit);
    const cleanupKeydown = () => input.removeEventListener("keydown", preventSubmit);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const components = place.address_components;
      if (!components?.length) return;

      const streetNumber = getComponent(components, "street_number")?.long_name || "";
      const route = getComponent(components, "route")?.long_name || "";
      const premise = getComponent(components, "premise")?.long_name || "";
      const locality =
        getComponent(components, "locality")?.long_name ||
        getComponent(components, "postal_town")?.long_name ||
        getComponent(components, "sublocality_level_1")?.long_name ||
        getComponent(components, "administrative_area_level_2")?.long_name ||
        "";
      const state =
        getComponent(components, "administrative_area_level_1")?.short_name?.toUpperCase() ||
        getComponent(components, "administrative_area_level_2")?.short_name?.toUpperCase() ||
        "";
      const postalCode = getComponent(components, "postal_code")?.long_name || "";
      const postalCodeSuffix = getComponent(components, "postal_code_suffix")?.long_name || "";
      const zipCode = postalCodeSuffix ? `${postalCode}-${postalCodeSuffix}` : postalCode;
      const countryCode = (getComponent(components, "country")?.short_name || "").toLowerCase();

      const addressLine1 =
        [streetNumber, route].filter(Boolean).join(" ").trim() ||
        route ||
        premise ||
        place.formatted_address ||
        "";
      onValueChangeRef.current(addressLine1);

      const cb = onAddressSelectRef.current;
      if (cb) {
        cb({
          address: addressLine1,
          city: locality || undefined,
          state: state || undefined,
          zipCode: zipCode || undefined,
          country: countryCode || undefined,
        });
      }
    });

    autocompleteRef.current = autocomplete;
    return () => {
      cleanupKeydown();
      autocompleteRef.current = null;
    };
  }, [scriptLoaded, country]);

  if (!API_KEY) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {isRequired && <span className="text-danger"> *</span>}
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          required={isRequired}
          disabled={disabled}
          data-testid={dataTestId}
          id={id}
          className="w-full px-3 py-2 bg-default-100 border border-default-200 rounded-lg outline-none focus:border-primary transition-colors"
        />
      </div>
    );
  }

  return (
    <>
      {SCRIPT_URL && (
        <Script
          src={SCRIPT_URL}
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      )}
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {isRequired && <span className="text-danger"> *</span>}
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          required={isRequired}
          disabled={disabled}
          data-testid={dataTestId}
          id={id}
          autoComplete="off"
          className="w-full px-3 py-2 bg-default-100 border border-default-200 rounded-lg outline-none focus:border-primary transition-colors"
        />
      </div>
    </>
  );
}
