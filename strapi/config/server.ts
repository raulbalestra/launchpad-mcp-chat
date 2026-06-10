export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS') || ['tobemodified1', 'tobemodified2'],
  },
  // MCP server NATIVO da Strapi (>= 5.47.0). Expõe /mcp (Streamable HTTP,
  // autenticado por admin token). O plugin mcp-chat consome esse endpoint.
  mcp: {
    enabled: true,
  },
});
