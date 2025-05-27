/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF1493", // Pink
          hover: "#FF369B",
        },
        dark: {
          DEFAULT: "#000000",
          lighter: "#111111",
          light: "#1a1a1a",
        },
      },
    },
  },
  plugins: [],
}

