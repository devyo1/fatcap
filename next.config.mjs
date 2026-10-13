/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  async rewrites() {
    // The landing page is a hand-built static file; serve it at the root.
    return { beforeFiles: [{ source: '/', destination: '/landing.html' }] };
  },
  async headers() {
    // Private club: stay out of search engines and archives, never load inside someone else's
    // page, don't tell outside sites which thread a link was clicked from, and no browser
    // features that could reveal where someone is.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, noimageindex' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()' },
        ],
      },
      {
        // Pages can't be framed. Image and sticker routes set a stricter policy of their own (sandboxed).
        source: '/((?!api/media|api/chat/img|api/sticker|api/avatar|api/gif).*)',
        headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
      },
    ];
  },
};

export default nextConfig;
