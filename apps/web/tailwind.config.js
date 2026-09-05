/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#2b1b3d",
          700: "#4a3a60",
          500: "#6f5c85",
          300: "#b3a3c4",
        },
        // Brand pink — mapped over the `teal` token name used throughout the app.
        teal: {
          50: "#fdf2f7",
          100: "#fce7f1",
          200: "#fbcfe3",
          300: "#f8a8c9",
          650: "#d6246e",
          700: "#be185d",
          800: "#9d174d",
        },
        // Brand purple from the logo.
        plum: {
          600: "#6d4fd4",
        },
        cream: "#fdf8fa",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(27,27,47,0.08), 0 8px 24px rgba(27,27,47,0.06)",
      },
    },
  },
  plugins: [],
};
