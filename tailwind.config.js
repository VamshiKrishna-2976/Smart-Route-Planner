/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Manrope", "sans-serif"],
      },
      colors: {
        ink: "#17231d",
        forest: "#176b4d",
        mint: "#e9f4ee",
        canvas: "#f7f8f6",
      },
    },
  },
  plugins: [],
};
