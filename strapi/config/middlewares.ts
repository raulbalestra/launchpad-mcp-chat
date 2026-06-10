export default [
  'strapi::logger',
  'strapi::errors',
  // CSP ajustado para o Preview side-by-side embutir o frontend (CLIENT_URL) no iframe.
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', process.env.CLIENT_URL],
          'frame-src': ["'self'", process.env.CLIENT_URL],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  // Limites maiores: o chat envia o frame da tela compartilhada (imagem base64)
  // no corpo da requisição. O default (~100kb) causa 413 "request entity too large".
  {
    name: 'strapi::body',
    config: {
      jsonLimit: '15mb',
      formLimit: '15mb',
      textLimit: '15mb',
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
