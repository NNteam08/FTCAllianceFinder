/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['ftcscout.org', 'supabase.co'],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;




