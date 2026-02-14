import React from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { Icon } from "@iconify/react";

// US States data with full names and abbreviations
export const US_STATES = [
  { value: "AL", label: "Alabama", key: "AL" },
  { value: "AK", label: "Alaska", key: "AK" },
  { value: "AZ", label: "Arizona", key: "AZ" },
  { value: "AR", label: "Arkansas", key: "AR" },
  { value: "CA", label: "California", key: "CA" },
  { value: "CO", label: "Colorado", key: "CO" },
  { value: "CT", label: "Connecticut", key: "CT" },
  { value: "DE", label: "Delaware", key: "DE" },
  { value: "FL", label: "Florida", key: "FL" },
  { value: "GA", label: "Georgia", key: "GA" },
  { value: "HI", label: "Hawaii", key: "HI" },
  { value: "ID", label: "Idaho", key: "ID" },
  { value: "IL", label: "Illinois", key: "IL" },
  { value: "IN", label: "Indiana", key: "IN" },
  { value: "IA", label: "Iowa", key: "IA" },
  { value: "KS", label: "Kansas", key: "KS" },
  { value: "KY", label: "Kentucky", key: "KY" },
  { value: "LA", label: "Louisiana", key: "LA" },
  { value: "ME", label: "Maine", key: "ME" },
  { value: "MD", label: "Maryland", key: "MD" },
  { value: "MA", label: "Massachusetts", key: "MA" },
  { value: "MI", label: "Michigan", key: "MI" },
  { value: "MN", label: "Minnesota", key: "MN" },
  { value: "MS", label: "Mississippi", key: "MS" },
  { value: "MO", label: "Missouri", key: "MO" },
  { value: "MT", label: "Montana", key: "MT" },
  { value: "NE", label: "Nebraska", key: "NE" },
  { value: "NV", label: "Nevada", key: "NV" },
  { value: "NH", label: "New Hampshire", key: "NH" },
  { value: "NJ", label: "New Jersey", key: "NJ" },
  { value: "NM", label: "New Mexico", key: "NM" },
  { value: "NY", label: "New York", key: "NY" },
  { value: "NC", label: "North Carolina", key: "NC" },
  { value: "ND", label: "North Dakota", key: "ND" },
  { value: "OH", label: "Ohio", key: "OH" },
  { value: "OK", label: "Oklahoma", key: "OK" },
  { value: "OR", label: "Oregon", key: "OR" },
  { value: "PA", label: "Pennsylvania", key: "PA" },
  { value: "RI", label: "Rhode Island", key: "RI" },
  { value: "SC", label: "South Carolina", key: "SC" },
  { value: "SD", label: "South Dakota", key: "SD" },
  { value: "TN", label: "Tennessee", key: "TN" },
  { value: "TX", label: "Texas", key: "TX" },
  { value: "UT", label: "Utah", key: "UT" },
  { value: "VT", label: "Vermont", key: "VT" },
  { value: "VA", label: "Virginia", key: "VA" },
  { value: "WA", label: "Washington", key: "WA" },
  { value: "WV", label: "West Virginia", key: "WV" },
  { value: "WI", label: "Wisconsin", key: "WI" },
  { value: "WY", label: "Wyoming", key: "WY" },
  { value: "DC", label: "District of Columbia", key: "DC" },
  { value: "PR", label: "Puerto Rico", key: "PR" },
];

interface USStateAutocompleteProps {
  questionId: string;
  questionText: string;
  isRequired?: boolean;
  value: string;
  error?: string;
  helpText?: string;
  theme: any;
  onChange: (questionId: string, value: string) => void;
}

