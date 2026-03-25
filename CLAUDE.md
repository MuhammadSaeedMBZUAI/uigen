# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Run all tests
npm run test

# Run a single test file
npx vitest run src/lib/transform/__tests__/jsx-transformer.test.ts

# Reset database
npm run db:reset
```

The dev scripts require `NODE_OPTIONS='--require ./node-compat.cjs'` — this is already included in `package.json` scripts, so use `npm run dev` rather than calling `next` directly.

Set `ANTHROPIC_API_KEY` in `.env` to use real Claude. Without it, a `MockLanguageModel` in `src/lib/provider.ts` generates static placeholder responses.

## Architecture

UIGen is a chat-based React component generator. Users describe components in natural language; Claude generates/modifies files in a virtual file system; results render live in an iframe.

### Data flow

1. User sends a message → `ChatContext` (`src/lib/contexts/chat-context.tsx`) calls `/api/chat` via Vercel AI SDK `useChat`
2. `POST /api/chat` (`src/app/api/chat/route.ts`) reconstructs a `VirtualFileSystem` from the serialized file nodes sent in the request body, streams Claude's response using `streamText`
3. Claude calls tools (`str_replace_editor`, `file_manager`) to create/modify/delete files — these tools mutate the server-side `VirtualFileSystem` instance during the stream
4. Tool calls are forwarded to the client via `onToolCall`; `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) applies the same mutations to the client-side `VirtualFileSystem`
5. On stream finish, if a `projectId` is present and the user is authenticated, the full message history and serialized file system are persisted to SQLite via Prisma
6. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) detects when files change and regenerates the iframe srcdoc using `buildPreviewHTML` from the JSX transformer

### Virtual file system

`VirtualFileSystem` (`src/lib/file-system.ts`) is a pure in-memory tree — nothing is ever written to disk. It serializes to/from a flat `Record<string, FileNode>` for transport (request body, database storage). The client and server each maintain their own instance that stays in sync via the tool call stream.

### JSX transformation & preview

`src/lib/transform/jsx-transformer.ts` uses `@babel/standalone` to transpile TypeScript/JSX to browser-executable JS at runtime on the client. It:
- Strips CSS imports and handles missing inter-file imports by generating placeholder modules
- Builds an ES module import map so files can `import` each other inside the iframe
- Produces a self-contained HTML document injected as `srcdoc`

### AI tools

Two tools are registered with Claude in the chat route:
- **`str_replace_editor`** (`src/lib/tools/str-replace.ts`) — `view`, `create`, `str_replace`, `insert` commands on files
- **`file_manager`** (`src/lib/tools/file-manager.ts`) — rename and delete files/directories

### Authentication

JWT-based, stored in HTTP-only cookies (`src/lib/auth.ts`). `src/middleware.ts` protects routes. Projects can be created without an account (anonymous); they are only persisted per-user when `userId` is set. Anonymous in-progress work is tracked in `src/lib/anon-work-tracker.ts` via localStorage so it can be preserved after sign-up.

## Code style

Use comments sparingly. Only comment complex or non-obvious code.

### Database

Prisma + SQLite. Reference `prisma/schema.prisma` anytime you need to understand the structure of data stored in the database. `Project.messages` and `Project.data` are JSON strings storing the full chat history and serialized `VirtualFileSystem` respectively. Prisma client is generated to `src/generated/prisma`.
