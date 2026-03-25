import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import watchlistRouter from './routes/watchlist.js';
import { wsClients } from './services/broadcast.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProd ? true : ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));
app.use(express.json());
app.use('/api/watchlist', watchlistRouter);

// En producción: servir el build de React
if (isProd) {
  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

// HTTP server + WebSocket sobre el mismo puerto
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  if (!req.url.startsWith('/ws')) { ws.close(); return; }
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

httpServer.listen(PORT, () => {
  console.log(`Jony Signal server running on port ${PORT}`);
});
