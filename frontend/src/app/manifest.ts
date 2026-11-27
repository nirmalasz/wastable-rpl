import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WASTABLE',
    short_name: 'WASTABLE',
    description: 'WASTABLE - Waste Management Application',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#00695c',
    icons: [
      {
        // frontend/src/app/icon.png, which Next also uses as the browser-tab icon.
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
