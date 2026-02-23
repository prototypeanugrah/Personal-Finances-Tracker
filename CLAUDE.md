# Project Configuration for Claude Code

## Package Manager

**Use `bun` as the package manager for this project.**

Do NOT use npm. Always use bun commands:
- `bun install` instead of `npm install`
- `bun run build` instead of `npm run build`
- `bun run dev` instead of `npm run dev`
- `bun add <package>` instead of `npm install <package>`

## Project Structure

- `/app` - Main application directory (React + Convex)
- `/app/src` - React frontend source
- `/app/convex` - Convex backend functions

## Key Commands

```bash
# Install dependencies
cd app && bun install

# Start development server
cd app && bun run dev

# Build for production
cd app && bun run build

# Push Convex schema changes
cd app && bunx convex dev --once

# Start Convex dev server
cd app && bunx convex dev
```

## Technology Stack

- React 19
- TypeScript
- Vite
- Convex (Backend)
- Framer Motion
- D3.js
