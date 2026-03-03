import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        sidebar: {
          bg: "var(--sidebar-bg)",
          active: "var(--sidebar-active)",
          text: "var(--sidebar-text)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          border: "var(--card-border)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        card: "0.75rem",
      },
      boxShadow: {
        card: "var(--shadow-md)",
        "card-hover": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
export default config;
