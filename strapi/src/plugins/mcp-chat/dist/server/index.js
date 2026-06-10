var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// server/src/controllers/chat.ts
var chat_default = ({ strapi }) => ({
  async message(ctx) {
    const { messages, image, lang, previewUrl } = ctx.request.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return ctx.badRequest('Campo "messages" (array) \xE9 obrigat\xF3rio.');
    }
    try {
      const result = await strapi.plugin("mcp-chat").service("chat").chat({ messages, image, lang, previewUrl });
      ctx.body = result;
    } catch (e) {
      strapi.log.error(`[mcp-chat] ${e?.message || e}`);
      return ctx.internalServerError(e?.message || "Erro ao processar o chat.");
    }
  }
});

// server/src/controllers/audio.ts
var import_fs = require("fs");
var audio_default = ({ strapi }) => ({
  async stt(ctx) {
    const files = ctx.request.files || {};
    const file = files.audio || files.file;
    if (!file) return ctx.badRequest('Envie um arquivo de \xE1udio no campo "audio".');
    const f = Array.isArray(file) ? file[0] : file;
    const buffer = f.filepath ? (0, import_fs.readFileSync)(f.filepath) : f.buffer;
    const mimetype = f.mimetype || f.type || "audio/webm";
    const language = ctx.query?.language || ctx.request.body?.language;
    try {
      const result = await strapi.plugin("mcp-chat").service("audio").transcribe(buffer, mimetype, language);
      ctx.body = result;
    } catch (e) {
      strapi.log.error(`[mcp-chat:stt] ${e?.message || e}`);
      return ctx.internalServerError(e?.message || "Erro na transcri\xE7\xE3o.");
    }
  },
  async tts(ctx) {
    const { text, voice } = ctx.request.body || {};
    if (!text) return ctx.badRequest('Campo "text" \xE9 obrigat\xF3rio.');
    try {
      const result = await strapi.plugin("mcp-chat").service("audio").synthesize(text, voice);
      ctx.body = result;
    } catch (e) {
      strapi.log.error(`[mcp-chat:tts] ${e?.message || e}`);
      return ctx.internalServerError(e?.message || "Erro na s\xEDntese de voz.");
    }
  }
});

// server/src/mcp-client.ts
var MCP_URL = process.env.MCP_URL || "http://localhost:1337/mcp";
var baseHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream"
};
var parseSse = (text) => {
  const dataLines = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean);
  const last = dataLines[dataLines.length - 1];
  return last ? JSON.parse(last) : null;
};
var McpClient = class {
  /**
   * @param url   endpoint MCP streamable. Default: o /mcp nativo da Strapi.
   * @param name  rótulo p/ logs (ex.: 'strapi', 'playwright').
   * @param token Bearer token (admin token, exigido pelo /mcp nativo).
   */
  constructor(url = MCP_URL, name = "strapi", token) {
    this.url = url;
    this.name = name;
    this.token = token;
  }
  headers() {
    const h = { ...baseHeaders };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    if (this.sessionId) h["mcp-session-id"] = this.sessionId;
    return h;
  }
  async init() {
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-chat-plugin", version: "0.1.0" }
        }
      })
    });
    this.sessionId = res.headers.get("mcp-session-id") || void 0;
    await res.text();
    await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });
  }
  async rpc(method, params, id) {
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
    });
    const json = parseSse(await res.text());
    if (json?.error) throw new Error(json.error.message || "Erro MCP");
    return json?.result;
  }
  async listTools() {
    const result = await this.rpc("tools/list", {}, 2);
    return result?.tools || [];
  }
  async callTool(name, args) {
    return this.rpc("tools/call", { name, arguments: args || {} }, 3);
  }
};

