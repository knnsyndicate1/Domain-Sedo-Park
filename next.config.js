/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ant-design/nextjs-registry'],
  pageExtensions: ['jsx', 'js', 'tsx', 'ts'],
  webpack: (config, { isServer }) => {
    // Safely initialize watchOptions if it doesn't exist
    config.watchOptions = config.watchOptions || {};
    config.watchOptions.ignored = config.watchOptions.ignored || [];
    
    // Add the supabase directory to ignored paths
    if (Array.isArray(config.watchOptions.ignored)) {
      config.watchOptions.ignored.push('**/supabase/**');
    } else {
      config.watchOptions.ignored = ['**/supabase/**'];
    }
    
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}
 
module.exports = nextConfig 