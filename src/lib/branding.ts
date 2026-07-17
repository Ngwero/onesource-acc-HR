export const APP_NAME = "One Source Accounting System";
export const APP_SHORT_NAME = "One Source";
export const APP_TAGLINE = "Accounting System";
export const HR_APP_NAME = "One Source Human Resources";
export const HR_APP_TAGLINE = "Human Resources";
export const LOGO_PATH = "/one-source-logo.png";
export const LOGO_ALT = "One Source logo";

/** Official brand palette from the One Source logo */
export const BRAND = {
  lime: "#78B028",
  limeDark: "#68A020",
  forest: "#105820",
  forestDeep: "#0C4518",
  mist: "#F3F8F0",
  soft: "#E8F2E0",
  ink: "#0F1F12",
  muted: "#5A6B5E",
  white: "#FFFFFF",
} as const;

export function absoluteLogoUrl(baseUrl?: string) {
  const base = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002").replace(
    /\/$/,
    ""
  );
  return `${base}${LOGO_PATH}`;
}
