import { createContext, useContext, useEffect, useState } from "react";
import {
  isUiThemeId,
  type UiThemeId,
} from "@/lib/uiThemes";

interface ThemeContextType {
  theme: UiThemeId;
  setTheme: (theme: UiThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readSavedTheme(): UiThemeId | null {
  try {
    const storage = window.localStorage;
    if (typeof storage?.getItem !== "function") return null;
    const stored = storage.getItem("theme");
    if (stored === "dark") return "graphite";
    return isUiThemeId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function saveTheme(theme: UiThemeId): void {
  try {
    const storage = window.localStorage;
    if (typeof storage?.setItem === "function") {
      storage.setItem("theme", theme);
    }
  } catch {
    // The selected theme still applies for this session when storage is blocked.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<UiThemeId>(() => {
    const savedTheme = readSavedTheme();
    return savedTheme ?? "graphite";
  });

  useEffect(() => {
    saveTheme(theme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const root = window.document.documentElement;
      const isDark =
        theme === "system"
          ? mediaQuery.matches
          : theme !== "light";
      const resolvedTheme =
        theme === "system"
          ? mediaQuery.matches
            ? "graphite"
            : "light"
          : theme;

      root.classList.remove("light", "dark");
      root.classList.add(isDark ? "dark" : "light");
      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme();

    const listener = () => applyTheme();
    mediaQuery.addEventListener("change", listener);

    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { theme, setTheme } = context;

  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setIsDarkMode(
        theme === "system"
          ? darkModeQuery.matches
          : theme !== "light",
      );
    };

    updateTheme();
    darkModeQuery.addEventListener("change", updateTheme);

    return () => {
      darkModeQuery.removeEventListener("change", updateTheme);
    };
  }, [theme]);
  return { theme, isDarkMode, setTheme };
}
