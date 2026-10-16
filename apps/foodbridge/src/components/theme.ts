"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "@/lib/themeScript";

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

function resolve(pref: ThemePref): Theme {
  if (pref === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref;
}

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    window.localStorage.setItem(KEY, pref);
  } catch {
    // Not persisted; the theme still applies for this page view.
  }
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

/** The theme currently on <html>, kept in sync when the user switches it. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
