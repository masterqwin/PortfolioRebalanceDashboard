import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b0f",
        panel: "#10151c",
        panel2: "#151b23",
        line: "#27313d",
        muted: "#8d98a7",
        teal: "#2dd4bf",
        amber: "#f8b84e",
        green: "#35d07f",
        red: "#ff5c5c"
      }
    }
  },
  plugins: []
};

export default config;
