import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        surface2: "hsl(var(--surface2))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary) / 0.4)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        info: "hsl(var(--info))",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        soft: "0 2px 8px hsl(224 71% 4% / 0.08)",
        medium: "0 4px 16px hsl(224 71% 4% / 0.12)",
        large: "0 8px 32px hsl(224 71% 4% / 0.16)",
        glow: "0 0 24px hsl(var(--primary) / 0.3)",
        "glow-lg": "0 0 48px hsl(var(--primary) / 0.4)",
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
      height: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
