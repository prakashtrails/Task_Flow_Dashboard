import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0F1117",
        surface: "#1A1D27",
        elevated: "#22263A",
        line: "#2E3350",
        primary: "#6C8EF5",
        ink: "#E8EAF6",
        muted: "#7B82A8",
      },
      fontFamily: {
        sans: ["var(--font-dm)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
