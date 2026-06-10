export default () => ({
  // O MCP server agora é o NATIVO da Strapi (habilitado em config/server.ts).
  // Plugin de chat com IA embutido no admin (chat + voz + edição via MCP).
  'mcp-chat': {
    enabled: true,
    resolve: './src/plugins/mcp-chat',
  },
});
