# SQLite Viewer

A read-only SQLite database viewer with a clean, Morandi-inspired UI.

## Features

- Browse `memories`, `diary`, and `consciousness_log` tables
- Filter and search functionality
- Mobile-friendly (Telegram Mini App ready)
- Extensible architecture for adding new tables/pages

## Quick Start

### 1. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure Database Path

Copy `.env.example` to `.env` and set your database path:

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_PATH=/path/to/your/memories.db
```

### 3. Start Development

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start client
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## Production-style Run

This project is designed to run in production as:

- one built React frontend
- one Express server that serves both:
  - static frontend files
  - `/api/*` endpoints

### 1. Build the client

```bash
cd client
npm install
npm run build
```

### 2. Start the server

```bash
cd ../server
npm install
npm start
```

If the frontend build exists in `client/dist`, Express will automatically:

- serve the built frontend
- serve all API endpoints under `/api`
- return `index.html` for non-API routes such as `/diary` and `/consciousness`

That means the same server process can be used behind your domain and inside Telegram Mini App.

## Project Structure

```
sqlite-viewer/
├── client/                    # React frontend
│   ├── src/
│   │   ├── api/               # API layer
│   │   ├── components/        # Shared components
│   │   ├── views/             # Page views
│   │   └── theme/             # Theme system
│   └── vite.config.js
├── server/                    # Express backend
│   ├── db/                    # Database connection
│   ├── routes/                # API routes
│   └── index.js
├── .env.example
└── README.md
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/memories` - List memories (supports `tag`, `agent`, `channel`, `q`, `sort`)
- `GET /api/memories/tags` - Get all unique tags
- `GET /api/memories/agents` - Get all unique agents
- `GET /api/memories/channels` - Get all unique channels
- `GET /api/diary/dates` - Get all diary dates
- `GET /api/diary?date=YYYY-MM-DD` - Get diary entries for a date
- `GET /api/consciousness` - List consciousness logs (supports `action_type`, `date_from`, `date_to`, `sort`)
- `GET /api/consciousness/action-types` - Get all action types

## Extending

### Adding a New Table/Page

1. **Backend**: Create `server/routes/newtable.js` with your queries
2. **Frontend API**: Create `client/src/api/newtable.js`
3. **Frontend View**: Create `client/src/views/NewTable/` with page components
4. **Router**: Add route in `client/src/App.jsx`
5. **Navigation**: Add nav item in `client/src/components/Layout/NavBar.jsx`

### Theme Customization

Edit `client/src/theme/tokens.css` to customize:
- Colors (Morandi palette)
- Typography
- Spacing
- Border radius
- Shadows

Dark mode support is pre-configured with `[data-theme="dark"]` selector.

### Telegram Mini App Integration

The UI is designed to work in Telegram Mini Apps:
- Viewport meta tag configured
- Safe area insets support
- Touch-friendly interactions
- Theme variable mapping ready (see `client/src/theme/theme.js`)

## Deployment Notes

- The backend is read-only by design.
- `DB_PATH` supports `~/mcp-memory/memories.db` on Linux.
- Production expects the built frontend files in `client/dist` unless `CLIENT_DIST` is overridden.
- If `client/dist` does not exist, the server will still run, but the root page will return a clear error telling you the frontend has not been built yet.

## License

MIT
