import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import memoriesRouter from './routes/memories.js';
import diaryRouter from './routes/diary.js';
import consciousnessRouter from './routes/consciousness.js';
import rawMessagesRouter from './routes/rawMessages.js';
import usageRouter from './routes/usage.js';
import forgeRouter from './routes/forge.js';
import handoffRouter from './routes/handoff.js';
import importRouter from './routes/import.js';
import { closeDb, getDbInfo } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const rootEnvPath = path.join(projectRoot, '.env');
const serverEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}

const clientDistPath = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(__dirname, '../client/dist');
const hasClientDist = fs.existsSync(path.join(clientDistPath, 'index.html'));

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  try {
    const db = getDbInfo();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: db,
      frontend: {
        staticEnabled: hasClientDist,
        distPath: clientDistPath,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      frontend: {
        staticEnabled: hasClientDist,
        distPath: clientDistPath,
      },
    });
  }
});

// Handoff file (read-only)
app.get('/api/handoff', (req, res) => {
  const handoffPath = process.env.HANDOFF_PATH || path.join(process.env.HOME || '/home/claude', 'handoff.md');
  try {
    if (!fs.existsSync(handoffPath)) {
      return res.status(404).json({ error: 'Handoff file not found' });
    }
    const stat = fs.statSync(handoffPath);
    const content = fs.readFileSync(handoffPath, 'utf-8');
    res.json({
      content,
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
    });
  } catch (err) {
    console.error('Error reading handoff file:', err);
    res.status(500).json({ error: 'Failed to read handoff file' });
  }
});

// Routes
app.use('/api/handoff', handoffRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/consciousness', consciousnessRouter);
app.use('/api/raw-messages', rawMessagesRouter);
app.use('/api/import', importRouter);
app.use('/api/usage', usageRouter);
app.use('/api/forge', forgeRouter);

if (hasClientDist) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(503).json({
      error: 'Frontend build not found',
      hint: 'Run the client build before using the production server',
      expectedDistPath: clientDistPath,
    });
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database path: ${getDbInfo().path}`);
  console.log(`Frontend static mode: ${hasClientDist ? 'enabled' : 'disabled'}`);
});
