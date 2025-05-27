/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  devIndicators: false,
  images: {
    domains: [], // Add any external image domains if needed
  },
};

module.exports = nextConfig; 