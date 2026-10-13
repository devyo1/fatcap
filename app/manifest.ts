import type { MetadataRoute } from 'next';

// Home-screen app. Scope is the whole site, so every page stays inside the app instead of
// falling back to the browser; it opens on the forum (which sends you to the login if needed).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'fatcap.club',
    short_name: 'fatcap',
    start_url: '/forum',
    scope: '/',
    display: 'standalone',
    background_color: '#0E0E0D',
    theme_color: '#0E0E0D',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
