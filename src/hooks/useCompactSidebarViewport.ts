"use client";

import { useEffect, useState } from "react";

/** Sidebar «compact» mode: same breakpoints as storage dock (narrow or short viewport). */
export function useCompactSidebarViewport() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mqW = window.matchMedia("(max-width: 767px)");
    const mqH = window.matchMedia("(max-height: 720px)");
    const update = () => setCompact(mqW.matches || mqH.matches);
    update();
    mqW.addEventListener("change", update);
    mqH.addEventListener("change", update);
    return () => {
      mqW.removeEventListener("change", update);
      mqH.removeEventListener("change", update);
    };
  }, []);

  return compact;
}
