# pwa-service-worker

An agent skill for implementing, debugging, and optimizing Progressive Web Apps in **Next.js App Router** with service workers, push notifications, offline support, and caching strategies.

## Install

```bash
npx skills add Juanmorales1810/pwa-service-worker
```

## What this skill covers

- **Manifest & installability** — `app/manifest.ts`, maskable icons, iOS meta tags
- **Service worker lifecycle** — registration, `skipWaiting`, `clients.claim`, update notification UX
- **Caching strategies** — Cache First, Network First, Stale-While-Revalidate, cache versioning
- **Offline support** — offline fallback pages, App Shell pattern, precaching
- **Push notifications** — `web-push` with Server Actions, VAPID keys, permission UX
- **Background Sync** — offline form submissions with retry
- **Security headers** — `next.config.js` headers for `/sw.js`
- **Serwist integration** — build-time precaching and runtime caching routes
- **Debugging** — common issues table, DevTools techniques, Lighthouse PWA audits

## Supported agents

Works with Claude Code, GitHub Copilot, Cursor, Windsurf, Codex, and [37+ more agents](https://github.com/vercel-labs/skills#supported-agents).

## Structure

```
skills-pwa-service-worker/
├── SKILL.md              # Main skill instructions
├── references/
│   └── strategies-and-snippets.md   # Code templates and troubleshooting
└── agents/
    ├── claude.md          # Claude-specific agent instructions
    ├── claude.yaml        # Claude agent config
    └── openai.yaml        # OpenAI agent config
```

## License

MIT
