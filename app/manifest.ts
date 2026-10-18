import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lotiva - Gestao de Loteamentos',
    short_name: 'Lotiva',
    description: 'Gestao comercial e financeira de loteamentos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f1f5f9',
    theme_color: '#3c50e0',
    orientation: 'any',
    icons: [
      { src: '/icons/lotiva-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/lotiva-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/lotiva-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
