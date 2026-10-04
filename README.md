# Hedgehog

Self-hosted media player for anime libraries. The repo bundles a Vue 3
single-page application and an AdonisJS REST API that scans a local
directory of video files, enriches each entry with metadata from
MyAnimeList (via Jikan) and streams playback to authenticated users.

The name comes from the project's two-part layout:

- `hedgehog_api/` — AdonisJS 6 backend (SQLite, Lucid ORM, ffmpeg-based
  thumbnail generation).
- `hedgehog_front/` — Vue 3 + Vite frontend (Pinia, vue-router, scoped
  CSS, custom design tokens).

## Features

- Library view that auto-discovers anime, seasons and episodes by walking
  the media directory.
- Metadata enrichment: synopsis, cover art, studios, genres, voice
  actors, airing status, filler/recap flags.
- On-the-fly thumbnail generation through ffmpeg.
- Built-in HTML5 player with playback speed, double-tap seek hints,
  fullscreen, picture-in-picture, keyboard shortcuts, next/previous
  episode navigation and per-season episode numbering.
- Smart playback: each file is analysed with ffprobe and delivered the
  cheapest way the browser can handle — **direct play**, **remux**
  (video copied, audio/container converted, e.g. MKV) or **transcode**
  (H.264 at source resolution or downscaled to 1080p/720p/480p/360p).
  Seeking works in every mode, and the player falls back to a
  conversion by itself when the browser can't decode a file.
- Audio track selection and subtitles from sidecar files or embedded in
  the container (ASS rendered with JASSUB, SRT/VTT natively).
- Per-user watch state: resume where you left off, watched flags on
  episodes/seasons/shows, favorites, "Continue watching", "Next up" and
  "Recently added" shelves, automatic next episode.
- Library tools: search, genre filter, sorting, automatic clean-up of
  deleted files, manual rescan and metadata re-identification by
  MyAnimeList id.
- Multi-user with roles: first-run setup creates the administrator, who
  then manages accounts from the admin dashboard (library stats, scan
  status, active sessions and running conversions).
- Token-based authentication (AdonisJS Auth + access tokens).
- Theme switcher (default dark, gruvbox, tokyonight, light) with
  per-user persistence in localStorage.

## Architecture

```
web-media-player/
├── hedgehog_api/                AdonisJS 6 backend
│   ├── app/
│   │   ├── controllers/         HTTP entry points (files, session, progress, admin, …)
│   │   ├── models/              Lucid models (Anime, Season, Episode, …)
│   │   └── services/            FileService, MediaInfoService, TranscodeService,
│   │                            SubtitleService, JikanService, ThumbnailService
│   ├── config/                  Adonis configuration
│   ├── database/migrations/     SQLite schema
│   ├── media/                   User-provided video library (gitignored)
│   ├── public/thumbnails/       Generated thumbnails
│   ├── start/                   Routes, kernel, hooks
│   └── tmp/                     SQLite database file
│
├── hedgehog_front/              Vue 3 SPA
│   └── src/
│       ├── components/
│       │   ├── anime/           AnimeCard, AnimeHero, SeasonAccordion, …
│       │   ├── player/          VideoPlayer, PlayerControls, ProgressBar, …
│       │   ├── layout/          NavBar
│       │   └── ui/              StatusPill, MetaChip, icons
│       ├── composables/         useVideoPlayer, useSubtitles
│       ├── styles/              variables.css, themes.css, base.css
│       ├── types/               Domain types shared across the app
│       ├── utils/               api, fileStore, authStore, progressStore, settingsStore, format helpers
│       └── views/               Home, AnimeView, PlayerView, Settings, Admin, Setup, SignIn
│
├── docker-compose.dev.yml       Dev stack with hot reload
├── docker-compose.prod.yml      Production stack behind nginx
└── .env.example                 Template for the root .env file
```

## Requirements