export const USStateAutocomplete: React.FC<USStateAutocompleteProps> = ({
  questionId,
  questionText,
  isRequired = false,
  value,
  error,
  helpText,
  theme,
  onChange,
}) => {
  // Find the selected state object
  const selectedState = US_STATES.find((s) => s.value === value);
  
  // Ref to measure trigger width and position for perfect alignment
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);
  const [triggerLeft, setTriggerLeft] = React.useState<number | undefined>(undefined);

  // Measure trigger width and position on mount and window resize
  React.useEffect(() => {
    const measureTrigger = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTriggerWidth(rect.width);
        setTriggerLeft(rect.left);
        console.log('📏 Measured trigger - width:', rect.width, 'left:', rect.left);
      }
    };

    measureTrigger();
    window.addEventListener('resize', measureTrigger);
    window.addEventListener('scroll', measureTrigger);
    return () => {
      window.removeEventListener('resize', measureTrigger);
      window.removeEventListener('scroll', measureTrigger);
    };
  }, []);

  const handleSelectionChange = (key: React.Key | null) => {
    console.log('✅ State selected from dropdown:', key);
    if (key) {
      const selectedState = US_STATES.find((s) => s.key === key);
      if (selectedState) {
        onChange(questionId, selectedState.value);
      }
    } else {
      onChange(questionId, "");
    }
  };

  // Generate unique ID for this instance to target styles
  const instanceId = `state-select-${questionId}`;

  // Add global styles for dropdown (since it might render in a portal)
  React.useEffect(() => {
    const styleId = `${instanceId}-global-styles`;
    let style = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    
      style.innerHTML = `
        /* Prevent layout shift and lock position */
        .dropdown-fixed-position,
        [data-slot="popover"] {
          position: fixed !important;
          transition: none !important;
          animation: none !important;
          transform-origin: top left !important;
          will-change: auto !important;
          ${triggerWidth && triggerLeft !== undefined ? `
            width: ${triggerWidth}px !important; 
            min-width: ${triggerWidth}px !important; 
            max-width: ${triggerWidth}px !important;
            left: ${triggerLeft}px !important;
            transform: none !important;
          ` : ''}
        }
        
        /* Lock horizontal position - prevent ANY shifts */
        [data-slot="popover"][data-open="true"] {
          ${triggerLeft !== undefined ? `left: ${triggerLeft}px !important;` : ''}
        }
        
        /* Ensure dropdown content matches trigger width exactly */
        .dropdown-content-fixed,
        [data-slot="popover"] > div,
        [data-slot="popover"] [data-slot="base"],
        [data-slot="popover"] [role="dialog"] {
          ${triggerWidth ? `
            width: ${triggerWidth}px !important; 
            min-width: ${triggerWidth}px !important; 
            max-width: ${triggerWidth}px !important;
            box-sizing: border-box !important;
          ` : 'width: 100% !important;'}
        }
        
        /* Prevent content from affecting position */
        [data-slot="popover"] [role="listbox"] {
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        
        /* Global styles for state autocomplete dropdown - theme colors with rounded boxes */
        [data-slot="popover"][data-open="true"] [role="listbox"] li {
          padding: 12px 16px !important;
          border-radius: 12px !important;
          margin: 2px 8px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          border: 2px solid transparent !important;
          background-color: white !important;
        }
        
        [data-slot="popover"][data-open="true"] [role="listbox"] li:hover,
        [data-slot="popover"][data-open="true"] [role="listbox"] li[data-hover="true"] {
          background-color: ${theme.primaryLight} !important;
          border-color: ${theme.primaryLight} !important;
        }
        
        [data-slot="popover"][data-open="true"] [role="listbox"] li[data-selected="true"],
        [data-slot="popover"][data-open="true"] [role="listbox"] li[aria-selected="true"] {
          background-color: ${theme.primaryLight} !important;
          border: 2px solid ${theme.primaryDark} !important;
        }
        
        [data-slot="popover"][data-open="true"] [role="listbox"] li[data-focus="true"],
        [data-slot="popover"][data-open="true"] [role="listbox"] li:focus {
          background-color: ${theme.primaryLight} !important;
          border-color: ${theme.primaryLight} !important;
          outline: none !important;
        }
      `;
    
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [theme, instanceId, triggerWidth, triggerLeft]);

  return (
    <div className="space-y-3 w-full" id={instanceId}>
      <style dangerouslySetInnerHTML={{__html: `
        /* Ensure base container is full width */
        #${instanceId} {
          width: 100% !important;
          position: relative !important;
        }
        
        /* Input wrapper/container - simple gray border, no colored border */
        #${instanceId} .state-autocomplete-wrapper {
          width: 100% !important;
          display: block !important;
        }
        
        #${instanceId} .state-autocomplete-wrapper,
        #${instanceId} [data-slot="input-wrapper"],
        #${instanceId} button {
          width: 100% !important;
          border: 2px solid #E5E7EB !important;
          border-radius: 16px !important;
          transition: border-color 0.2s ease !important;
          background-color: white !important;
          transform: translate3d(0, 0, 0) !important;
          backface-visibility: hidden !important;
        }
        
        #${instanceId} .state-autocomplete-wrapper:hover,
        #${instanceId} [data-slot="input-wrapper"]:hover {
          border-color: #D1D5DB !important;
        }
        
        #${instanceId} .state-autocomplete-wrapper:focus-within,
        #${instanceId} [data-slot="input-wrapper"]:focus-within {
          border-color: #9CA3AF !important;
          box-shadow: none !important;
        }
        
        /* Input field itself - no border, transparent */
        #${instanceId} input {
          border: none !important;
          padding: 16px !important;
          font-size: 16px !important;
          background-color: transparent !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        #${instanceId} input:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        
        /* Target HeroUI dropdown items - theme colors with rounded boxes */
        #${instanceId} [role="listbox"] [role="option"],
        #${instanceId} li[role="option"],
        [data-slot="list"] li[data-key] {
          padding: 12px 16px !important;
          border-radius: 12px !important;
          margin: 2px 8px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          border: 2px solid transparent !important;
          background-color: white !important;
        }
        
        /* Hover state - theme colored background */
        #${instanceId} [role="listbox"] [role="option"]:hover,
        #${instanceId} [role="listbox"] [role="option"][data-hover="true"],
        #${instanceId} li[role="option"]:hover,
        [data-slot="list"] li[data-key]:hover {
          background-color: ${theme.primaryLight} !important;
          border-color: ${theme.primaryLight} !important;
        }
        
        /* Selected state - theme colored with stronger border */
        #${instanceId} [role="listbox"] [role="option"][data-selected="true"],
        #${instanceId} [role="listbox"] [role="option"][aria-selected="true"],
        #${instanceId} li[role="option"][data-selected="true"],
        [data-slot="list"] li[data-key][data-selected="true"] {
          background-color: ${theme.primaryLight} !important;
          border: 2px solid ${theme.primaryDark} !important;
        }
        
        /* Focus state (keyboard navigation) - theme colored */
        #${instanceId} [role="listbox"] [role="option"][data-focus="true"],
        #${instanceId} [role="listbox"] [role="option"]:focus,
        #${instanceId} li[role="option"]:focus,
        [data-slot="list"] li[data-key]:focus {
          background-color: ${theme.primaryLight} !important;
          border-color: ${theme.primaryLight} !important;
          outline: none !important;
        }
        
        /* Dropdown container styling */
        #${instanceId} [data-slot="popoverContent"] {
          border-radius: 16px !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
          padding: 8px !important;
        }
      `}} />

      <label 
        htmlFor={questionId}
        className="block text-sm font-medium" 
        style={{ color: "var(--q-primary-text)" }}
      >
        {questionText}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
        {!isRequired && <span className="text-gray-500 text-xs ml-2">*Not required</span>}
      </label>

      <div ref={triggerRef} className="w-full">
        <Autocomplete
        key={`autocomplete-${questionId}-${value || 'empty'}`}
        id={questionId}
        aria-label={questionText}
        placeholder="Type to search states..."
        selectedKey={value || null}
        defaultInputValue={selectedState?.label || ""}
        onSelectionChange={handleSelectionChange}
        allowsCustomValue={false}
        isRequired={isRequired}
        isInvalid={!!error}
        errorMessage={error}
        variant="bordered"
        radius="lg"
        size="lg"
        className="w-full state-autocomplete-wrapper"
        classNames={{
          base: "w-full",
          listboxWrapper: "max-h-[300px] px-2",
          popoverContent: "rounded-2xl w-full",
          selectorButton: "w-full",
          input: "text-base",
        }}
        startContent={
          <Icon 
            icon="mdi:map-marker" 
            className="text-gray-400"
            width={20}
            height={20}
          />
        }
        listboxProps={{
          emptyContent: "No states found",
        }}
        popoverProps={{
          offset: 8,
          placement: "bottom-start",
          shouldFlip: false,
          disableAnimation: true,
          strategy: "fixed",
          classNames: {
            base: "dropdown-fixed-position",
            content: "dropdown-content-fixed"
          },
          motionProps: {
            initial: { opacity: 1 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0 }
          }
        }}
        menuTrigger="focus"
        style={{
          // @ts-ignore - CSS variables work at runtime
          "--nextui-focus": "#9CA3AF",
          "--nextui-primary": "#9CA3AF",
        } as React.CSSProperties}
      >
        {US_STATES.map((state) => (
          <AutocompleteItem 
            key={state.key} 
            value={state.value}
            textValue={state.label}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="font-medium text-gray-900">{state.label}</span>
              <span className="text-xs text-gray-500 font-mono">{state.value}</span>
            </div>
          </AutocompleteItem>
        ))}
        </Autocomplete>
      </div>

      {helpText && !error && (
        <p className="text-sm text-gray-600">{helpText}</p>
      )}
    </div>
  );
};
