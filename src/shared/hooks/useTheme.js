import { useState } from "react";

import { applyTheme, getInitialTheme } from "../theme/theme.js";

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return { theme, toggleTheme };
}
