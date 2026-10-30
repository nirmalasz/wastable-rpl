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
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
