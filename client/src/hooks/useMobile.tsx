import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Stage 4: Optimized useIsMobile hook (Note 1 - 4)
 * Uses MediaQueryList.matches for consistent breakpoint detection.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Stage 1: Define the media query list
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Stage 2: Synchronize matches (Note 1 Fix)
    const onChange = () => {
      setIsMobile(mql.matches);
    };

    // Initial check (Note 2 Flicker Awareness)
    onChange();

    // Stage 3: Modern event listener (Note 4)
    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Returns false for desktop, true for mobile, and false on 1st render (Hydration Safe)
  return !!isMobile;
}
