import { APP_TAGLINE, LOGO_ALT, LOGO_PATH, BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  /** `light` = transparent mark for dark backgrounds (no white plate) */
  variant?: "default" | "light";
  showTagline?: boolean;
  className?: string;
}

const heights = {
  sm: "h-9 w-auto max-w-[150px]",
  md: "h-11 w-auto max-w-[180px]",
  lg: "h-14 w-auto max-w-[240px]",
};

const LOGO_LIGHT = "/one-source-logo-light.png";

export function BrandLogo({
  size = "md",
  variant = "default",
  showTagline = false,
  className,
}: BrandLogoProps) {
  const src = variant === "light" ? LOGO_LIGHT : LOGO_PATH;

  return (
    <div className={cn("flex flex-col", className)}>
      <img
        src={src}
        alt={LOGO_ALT}
        className={cn("object-contain object-left", heights[size])}
        width={240}
        height={160}
      />
      {showTagline && (
        <p className="mt-1 text-[11px] font-medium" style={{ color: BRAND.forest }}>
          {APP_TAGLINE}
        </p>
      )}
    </div>
  );
}
