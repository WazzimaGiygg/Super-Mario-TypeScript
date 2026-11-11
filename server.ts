import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// --- IN-MEMORY ROOMS STATE ---
interface ClientInfo {
  ws: WebSocket;
  id: string;
  name: string;
  character: 'mario' | 'wazzima';
  roomId: string;
}

const rooms = new Map<string, Map<string, ClientInfo>>();

// --- WEBSOCKET SERVER ON /ws ---
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId: string, senderId: string | null, message: any, includeSender = false) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach((client, clientId) => {
    if (!includeSender && clientId === senderId) return;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  });
}

wss.on('connection', (ws: WebSocket, req) => {
  let clientInfo: ClientInfo | null = null;

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());
      const { type, roomId, senderId, payload } = msg;

      if (type === 'join') {
        const cleanRoom = roomId ? String(roomId).trim().toUpperCase() : 'LOBBY';
        const cleanSenderId = senderId || Math.random().toString(36).substring(2, 9);
        const name = payload?.name || (payload?.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario');
        const character = payload?.character === 'wazzima' ? 'wazzima' : 'mario';

        // Leave any previous room
        if (clientInfo) {
          const oldRoom = rooms.get(clientInfo.roomId);
          if (oldRoom) {
            oldRoom.delete(clientInfo.id);
            if (oldRoom.size === 0) rooms.delete(clientInfo.roomId);
            else broadcastToRoom(clientInfo.roomId, clientInfo.id, { type: 'player_left', senderId: clientInfo.id });
          }
        }

        if (!rooms.has(cleanRoom)) {
          rooms.set(cleanRoom, new Map());
        }
        const room = rooms.get(cleanRoom)!;

        clientInfo = {
          ws,
          id: cleanSenderId,
          name,
          character,
          roomId: cleanRoom,
        };
        room.set(cleanSenderId, clientInfo);

        // Send existing room members to the new player
        const existingPlayers = Array.from(room.values())
          .filter(c => c.id !== cleanSenderId)
          .map(c => ({ id: c.id, name: c.name, character: c.character }));

        ws.send(JSON.stringify({
          type: 'room_joined',
          roomId: cleanRoom,
          senderId: cleanSenderId,
          payload: {
            players: existingPlayers,
          },
        }));

        // Notify other room members
        broadcastToRoom(cleanRoom, cleanSenderId, {
          type: 'player_joined',
          roomId: cleanRoom,
          senderId: cleanSenderId,
          payload: {
            id: cleanSenderId,
            name,
            character,
          },
        });
      } else if (type === 'player_update' && clientInfo) {
        // Forward position/action update to other room members
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'player_update',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          payload,
        });
      } else if (type === 'world_event' && clientInfo) {
        // Forward world action (block hit, enemy stomp, fireball)
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'world_event',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          payload,
        });
      } else if (type === 'chat' && clientInfo) {
        broadcastToRoom(clientInfo.roomId, null, {
          type: 'chat',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          payload: {
            name: clientInfo.name,
            character: clientInfo.character,
            text: payload?.text,
            time: Date.now(),
          },
        }, true);
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (clientInfo) {
      const room = rooms.get(clientInfo.roomId);
      if (room) {
        room.delete(clientInfo.id);
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'player_left',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
        });
        if (room.size === 0) {
          rooms.delete(clientInfo.roomId);
        }
      }
    }
  });
});

// --- API ROUTES ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    connections: wss.clients.size,
    roomsCount: rooms.size,
    time: Date.now(),
  });
});

app.get('/api/rooms', (_req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, map]) => ({
    id,
    playersCount: map.size,
    players: Array.from(map.values()).map(c => ({ name: c.name, character: c.character })),
  }));
  res.json({ rooms: roomList });
});

// --- VITE MIDDLEWARE IN DEV / STATIC SERVE IN PROD ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Super Mario Bros] Server running at http://0.0.0.0:${port}`);
    console.log(`[Super Mario Bros] WebSocket multiplayer active at ws://0.0.0.0:${port}/ws`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
