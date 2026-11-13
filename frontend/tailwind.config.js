/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Calm teal/mint palette for a health app
        primary: {
          50:  "#effefb",
          100: "#c9fef4",
          200: "#93fde9",
          300: "#55f3db",
          400: "#22dfc8",
          500: "#09c3af",
          600: "#049e90",
          700: "#087e74",
          800: "#0c645e",
          900: "#0f534e",
          950: "#013332",
        },
        accent: {
          50:  "#f0fdf5",
          100: "#dcfce8",
          200: "#bbf7d1",
          300: "#86efad",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
