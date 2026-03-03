"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button variant="glass" size="icon" onClick={cycle} className="h-10 w-10">
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {theme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </motion.div>
    </Button>
  );
}
