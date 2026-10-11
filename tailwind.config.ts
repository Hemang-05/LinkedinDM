import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        linkedin: {
          DEFAULT: "rgb(10, 102, 194)",
          blue: "rgb(10, 102, 194)",
          hover: "rgb(0, 65, 130)",
          active: "#095196",
          light: "#EBF3FB",
          bg: "#F4F2EE",
          border: "#E0DFDC",
          card: "#FFFFFF",
          text: "rgba(0, 0, 0, 0.9)",
          muted: "rgba(0, 0, 0, 0.6)"
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-source-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif"
        ],
        logo: ["'Avenir Black'", "'Avenir Next'", "Arial Black", "sans-serif"],
      },
      screens: {
        xs: "375px",
      },
    },
  },
  plugins: [],
};
export default config;