// server/src/services/chat.ts
var MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";
var MAX_TURNS = 10;
var OPENAI_URL = "https://api.openai.com/v1/chat/completions";
var SYSTEM = {
  pt: `Voc\xEA \xE9 um assistente embutido no admin do Strapi 5 deste projeto. Voc\xEA N\xC3O \xE9 s\xF3 um guia: voc\xEA consegue EDITAR e PUBLICAR conte\xFAdo de verdade atrav\xE9s das ferramentas.

Ferramentas de LEITURA (MCP) descrevem content-types, componentes, servi\xE7os e info da inst\xE2ncia \u2014 use para entender a estrutura.

Ferramentas de ESCRITA:
- buscar_texto({termo}): procura uma palavra ou frase em TODOS os content-types, single types, COMPONENTES e DYNAMIC ZONES (recursivo, por substring). Retorna uma lista; cada item tem uid, documentId, "path" (caminho at\xE9 o campo, ex.: ["dynamic_zone",2,"heading"]), campo e valor_atual. Use SEMPRE isto primeiro \u2014 N\xC3O pe\xE7a ao usu\xE1rio onde est\xE1, ache sozinho. Busque um trecho distintivo e N\xC3O inclua r\xF3tulos que o preview adiciona, como "(Draft)"/"(Rascunho)".
- editar_campo({uid, documentId, path, novo_valor}): troca o valor de um campo (salva como rascunho). Passe o "path" EXATAMENTE como veio de buscar_texto.
- publicar({uid, documentId}): publica a entrada, deixando a mudan\xE7a vis\xEDvel no site.

Fluxo padr\xE3o quando o usu\xE1rio pede uma mudan\xE7a no site (por texto, voz ou mostrando a tela):
1. Use buscar_texto com um trecho distintivo do texto a alterar (sem r\xF3tulos de status).
2. Se houver mais de um resultado, escolha o mais prov\xE1vel pelo contexto (e diga qual escolheu); se amb\xEDguo de verdade, pergunte.
3. editar_campo passando o mesmo uid, documentId e path do resultado, com o novo valor.
4. publicar a entrada.
5. Confirme em 1 frase o que foi alterado e publicado (content-type, campo, antes \u2192 depois).

Se o usu\xE1rio compartilhar a tela, uma imagem \xE9 anexada \xE0 \xFAltima mensagem \u2014 use-a para entender exatamente o que ele est\xE1 vendo e qual texto quer trocar.

Seja objetivo e acion\xE1vel. Responda SEMPRE em portugu\xEAs.`,
  en: `You are an assistant embedded in this project's Strapi 5 admin. You are NOT just a guide: you can actually EDIT and PUBLISH content through your tools.

READ tools (MCP) describe content-types, components, services and instance info \u2014 use them to understand the structure.

WRITE tools:
- buscar_texto({termo}): searches a word or phrase across ALL content-types, single types, COMPONENTS and DYNAMIC ZONES (recursive, substring). Returns a list; each item has uid, documentId, "path" (the path to the field, e.g. ["dynamic_zone",2,"heading"]), field and current value. ALWAYS use this first \u2014 do NOT ask the user where it is, find it yourself. Search a distinctive snippet and do NOT include labels the preview adds, like "(Draft)".
- editar_campo({uid, documentId, path, novo_valor}): replaces a field value (saved as draft). Pass the "path" EXACTLY as returned by buscar_texto.
- publicar({uid, documentId}): publishes the entry, making the change visible on the site.

Default flow when the user asks for a site change (by text, voice or by showing their screen):
1. Use buscar_texto with a distinctive snippet of the text to change (no status labels).
2. If there is more than one result, pick the most likely from context (and say which); if truly ambiguous, ask.
3. editar_campo passing the same uid, documentId and path from the result, with the new value.
4. publicar the entry.
5. Confirm in one sentence what was changed and published (content-type, field, before \u2192 after).

If the user shares their screen, an image is attached to the last message \u2014 use it to understand exactly what they see and which text they want to change.

Be concise and actionable. ALWAYS answer in English.`
};
var chat_default2 = ({ strapi }) => ({
  async chat({ messages, image, lang = "pt", previewUrl }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY n\xE3o configurada no .env do Strapi. Adicione e reinicie."
      );
    }
    const language = lang === "en" ? "en" : "pt";
    const apiContentTypes = () => Object.values(strapi.contentTypes).filter(
      (ct) => ct.uid?.startsWith("api::")
    );
    const TEXTUAL = ["string", "text", "richtext"];
    const attrsOf = (uid) => strapi.contentTypes?.[uid]?.attributes || strapi.components?.[uid]?.attributes || {};
    const buildPopulate = (attributes, seen = /* @__PURE__ */ new Set()) => {
      const populate = {};
      for (const [name, a] of Object.entries(attributes)) {
        if (a.type === "component" && a.component) {
          const sub = seen.has(a.component) ? {} : buildPopulate(attrsOf(a.component), new Set(seen).add(a.component));
          populate[name] = Object.keys(sub).length ? { populate: sub } : true;
        } else if (a.type === "dynamiczone") {
          const on = {};
          for (const comp of a.components || []) {
            const sub = seen.has(comp) ? {} : buildPopulate(attrsOf(comp), new Set(seen).add(comp));
            on[comp] = Object.keys(sub).length ? { populate: sub } : true;
          }
          populate[name] = { on };
        } else if (a.type === "media" || a.type === "relation") {
          populate[name] = true;
        }
      }
      return populate;
    };
    const walkFind = (node, attributes, basePath, needle, collect) => {
      if (!node || typeof node !== "object") return;
      for (const [name, a] of Object.entries(attributes)) {
        const v = node[name];
        if (v == null) continue;
        const path = [...basePath, name];
        if (TEXTUAL.includes(a.type)) {
          if (typeof v === "string" && v.toLowerCase().includes(needle)) {
            collect(path, name, v);
          }
        } else if (a.type === "component" && a.component) {
          const sub = attrsOf(a.component);
          if (a.repeatable && Array.isArray(v)) {
            v.forEach((item, i) => walkFind(item, sub, [...path, i], needle, collect));
          } else {
            walkFind(v, sub, path, needle, collect);
          }
        } else if (a.type === "dynamiczone" && Array.isArray(v)) {
          v.forEach((item, i) => {
            if (item?.__component) {
              walkFind(item, attrsOf(item.__component), [...path, i], needle, collect);
            }
          });
        }
      }
    };
    const buscarTexto = async (termo) => {
      const needle = String(termo || "").toLowerCase().trim();
      if (!needle) return { erro: "termo vazio" };
      const matches = [];
      for (const ct of apiContentTypes()) {
        const attributes = ct.attributes || {};
        const populate = buildPopulate(attributes);
        let entries = [];
        try {
          const res = await strapi.documents(ct.uid).findMany({ status: "draft", populate, limit: 200 });
          entries = Array.isArray(res) ? res : res ? [res] : [];
        } catch {
          continue;
        }
        for (const e of entries) {
          walkFind(e, attributes, [], needle, (path, campo, valor) => {
            matches.push({
              uid: ct.uid,
              tipo: ct.info?.displayName || ct.uid,
              documentId: e.documentId,
              path,
              campo,
              valor_atual: valor.length > 300 ? valor.slice(0, 300) + "\u2026" : valor
            });
          });
        }
      }
      return { total: matches.length, resultados: matches };
    };
    const sanitizeNode = (node, attributes) => {
      if (node == null) return node;
      const out = {};
      if (node.id != null) out.id = node.id;
      for (const [name, a] of Object.entries(attributes)) {
        const v = node[name];
        if (v === void 0) continue;
        out[name] = sanitizeAttr(v, a);
      }
      return out;
    };
    const sanitizeAttr = (value, a) => {
      if (value == null) return value;
      if (a.type === "component" && a.component) {
        const sub = attrsOf(a.component);
        return a.repeatable && Array.isArray(value) ? value.map((it) => sanitizeNode(it, sub)) : sanitizeNode(value, sub);
      }
      if (a.type === "dynamiczone" && Array.isArray(value)) {
        return value.map((it) => ({
          __component: it.__component,
          ...sanitizeNode(it, attrsOf(it.__component))
        }));
      }
      if (a.type === "media") {
        return Array.isArray(value) ? value.map((m) => m?.id).filter(Boolean) : value?.id ?? null;
      }
      if (a.type === "relation") {
        return Array.isArray(value) ? value.map((r) => r?.id).filter(Boolean) : value?.id ?? null;
      }
      return value;
    };
    const editarCampo = async ({
      uid,
      documentId,
      path,
      campo,
      novo_valor
    }) => {
      const p = Array.isArray(path) && path.length ? path : campo ? [campo] : null;
      if (!p) return { erro: 'informe "path" (array) ou "campo"' };
      const attributes = strapi.contentTypes?.[uid]?.attributes || {};
      const topAttr = p[0];
      const ad = attributes[topAttr];
      if (p.length === 1 && ad && TEXTUAL.includes(ad.type)) {
        const updated2 = await strapi.documents(uid).update({ documentId, data: { [topAttr]: novo_valor } });
        return { ok: true, uid, documentId: updated2?.documentId || documentId, path: p, novo_valor };
      }
      const populate = buildPopulate(attributes);
      const entry = await strapi.documents(uid).findOne({ documentId, status: "draft", populate });
      if (!entry) return { erro: "entrada n\xE3o encontrada" };
      let cur = entry;
      for (let i = 0; i < p.length - 1; i++) {
        if (cur == null) break;
        cur = cur[p[i]];
      }
      if (cur == null) return { erro: `caminho inv\xE1lido: ${p.join(".")}` };
      cur[p[p.length - 1]] = novo_valor;
      const data = { [topAttr]: sanitizeAttr(entry[topAttr], ad) };
      const updated = await strapi.documents(uid).update({ documentId, data });
      return { ok: true, uid, documentId: updated?.documentId || documentId, path: p, novo_valor };
    };
    const publicar = async ({ uid, documentId }) => {
      await strapi.documents(uid).publish({ documentId });
      return { ok: true, uid, documentId, status: "published" };
    };
    const LOCAL_TOOLS = {
      buscar_texto: (a) => buscarTexto(a?.termo),
      editar_campo: (a) => editarCampo(a),
      publicar: (a) => publicar(a)
    };
    const localToolSpecs = [
      {
        type: "function",
        function: {
          name: "buscar_texto",
          description: 'Procura uma palavra/frase em TODOS os content-types, single types, COMPONENTES e DYNAMIC ZONES do Strapi (busca por substring, recursiva). Cada resultado traz uid, documentId, "path" (caminho at\xE9 o campo, ex.: ["dynamic_zone",2,"heading"]), campo e valor_atual. Passe esse mesmo "path" para editar_campo.',
          parameters: {
            type: "object",
            properties: { termo: { type: "string", description: 'trecho distintivo do texto a localizar; N\xC3O inclua r\xF3tulos de status que o preview adiciona, como "(Draft)" ou "(Rascunho)"' } },
            required: ["termo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "editar_campo",
          description: 'Altera o valor de um campo de uma entrada (salva como rascunho). Use o "path" retornado por buscar_texto para campos aninhados em componentes/dynamic zones. Para um campo simples no topo, pode usar "campo".',
          parameters: {
            type: "object",
            properties: {
              uid: { type: "string" },
              documentId: { type: "string" },
              path: {
                type: "array",
                description: 'caminho at\xE9 o campo, exatamente como veio de buscar_texto (ex.: ["dynamic_zone",2,"heading"]). Strings s\xE3o nomes de campo; n\xFAmeros s\xE3o \xEDndices em arrays/dynamic zones.',
                items: { type: ["string", "number"] }
              },
              campo: { type: "string", description: "alternativa ao path, s\xF3 para campo simples no topo do content-type" },
              novo_valor: { type: "string" }
            },
            required: ["uid", "documentId", "novo_valor"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "publicar",
          description: "Publica a entrada (torna a altera\xE7\xE3o vis\xEDvel no site p\xFAblico).",
          parameters: {
            type: "object",
            properties: { uid: { type: "string" }, documentId: { type: "string" } },
            required: ["uid", "documentId"]
          }
        }
      }
    ];
    const mcpByTool = {};
    const mcpTools = [];
    const mcpSources = [
      // URL default (/mcp nativo); token de admin exigido pelo MCP nativo.
      { name: "strapi", token: process.env.STRAPI_ADMIN_TOKEN }
    ];
    if (process.env.PLAYWRIGHT_MCP_URL) {
      mcpSources.push({ url: process.env.PLAYWRIGHT_MCP_URL, name: "playwright" });
    }
    if (!process.env.STRAPI_ADMIN_TOKEN) {
      strapi.log.warn(
        "[mcp-chat] STRAPI_ADMIN_TOKEN n\xE3o definido \u2014 o MCP nativo (/mcp) exige um admin token. O chat seguir\xE1 com as ferramentas locais (buscar_texto/editar_campo/publicar). Crie um admin token no painel e adicione STRAPI_ADMIN_TOKEN ao .env para habilitar as tools do MCP."
      );
    }
    for (const src of mcpSources) {
      try {
        const client = new McpClient(src.url, src.name, src.token);
        await client.init();
        const list = await client.listTools();
        for (const t of list) {
          if (mcpByTool[t.name]) continue;
          mcpByTool[t.name] = client;
          mcpTools.push(t);
        }
        strapi.log.info(`[mcp-chat] MCP "${src.name}" ok: ${list.length} tools`);
      } catch (e) {
        strapi.log.warn(
          `[mcp-chat] MCP "${src.name}" indispon\xEDvel: ${e?.message || e}`
        );
      }
    }
    const tools = [
      ...localToolSpecs,
      ...mcpTools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description || t.name,
          parameters: t.inputSchema || { type: "object", properties: {} }
        }
      }))
    ];
    const hasBrowser = mcpTools.some((t) => String(t.name).startsWith("browser_"));
    const adminBase = process.env.STRAPI_ADMIN_URL || "http://localhost:1337/admin";
    const BROWSER_NOTE = {
      pt: `

Voc\xEA tamb\xE9m controla um navegador real via ferramentas browser_* (Playwright), apontado para o ADMIN DA STRAPI em ${adminBase} (o backend \u2014 \xE9 aqui que o conte\xFAdo muda de verdade, N\xC3O no site p\xFAblico). Pode navegar (browser_navigate), clicar, digitar, rolar, tirar seus pr\xF3prios screenshots (browser_take_screenshot) e inspecionar console/erros. Prefira sempre suas ferramentas diretas (buscar_texto/editar_campo/publicar) para alterar conte\xFAdo; use o navegador para VERIFICAR no admin que a edi\xE7\xE3o/publica\xE7\xE3o ficou correta, ou para fluxos da UI que as ferramentas diretas n\xE3o cobrem.`,
      en: `

You also control a real browser via browser_* tools (Playwright), pointed at the STRAPI ADMIN at ${adminBase} (the backend \u2014 this is where content actually changes, NOT the public site). You can navigate (browser_navigate), click, type, scroll, take your own screenshots (browser_take_screenshot) and inspect console/errors. Always prefer your direct tools (buscar_texto/editar_campo/publicar) to change content; use the browser to VERIFY in the admin that the edit/publish landed, or for admin UI flows the direct tools don't cover.`
    };
    const systemContent = SYSTEM[language] + (hasBrowser ? BROWSER_NOTE[language] : "");
    const convo = [{ role: "system", content: systemContent }];
    const pageNote = previewUrl ? language === "en" ? `

[context: the user is viewing the page ${previewUrl} in the preview right now \u2014 assume "this/here" refers to what's on that page]` : `

[contexto: o usu\xE1rio est\xE1 vendo a p\xE1gina ${previewUrl} no preview agora \u2014 assuma que "isso/aqui" se refere ao que est\xE1 nessa p\xE1gina]` : "";
    messages.forEach((m, i) => {
      const isLastUser = i === messages.length - 1 && m.role === "user";
      if (isLastUser) {
        const text = (m.content || "") + pageNote;
        if (image) {
          convo.push({
            role: "user",
            content: [
              { type: "text", text: text || "(veja minha tela)" },
              { type: "image_url", image_url: { url: image } }
            ]
          });
        } else {
          convo.push({ role: "user", content: text || m.content });
        }
      } else {
        convo.push({ role: m.role, content: m.content });
      }
    });
    const callOpenAI = async (body) => {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`OpenAI chat: ${await res.text()}`);
      return res.json();
    };
    let didWrite = false;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const data = await callOpenAI({
        model: MODEL,
        max_tokens: 2048,
        messages: convo,
        ...tools.length > 0 ? { tools, tool_choice: "auto" } : {}
      });
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("OpenAI: resposta sem message.");
      convo.push(msg);
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const call of msg.tool_calls) {
          const name = call.function?.name;
          let content;
          try {
            const argsStr = call.function?.arguments || "{}";
            const args = argsStr ? JSON.parse(argsStr) : {};
            const local = LOCAL_TOOLS[name];
            const owner = mcpByTool[name];
            let r;
            if (local) {
              r = await local(args);
              if (name === "editar_campo" || name === "publicar") didWrite = true;
              strapi.log.info(`[mcp-chat] tool ${name} -> ${JSON.stringify(r).slice(0, 200)}`);
            } else if (owner) {
              r = await owner.callTool(name, args);
            } else {
              r = { erro: `tool ${name} indispon\xEDvel` };
            }
            content = typeof r === "string" ? r : JSON.stringify(r);
          } catch (e) {
            content = `Erro ao chamar a tool ${name}: ${e?.message || e}`;
          }
          convo.push({ role: "tool", tool_call_id: call.id, content });
        }
        continue;
      }
      const text = (typeof msg.content === "string" ? msg.content : "").trim();
      return {
        reply: text || "(sem resposta)",
        model: MODEL,
        lang: language,
        didWrite,
        toolsAvailable: tools.length
      };
    }
    return {
      reply: language === "en" ? "(agent turn limit reached)" : "(limite de turnos do agente atingido)",
      model: MODEL,
      lang: language,
      didWrite,
      toolsAvailable: tools.length
    };
  }
});

