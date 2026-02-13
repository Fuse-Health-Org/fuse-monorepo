import type { CSSProperties } from "react";
import { ThemePalette } from "./types";

const DEFAULT_THEME_COLOR = "#047857";

const isValidHex = (value?: string | null): value is string => {
    if (!value) return false;
    return /^#?([0-9A-F]{3}){1,2}$/i.test(value.trim());
};

const isGradient = (value?: string | null): value is string => {
    if (!value) return false;
    return value.trim().startsWith('linear-gradient(');
};

const extractFirstColorFromGradient = (gradient: string): string | null => {
    // Match the first hex color in the gradient
    const hexMatch = gradient.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
    return hexMatch ? hexMatch[0] : null;
};

const normalizeHex = (hex: string): string => {
    const cleaned = hex.trim().replace(/^#/, "");
    if (cleaned.length === 3) {
        return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toUpperCase();
    }
    return `#${cleaned.toUpperCase()}`;
};

const hexToRgb = (hex: string) => {
    const normalized = normalizeHex(hex).replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
};

const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
        .map((x) => {
            const clamped = Math.max(0, Math.min(255, Math.round(x)));
            const hex = clamped.toString(16);
            return hex.length === 1 ? `0${hex}` : hex;
        })
        .join("")}`.toUpperCase();

const lighten = (hex: string, amount: number) => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(
        r + (255 - r) * amount,
        g + (255 - g) * amount,
        b + (255 - b) * amount
    );
};

const darken = (hex: string, amount: number) => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
};

export const createTheme = (color?: string | null): ThemePalette => {
    let base: string;
    let gradient: string | undefined;

    if (isGradient(color)) {
        // If it's a gradient, extract the first color for base theme calculations
        const extractedColor = extractFirstColorFromGradient(color);
        base = extractedColor && isValidHex(extractedColor) 
            ? normalizeHex(extractedColor) 
            : DEFAULT_THEME_COLOR;
        gradient = color; // Store the original gradient
    } else if (isValidHex(color)) {
        base = normalizeHex(color);
    } else {
        base = DEFAULT_THEME_COLOR;
    }

    return {
        primary: gradient || base, // Use gradient if available, otherwise solid color
        primaryDark: darken(base, 0.15),
        primaryDarker: darken(base, 0.3),
        primaryLight: lighten(base, 0.65),
        primaryLighter: lighten(base, 0.85),
        text: darken(base, 0.2),
        gradient, // Add gradient property for direct use
    };
};

export const buildThemeVars = (theme: ThemePalette): CSSProperties & Record<`--${string}`, string> => {
    const vars: any = {
        "--q-primary": theme.primary,
        "--q-primary-dark": theme.primaryDark,
        "--q-primary-darker": theme.primaryDarker,
        "--q-primary-light": theme.primaryLight,
        "--q-primary-lighter": theme.primaryLighter,
        "--q-primary-text": theme.text,
    };
    
    if (theme.gradient) {
        vars["--q-primary-gradient"] = theme.gradient;
    }
    
    return vars;
};

export { isValidHex, normalizeHex, lighten, darken };


