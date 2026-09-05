/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#1b1b2f",
          700: "#3a3a55",
          500: "#5c5c78",
          300: "#a3a3ba",
        },
        teal: {
          650: "#0f766e",
        },
        plum: {
          600: "#7c3aed",
        },
        cream: "#faf8f5",
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