// server/src/services/audio.ts
var audio_default2 = ({ strapi }) => ({
  async transcribe(buffer, mimetype, language) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY n\xE3o configurada no .env (necess\xE1ria p/ \xE1udio).");
    const ext = mimetype.includes("mp4") ? "mp4" : mimetype.includes("ogg") ? "ogg" : mimetype.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimetype }), `audio.${ext}`);
    form.append("model", "whisper-1");
    const raw = Array.isArray(language) ? language[0] : language;
    const lang = raw === "en" || raw === "pt" ? raw : void 0;
    if (lang) form.append("language", lang);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form
    });
    if (!res.ok) throw new Error(`OpenAI STT: ${await res.text()}`);
    const data = await res.json();
    return { text: data.text };
  },
  async synthesize(text, voice = "echo") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY n\xE3o configurada no .env (necess\xE1ria p/ \xE1udio).");
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", input: text, voice, response_format: "mp3" })
    });
    if (!res.ok) throw new Error(`OpenAI TTS: ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audio_base64: buffer.toString("base64"), content_type: "audio/mpeg" };
  }
});

// server/src/routes/index.ts
var routes_default = {
  admin: {
    type: "admin",
    routes: [
      {
        method: "POST",
        path: "/message",
        handler: "chat.message",
        config: { policies: [] }
      },
      {
        method: "POST",
        path: "/stt",
        handler: "audio.stt",
        config: { policies: [] }
      },
      {
        method: "POST",
        path: "/tts",
        handler: "audio.tts",
        config: { policies: [] }
      }
    ]
  }
};

// server/src/index.ts
var index_default = {
  register() {
  },
  bootstrap() {
  },
  destroy() {
  },
  config: {
    default: {},
    validator() {
    }
  },
  controllers: { chat: chat_default, audio: audio_default },
  routes: routes_default,
  services: { chat: chat_default2, audio: audio_default2 }
};
