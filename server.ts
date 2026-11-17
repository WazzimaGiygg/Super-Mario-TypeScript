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
const MAX_ROOM_PLAYERS = 16;
const ROOM_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WS_HEARTBEAT_INTERVAL_MS = 20 * 1000; // 20 seconds
const ALLOWED_POWERS = new Set(['small', 'super', 'fire', 'tanooki', 'femboy', 'cape']);

interface ClientInfo {
  ws: WebSocket;
  id: string;
  name: string;
  character: 'mario' | 'wazzima';
  roomId: string;
  isAlive: boolean;
  lastActionSig: string;
}

const rooms = new Map<string, Map<string, ClientInfo>>();
const roomLastActivity = new Map<string, number>();

// --- WEBSOCKET SERVER ON /ws ---
const wss = new WebSocketServer({ server, path: '/ws' });

function touchWsRoomActivity(roomId: string) {
  roomLastActivity.set(roomId, Date.now());
}

function removeClientFromWsRoom(clientInfo: ClientInfo) {
  const room = rooms.get(clientInfo.roomId);
  if (!room) return;
  room.delete(clientInfo.id);
  broadcastToRoom(clientInfo.roomId, clientInfo.id, {
    type: 'player_left',
    roomId: clientInfo.roomId,
    senderId: clientInfo.id,
    payload: { id: clientInfo.id, name: clientInfo.name },
  });
  if (room.size === 0) {
    rooms.delete(clientInfo.roomId);
    roomLastActivity.delete(clientInfo.roomId);
  }
}

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

// Heartbeat & 5-minute inactive room auto-cleanup sweep
const wsSweepInterval = setInterval(() => {
  const now = Date.now();

  // 1. Detect dropped / logged-off WebSocket clients
  rooms.forEach((room) => {
    Array.from(room.values()).forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        removeClientFromWsRoom(client);
        return;
      }
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });
  });

  // 2. Auto-remove rooms inactive for > 5 minutes
  roomLastActivity.forEach((lastTs, roomId) => {
    if (now - lastTs > ROOM_INACTIVITY_TIMEOUT_MS) {
      const room = rooms.get(roomId);
      if (room) {
        broadcastToRoom(
          roomId,
          null,
          {
            type: 'room_expired',
            roomId,
            senderId: 'server',
            payload: {
              message: 'Sala removida automaticamente por inatividade (mais de 5 minutos sem atividade).',
            },
          },
          true
        );
        room.forEach((client) => {
          try {
            client.ws.close(4000, 'Room inactive over 5 minutes');
          } catch {
            // ignore
          }
        });
        rooms.delete(roomId);
      }
      roomLastActivity.delete(roomId);
    }
  });
}, WS_HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(wsSweepInterval);
});

