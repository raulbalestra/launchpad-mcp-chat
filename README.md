# Launchpad + MCP Chat — demo

A ready-to-run demo of [**strapi-plugin-mcp-chat**](https://github.com/raulbalestra/strapi-plugin-mcp-chat)
running on top of the official [Strapi **Launchpad**](https://github.com/strapi/launchpad)
(Strapi 5 backend + Next.js frontend).

It lets you **edit the site's content by chatting with an AI** inside the Strapi admin:
ask in plain language, the assistant finds the text (even when it lives inside
components or dynamic zones), edits it via MCP, publishes, and reloads the
side-by-side preview right where you were.

> 🔑 **Bring your own OpenAI key.** The chat/voice features call OpenAI from the
> server. Put your key in `strapi/.env` (see below). It is git-ignored — never
> commit it.

---

## Requirements

- Node.js **18–22**
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

### 1. Backend (Strapi) — `strapi/`

```bash
cd strapi
npm install
cp .env.example .env
```

Edit `strapi/.env`:

- set `OPENAI_API_KEY=` to your own key
- fill the secrets (`APP_KEYS`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `API_TOKEN_SALT`,
  `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`, `PREVIEW_SECRET`). Quick way to generate one:
  `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`
- if you change `PORT`, update `MCP_URL` to the same port

Seed the demo content and start:

```bash
npm run seed      # imports the Launchpad content (products, blog, pages…)
npm run develop   # http://localhost:1337/admin
```

Create your admin user at `http://localhost:1337/admin`. That's it — the chat works
right away (the plugin registers its tools into the native MCP server and calls them
in-process; no admin token needed).

> **Want to use the tools from an external MCP client** (e.g. Cursor)? They're
> exposed at `/mcp` (native MCP is enabled in `strapi/config/server.ts`). External
> clients authenticate with an **Admin token** (Settings → Admin Tokens). The in-admin
> chat doesn't need it.

### 2. Frontend (Next.js) — `next/`

```bash
cd next
npm install --legacy-peer-deps --ignore-scripts   # see "Notes" for why
cp .env.example .env.local
```

Set `PREVIEW_SECRET` in `next/.env.local` to the **same value** as in `strapi/.env`,
then:

```bash
npm run dev       # http://localhost:3000
```

## Try it

1. Open the Strapi admin, click the floating chat (bottom-right) and the 🖼 **Preview** button.
2. In the preview address bar, point it to your frontend (`http://localhost:3000/en`).
3. Ask, e.g.: *"change the homepage hero title to 'Welcome aboard'"*.
4. Watch the assistant find it, edit it, publish, and reload the preview on the same spot.

You can also use voice (🎤) and screen sharing (the chat sends a frame so the AI sees what you see).

## Notes

- **Use `npm`** here — the project was verified with npm (a `package-lock.json` is committed).
- The frontend install needs `--legacy-peer-deps` (a `@react-three/fiber` peer range
  in Launchpad) and `--ignore-scripts` (a transitive `husky` prepare script). Both are
  pre-existing Launchpad quirks, unrelated to the plugin.
- Ports: Strapi `1337`, Next `3000` by default. If `1337` is taken, change `PORT` and
  `MCP_URL` in `strapi/.env` and `NEXT_PUBLIC_API_URL` in `next/.env.local` to match.

## What's added on top of Launchpad

- `strapi/src/plugins/mcp-chat/` — the plugin (vendored here so you can clone & run).
- `strapi/config/server.ts` — enables Strapi's native MCP server (`/mcp`).
- `strapi/config/plugins.ts` — enables `mcp-chat`.
- `strapi/config/middlewares.ts` — raises body limit (screenshots) + iframe CSP.
- `next/components/preview-bridge.tsx` — keeps the preview on the same page + scroll after edits.

## Credits

- Plugin: [strapi-plugin-mcp-chat](https://github.com/raulbalestra/strapi-plugin-mcp-chat) (MIT)
- Base app: [Strapi Launchpad](https://github.com/strapi/launchpad)
- MCP server: Strapi's [native MCP server](https://docs.strapi.io/cms/features/strapi-mcp-server) (built-in, Strapi ≥ 5.47.0)
