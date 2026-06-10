export default () => ({
  // MCP server da própria instância (@sensinum/strapi-plugin-mcp).
  // Expõe a estrutura do Strapi (content-types, componentes, serviços) via
  // /api/mcp/streamable para a IA do mcp-chat ler.
  mcp: {
    enabled: true,
    config: {
      session: { type: 'memory' },
      allowedIPs: ['127.0.0.1', '::1'],
    },
  },
  // Plugin de chat com IA embutido no admin (chat + voz + edição via MCP).
  'mcp-chat': {
    enabled: true,
    resolve: './src/plugins/mcp-chat',
  },
});
