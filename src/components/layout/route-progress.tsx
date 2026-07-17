"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Thin top progress bar while route changes — avoids a blank main area on navigation. */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const done = window.setTimeout(() => setActive(false), 450);
    return () => window.clearTimeout(done);
  }, [pathname]);

  if (!active) return null;

  return (
    <div className="route-progress" aria-hidden>
      <div className="route-progress-bar" />
    </div>
  );
}
