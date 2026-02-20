const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "t.me" },
      { protocol: "https" as const, hostname: "*.telegram.org" },
    ],
  },
};

export default nextConfig;
