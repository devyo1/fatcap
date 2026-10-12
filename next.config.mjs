/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  async rewrites() {
    // The landing page is a hand-built static file; serve it at the root.
    return { beforeFiles: [{ source: '/', destination: '/landing.html' }] };
  },
};

export default nextConfig;
