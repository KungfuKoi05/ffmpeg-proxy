/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Twilio's SDK is server-only; keep it out of any client bundle.
  serverExternalPackages: ["twilio"],
};

export default nextConfig;
