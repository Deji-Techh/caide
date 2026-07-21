import { createContext, useContext, useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readSavedTheme(): Theme | null {
  try {
    const storage = window.localStorage;
    if (typeof storage?.getItem !== "function") return null;
    return storage.getItem("theme") as Theme | null;
  } catch {
    return null;
  }
}

function saveTheme(theme: Theme): void {
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
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = readSavedTheme();
    // CAIDE exposes two deliberate visual modes. Older "system" preferences
    // migrate to the neutral grey workspace instead of changing unexpectedly.
    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    // Save theme preference to localStorage
    saveTheme(theme);

    // Handle system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const root = window.document.documentElement;
      const isDark =
        theme === "dark" || (theme === "system" && mediaQuery.matches);

      root.classList.remove("light", "dark");
      root.classList.add(isDark ? "dark" : "light");
    };

    applyTheme();

    // Listen for system theme changes
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

  // Determine if dark mode is active when component mounts or theme changes
  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setIsDarkMode(
        theme === "dark" || (theme === "system" && darkModeQuery.matches),
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
