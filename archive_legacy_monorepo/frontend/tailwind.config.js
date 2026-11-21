/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["'Noto Sans Khmer'", "system-ui", "sans-serif"] },
      colors: { angkor: { gold: "#D4A017", deep: "#1A1A2E", accent: "#7C3AED" } },
    },
  },
  plugins: [],
};
