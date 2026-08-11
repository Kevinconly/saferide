import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f1",
          100: "#d5ecdd",
          200: "#aed9bf",
          300: "#7cbf9b",
          400: "#4aa377",
          500: "#2d8a5b",
          600: "#22704a",
          700: "#1d5a3d",
          800: "#194831",
          900: "#143b29",
        },
      },
    },
  },
  plugins: [],
};

export default config;
