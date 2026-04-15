/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev: allow HMR when the page is opened via 127.0.0.1 (vs localhost).
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