wss.on('connection', (ws: WebSocket) => {
  let clientInfo: ClientInfo | null = null;

  ws.on('pong', () => {
    if (clientInfo) {
      clientInfo.isAlive = true;
    }
  });

  ws.on('message', (rawData) => {
    try {
      const rawStr = rawData.toString();
      if (rawStr.length > 8192) return;
      const msg = JSON.parse(rawStr);
      if (!msg || typeof msg !== 'object') return;
      const { type, roomId, senderId, seq, payload } = msg;

      if (clientInfo) {
        clientInfo.isAlive = true;
      }

      if (type === 'join') {
        const rawRoom = typeof roomId === 'string' ? roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : '';
        const cleanRoom = rawRoom.length >= 2 ? rawRoom.slice(0, 32) : 'SALA-1';
        const rawSender = typeof senderId === 'string' ? senderId.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
        const cleanSenderId = rawSender.length >= 1 ? rawSender.slice(0, 128) : Math.random().toString(36).substring(2, 9);
        const character = payload?.character === 'wazzima' ? 'wazzima' : 'mario';
        const rawName = typeof payload?.name === 'string' ? payload.name.trim().slice(0, 32) : '';
        const name = rawName || (character === 'wazzima' ? 'WazzimaGiygg' : 'Mario');

        // Leave any previous room
        if (clientInfo) {
          removeClientFromWsRoom(clientInfo);
        }

        if (!rooms.has(cleanRoom)) {
          rooms.set(cleanRoom, new Map());
        }
        const room = rooms.get(cleanRoom)!;

        // Enforce 16-player room limit (allow re-join if same player ID is replacing stale socket)
        if (!room.has(cleanSenderId) && room.size >= MAX_ROOM_PLAYERS) {
          ws.send(JSON.stringify({
            type: 'room_full',
            roomId: cleanRoom,
            senderId: cleanSenderId,
            payload: {
              maxPlayers: MAX_ROOM_PLAYERS,
              message: `Sala cheia (limite de ${MAX_ROOM_PLAYERS} jogadores atingido).`,
            },
          }));
          return;
        }

        clientInfo = {
          ws,
          id: cleanSenderId,
          name,
          character,
          roomId: cleanRoom,
          isAlive: true,
          lastActionSig: '',
        };
        room.set(cleanSenderId, clientInfo);
        touchWsRoomActivity(cleanRoom);

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
      } else if (type === 'player_update' && clientInfo && payload && typeof payload === 'object') {
        // Strict player identity & room validation (reject spoofed senderId or mismatched roomId)
        if (senderId && senderId !== clientInfo.id) return;
        if (roomId && String(roomId).trim().toUpperCase() !== clientInfo.roomId) return;

        const cleanPayload: Record<string, unknown> = { id: clientInfo.id };
        if (typeof payload.name === 'string') cleanPayload.name = payload.name.slice(0, 32);
        if (payload.character === 'mario' || payload.character === 'wazzima') cleanPayload.character = payload.character;
        if (typeof payload.x === 'number' && Number.isFinite(payload.x)) cleanPayload.x = Math.max(-100, Math.min(20000, payload.x));
        if (typeof payload.y === 'number' && Number.isFinite(payload.y)) cleanPayload.y = Math.max(-200, Math.min(1000, payload.y));
        if (typeof payload.vx === 'number' && Number.isFinite(payload.vx)) cleanPayload.vx = Math.max(-50, Math.min(50, payload.vx));
        if (typeof payload.vy === 'number' && Number.isFinite(payload.vy)) cleanPayload.vy = Math.max(-50, Math.min(50, payload.vy));
        if (payload.facing === 'left' || payload.facing === 'right') cleanPayload.facing = payload.facing;
        if (typeof payload.power === 'string' && ALLOWED_POWERS.has(payload.power)) cleanPayload.power = payload.power;
        if (typeof payload.state === 'string') cleanPayload.state = payload.state.slice(0, 32);
        if (typeof payload.animFrame === 'number' && Number.isFinite(payload.animFrame)) cleanPayload.animFrame = Math.max(0, Math.min(10, Math.floor(payload.animFrame)));
        if (typeof payload.isStatue === 'boolean') cleanPayload.isStatue = payload.isStatue;
        if (typeof payload.tailWhipTimer === 'number' && Number.isFinite(payload.tailWhipTimer)) cleanPayload.tailWhipTimer = Math.max(0, Math.min(100, Math.floor(payload.tailWhipTimer)));
        if (typeof payload.isFluttering === 'boolean') cleanPayload.isFluttering = payload.isFluttering;
        if (typeof payload.invulnerable === 'boolean') cleanPayload.invulnerable = payload.invulnerable;
        if (typeof payload.score === 'number' && Number.isFinite(payload.score)) cleanPayload.score = Math.max(0, Math.floor(payload.score));
        if (typeof payload.lives === 'number' && Number.isFinite(payload.lives)) cleanPayload.lives = Math.max(0, Math.min(999, Math.floor(payload.lives)));
        if (typeof payload.coins === 'number' && Number.isFinite(payload.coins)) cleanPayload.coins = Math.max(0, Math.min(999, Math.floor(payload.coins)));
        if (typeof payload.stageCleared === 'boolean') cleanPayload.stageCleared = payload.stageCleared;
        if (typeof payload.levelId === 'string') cleanPayload.levelId = payload.levelId.slice(0, 64);

        const sig = `${Math.round(Number(cleanPayload.x ?? 0))}:${Math.round(Number(cleanPayload.y ?? 0))}:${cleanPayload.state ?? ''}:${cleanPayload.score ?? ''}:${cleanPayload.lives ?? ''}:${String(cleanPayload.stageCleared ?? '')}:${cleanPayload.levelId ?? ''}`;
        if (sig !== clientInfo.lastActionSig) {
          clientInfo.lastActionSig = sig;
          touchWsRoomActivity(clientInfo.roomId);
        }
        // Forward validated delta/full position update to other room members
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'player_update',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          seq: typeof seq === 'number' && Number.isFinite(seq) ? Math.floor(seq) : undefined,
          payload: cleanPayload,
        });
      } else if (type === 'world_event' && clientInfo && payload && typeof payload === 'object') {
        if (senderId && senderId !== clientInfo.id) return;
        if (roomId && String(roomId).trim().toUpperCase() !== clientInfo.roomId) return;
        const allowedEvents = new Set(['enemy_defeat', 'coin_collect', 'brick_break', 'level_change']);
        if (!allowedEvents.has(payload.eventType)) return;
        touchWsRoomActivity(clientInfo.roomId);
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'world_event',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          seq: typeof seq === 'number' && Number.isFinite(seq) ? Math.floor(seq) : undefined,
          payload,
        });
      } else if (type === 'world_events_batch' && clientInfo && Array.isArray(payload?.events)) {
        if (senderId && senderId !== clientInfo.id) return;
        if (roomId && String(roomId).trim().toUpperCase() !== clientInfo.roomId) return;
        const allowedEvents = new Set(['enemy_defeat', 'coin_collect', 'brick_break', 'level_change']);
        const validEvents = payload.events
          .slice(0, 20)
          .filter((ev: any) => ev && allowedEvents.has(ev.eventType) && typeof ev.x === 'number' && typeof ev.y === 'number');
        if (validEvents.length === 0) return;
        touchWsRoomActivity(clientInfo.roomId);
        broadcastToRoom(clientInfo.roomId, clientInfo.id, {
          type: 'world_events_batch',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          seq: typeof seq === 'number' && Number.isFinite(seq) ? Math.floor(seq) : undefined,
          payload: { events: validEvents },
        });
      } else if (type === 'chat' && clientInfo) {
        if (senderId && senderId !== clientInfo.id) return;
        if (roomId && String(roomId).trim().toUpperCase() !== clientInfo.roomId) return;
        const cleanText = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 120) : '';
        if (!cleanText) return;
        touchWsRoomActivity(clientInfo.roomId);
        broadcastToRoom(clientInfo.roomId, null, {
          type: 'chat',
          roomId: clientInfo.roomId,
          senderId: clientInfo.id,
          payload: {
            name: clientInfo.name,
            character: clientInfo.character,
            text: cleanText,
            time: Date.now(),
          },
        }, true);
      } else if (type === 'ping_probe' && clientInfo) {
        ws.send(JSON.stringify({
          type: 'pong_probe',
          roomId: clientInfo.roomId,
          senderId: 'server',
          payload: { t: typeof payload?.t === 'number' ? payload.t : Date.now() },
        }));
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (clientInfo) {
      removeClientFromWsRoom(clientInfo);
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
  const now = Date.now();
  const roomList = Array.from(rooms.entries()).map(([id, map]) => {
    const lastTs = roomLastActivity.get(id) ?? now;
    return {
      id,
      playersCount: map.size,
      maxPlayers: MAX_ROOM_PLAYERS,
      inactiveSeconds: Math.max(0, Math.floor((now - lastTs) / 1000)),
      players: Array.from(map.values()).map(c => ({ name: c.name, character: c.character })),
    };
  });
  res.json({ rooms: roomList });
});

// --- VITE MIDDLEWARE IN DEV / STATIC SERVE IN PROD ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const wsOnly = process.env.WS_ONLY === '1';

  if (!wsOnly) {
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
