/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["bcryptjs"],
  // Room for photo uploads (5 MB max per photo; the form checks size before sending)
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), { "node:sqlite": "commonjs node:sqlite" }];
    }
    return config;
  },
};
export default nextConfig;