- Node.js 22+ (24 is what the project's tsconfig targets).
- ffmpeg and ffprobe available on `PATH` (only needed when running
  outside Docker).
- A directory of video files following the convention
  `media/<anime>/<season>/<episode.ext>`.

When using Docker, only Docker Engine 24+ and the Compose plugin are
required on the host.

## Running with Docker

The compose files at the repository root cover the two usual workflows.

### First-time setup

```bash
cp .env.example .env
# Edit .env to set APP_KEY (at least 16 characters) and, optionally,
# MEDIA_DIR, HTTP_PORT and TZ.
```

Generate a fresh key with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

### Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

What happens:

- The backend image installs deps and runs `node ace serve --hmr`. Your
  source code is bind-mounted into `/app` so file changes trigger
  AdonisJS' hot reload.
- The frontend image runs `vite --host 0.0.0.0`. Source is bind-mounted
  the same way, so HMR works for Vue components.
- `node_modules` for both services live in named volumes to avoid being
  shadowed by the host bind mount.
- SQLite data is persisted in the `api_db` volume between restarts.

Once the containers are up:

- Frontend — http://localhost:5173
- API — http://localhost:3333

In dev the SPA talks to the API directly via the published port; CORS is
already permissive in `hedgehog_api/config/cors.ts`.

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

What happens:

- The backend image runs the precompiled bundle produced by
  `node ace build`, with ffmpeg and tini installed in the runtime layer.
  The API is not published to the host — only the internal Docker
  network can reach it.
- The frontend image is a multi-stage build. Vite produces a static
  bundle (with `VITE_API_BASE_URL=/api` baked in), then nginx serves it
  on port 80.
- nginx reverse-proxies `/api/*` to the backend service. The trailing
  slash on `proxy_pass http://hedgehog_api/` strips the prefix, so
  `/api/auth` reaches the API as `/auth`. Streaming endpoints use
  `proxy_buffering off` and a one-hour read timeout to support large
  files.
- The SQLite database, generated thumbnails and the media directory are
  mounted into the API container so data survives container rebuilds.
  The `media/` mount is read-only by default.

Once the stack is up the SPA is available at `http://<host>:<HTTP_PORT>`
(defaults to `:80`).

### Common compose commands

```bash
# Tail logs
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f front

# Run an Adonis command inside the dev container
docker compose -f docker-compose.dev.yml exec api node ace migration:run

# Rebuild after dependency changes
docker compose -f docker-compose.dev.yml build --no-cache front

# Stop and remove containers, keep volumes
docker compose -f docker-compose.dev.yml down

# Stop and remove containers AND volumes (resets the DB)
docker compose -f docker-compose.dev.yml down -v
```

## Running locally without Docker

### Backend

```bash
cd hedgehog_api
cp .env.example .env   # if you don't already have a .env
npm install
node ace migration:run
npm run dev
```

The API listens on `http://localhost:3333`. Drop video files into
`hedgehog_api/media/` following the `<anime>/<season>/<episode.ext>`
convention; the file scanner picks them up on the next library refresh.

### Frontend

```bash
cd hedgehog_front
npm install
npm run dev
```

Open http://localhost:5173. On a fresh instance the setup screen asks you
to create the administrator account; other accounts are then created
from **Administration → Utilisateurs** (there is no public sign-up).

To point the SPA at a different API host, set `VITE_API_BASE_URL` before
starting Vite:

```bash
VITE_API_BASE_URL=http://my-server:3333 npm run dev
```

## Environment variables

| Variable           | Where         | Default                  | Description                                            |
|--------------------|---------------|--------------------------|--------------------------------------------------------|
| `APP_KEY`          | backend       | —                        | AdonisJS app key (16+ chars). Required.                |
| `HOST`             | backend       | `0.0.0.0` (Docker)       | Interface the HTTP server binds to.                    |
| `PORT`             | backend       | `3333`                   | HTTP port.                                             |
| `LOG_LEVEL`        | backend       | `info`                   | Adonis log level.                                      |
| `TZ`               | backend       | `UTC`                    | Timezone for log timestamps and dates.                 |
| `NODE_ENV`         | backend       | `development` / `production` | Adonis runtime mode.                                |
| `VITE_API_BASE_URL`| frontend build | `http://localhost:3333` (dev) / `/api` (prod) | Base URL the SPA uses for API calls. |
| `HTTP_PORT`        | compose prod  | `80`                     | Host port nginx publishes.                             |
| `MEDIA_DIR`        | compose prod  | `./hedgehog_api/media`   | Host directory mounted into the API container.         |

## Useful npm scripts

### Backend (`hedgehog_api/`)

| Command           | Purpose                                  |
|-------------------|------------------------------------------|
| `npm run dev`     | `node ace serve --hmr`                   |
| `npm run build`   | `node ace build` (writes to `./build`)   |
| `npm start`       | Run the production bundle                |
| `npm run lint`    | ESLint                                   |
| `npm run format`  | Prettier                                 |
| `npm test`        | `node ace test`                          |

### Frontend (`hedgehog_front/`)

| Command           | Purpose                                  |
|-------------------|------------------------------------------|
| `npm run dev`     | Vite dev server with HMR                 |
| `npm run build`   | Type-check + production bundle (`dist/`) |
| `npm run preview` | Preview the production bundle locally    |
| `npm run type-check` | `vue-tsc --build`                     |
| `npm run lint`    | ESLint                                   |
| `npm run format`  | Prettier                                 |
| `npm run test:unit` | Vitest                                 |

## Tech stack

- AdonisJS 6, Lucid ORM, better-sqlite3
- VineJS validators
- ffmpeg (thumbnail generation via the `execa` wrapper)
- Vue 3 with `<script setup>`, Pinia, vue-router 4
- Vite 7
- nginx 1.27 (production reverse proxy and SPA host)

## License

MIT — see [LICENSE](LICENSE).
