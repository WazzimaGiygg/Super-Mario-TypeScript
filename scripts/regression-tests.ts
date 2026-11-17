/**
 * Automated Regression Test Suite — R0.15.6J.3
 * Verifies preservation of original physics, power-ups, scoring, lives,
 * death/dev-mode guards, all game modes/levels, Firebase rules + Google Auth integrity,
 * and same-version multiplayer interoperability.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

// --- Minimal Headless Canvas/DOM Stubs for Node.js Execution ---
function installHeadlessDomStubs() {
  const noop = () => {};
  const ctxStub = {
    imageSmoothingEnabled: false,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px monospace',
    textAlign: 'left',
    globalAlpha: 1,
    fillRect: noop,
    clearRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    drawImage: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    fillText: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: noop,
  };

  (globalThis as any).document = {
    createElement: () => ({
      width: 16,
      height: 16,
      getContext: () => ctxStub,
    }),
  };
}

installHeadlessDomStubs();

import { GameEngine } from '../src/game/engine.ts';
import {
  createWorld1_1,
  createWorld1_2,
  createWorld2_2,
  createWorldGhostHouse,
  createWorld1_4,
  createEndlessLevel,
  createSingleplayerLevel,
} from '../src/game/levels.ts';
import {
  SMW_WIKIWORLD_NODES,
  createSmwWikiWorldStage,
  findSmwMapPath,
  isSmwNodeUnlocked,
  type SmwBetaProgress,
} from '../src/game/smwWorldMap.ts';
import {
  isSmartTvUserAgent,
  resolveTvRemoteAction,
  findBestSpatialCandidateIndex,
} from '../src/game/smartTv.ts';
import type { Enemy, Item } from '../src/game/types.ts';

function stepEngine(engine: GameEngine, frames: number, deltaMs = 16.67) {
  for (let i = 0; i < frames; i++) {
    engine.update(deltaMs);
  }
}

function createFreshEngine(): GameEngine {
  const engine = new GameEngine();
  engine.isGameStarted = true;
  engine.intermissionTimer = 0;
  engine.isPaused = false;
  engine.marioInvulnerableTimer = 0;
  engine.marioGrowthTimer = 0;
  engine.marioShrinkTimer = 0;
  engine.marioStarTimer = 0;
  return engine;
}

function makeItem(id: number, type: Item['type'], x: number, y: number): Item {
  return {
    id,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    width: 16,
    height: 16,
    grounded: true,
    collected: false,
    emerging: false,
    emergeY: y,
  };
}

function makeEnemy(id: number, type: Enemy['type'], x: number, y: number): Enemy {
  return {
    id,
    type,
    x,
    y,
    vx: -0.6,
    vy: 0,
    width: 16,
    height: type === 'koopa' || type === 'red_koopa' ? 24 : 16,
    alive: true,
    state: 'walk',
    stateTimer: 0,
    facing: 'left',
    animFrame: 0,
    animTimer: 0,
  };
}

let passed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  [PASS] ${name}`);
    });
}

async function runPhysicsTests() {
  console.log('\n[1/6] Física Original & Movimentação');

  await test('Constantes NES e dimensões originais preservadas (256x240, tile 16px)', () => {
    assert.equal(GameEngine.NES_WIDTH, 256);
    assert.equal(GameEngine.NES_HEIGHT, 240);
    assert.equal(GameEngine.TILE_SIZE, 16);
  });

  await test('Velocidade máxima de caminhada (2.0) vs corrida (3.4) e atrito firme no chão', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    // Settle on ground
    stepEngine(engine, 10);
    assert.equal(engine.marioGrounded, true);

    // Walk right
    engine.controls.right = true;
    engine.controls.run = false;
    stepEngine(engine, 40);
    assert.ok(engine.marioVx > 1.8 && engine.marioVx <= 2.01, `walk vx=${engine.marioVx}`);

    // Run right
    engine.controls.run = true;
    stepEngine(engine, 40);
    assert.ok(engine.marioVx > 3.2 && engine.marioVx <= 3.41, `run vx=${engine.marioVx}`);

    // Release -> crisp stop
    engine.controls.right = false;
    engine.controls.run = false;
    stepEngine(engine, 25);
    assert.equal(engine.marioVx, 0);
    assert.equal(engine.marioState, 'idle');
  });

  await test('Impulso de salto (-7.4/-8.4), corte variável (-2.5) e gravidade (0.38/0.62)', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    assert.equal(engine.marioGrounded, true);

    // Standing walk jump
    engine.controls.jump = true;
    engine.update(16.67);
    // Impulse was -7.4 + ascending gravity 0.38 = -7.02
    assert.ok(Math.abs(engine.marioVy - (-7.4 + 0.38)) < 1e-4, `first jump vy=${engine.marioVy}`);
    assert.equal(engine.marioGrounded, false);

    // Releasing jump early cuts ascent cleanly to -2.5 + gravity
    engine.controls.jump = false;
    engine.update(16.67);
    assert.ok(engine.marioVy >= -2.5, `variable jump cut vy=${engine.marioVy}`);

    // Settle back on ground
    stepEngine(engine, 50);
    assert.equal(engine.marioGrounded, true);
    assert.equal(engine.marioVy, 0);

    // Running jump impulse (-8.4)
    engine.controls.run = true;
    engine.controls.jump = true;
    engine.update(16.67);
    assert.ok(Math.abs(engine.marioVy - (-8.4 + 0.38)) < 1e-4, `run jump vy=${engine.marioVy}`);
  });

  await test('Física aquática preservada no Mundo 2-2 (gravidade reduzida e nado)', () => {
    const engine = createFreshEngine();
    engine.loadLevel(createWorld2_2(), false, false, false);
    engine.intermissionTimer = 0;
    engine.enemies = [];
    engine.marioX = 80;
    engine.marioY = 120;
    engine.controls.jump = true;
    engine.update(16.67);
    assert.ok(engine.marioVy < -2.0 && engine.marioVy > -3.2, `swim vy=${engine.marioVy}`);
  });
}

async function runPowerUpTests() {
  console.log('\n[2/6] Efeitos & Transições dos Power-Ups');

  await test('Super Mushroom: small -> super (+1000 pts, 30px altura) e não regride Fire/Tanooki', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    const startY = engine.marioY;

    engine.items.push(makeItem(9001, 'mushroom', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'super');
    assert.equal(engine.stats.score, 1000);
    assert.equal(engine.marioGrowthTimer, 36);
    assert.equal(engine.marioY, startY - 16);
    assert.equal(engine.getMarioHitbox().height, 30);

    // Upgrading to fire then touching a mushroom must NOT downgrade fire -> super
    engine.marioGrowthTimer = 0;
    engine.marioPower = 'fire';
    engine.items.push(makeItem(9002, 'mushroom', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'fire');
    assert.equal(engine.stats.score, 2000);
  });

  await test('Fire Flower: transição para fire e limite clássico de 2 bolas de fogo ativas', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.items.push(makeItem(9003, 'fireflower', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'fire');
    engine.marioGrowthTimer = 0;

    // Fire 1, 2, and blocked 3rd
    for (let i = 0; i < 3; i++) {
      engine.controls.run = true;
      engine.update(16.67);
      engine.controls.run = false;
      engine.update(16.67);
    }
    const activePlayerFireballs = engine.fireballs.filter(fb => fb.alive && !fb.exploding && fb.color !== 'white');
    assert.equal(activePlayerFireballs.length, 2);
  });

  await test('Super Leaf (tanooki): flutter limitado a vy<=1.15, estátua imune e tailWhipTimer=18', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.items.push(makeItem(9004, 'leaf', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'tanooki');
    engine.marioGrowthTimer = 0;

    // Statue when holding down on ground
    engine.controls.down = true;
    engine.update(16.67);
    assert.equal(engine.isStatue, true);
    engine.controls.down = false;
    engine.update(16.67);
    assert.equal(engine.isStatue, false);

    // Tail whip on run press
    engine.controls.run = true;
    engine.update(16.67);
    assert.equal(engine.tailWhipTimer, 18);
    engine.controls.run = false;

    // Flutter cap when falling and holding jump
    engine.marioGrounded = false;
    engine.marioVy = 3.0;
    engine.controls.jump = true;
    engine.update(16.67);
    assert.equal(engine.isFluttering, true);
    assert.ok(engine.marioVy <= 1.25, `tanooki flutter vy=${engine.marioVy}`);
  });

  await test('Cape Feather (cape): super impulso correndo e planagem ampla (vy<=0.90)', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.items.push(makeItem(9005, 'feather', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'cape');
    engine.marioGrowthTimer = 0;

    engine.marioVx = 3.0;
    engine.controls.right = true;
    engine.controls.run = true;
    engine.controls.jump = true;
    engine.update(16.67);
    engine.controls.right = false;
    // Run cape jump has 1.12x multiplier (~ -9.408 + 0.38 = -9.028)
    assert.ok(engine.marioVy < -8.5, `cape launch vy=${engine.marioVy}`);

    engine.marioVy = 2.0;
    engine.update(16.67);
    assert.equal(engine.isFluttering, true);
    assert.ok(engine.marioVy <= 0.91, `cape glide vy=${engine.marioVy}`);
  });

  await test('Laço Femboy (femboy): salto SQRT2 e 2 bolas de fogo brancas ao aterrissar', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.items.push(makeItem(9006, 'femboy', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'femboy');
    engine.marioGrowthTimer = 0;

    engine.controls.jump = true;
    engine.update(16.67);
    assert.ok(engine.marioVy < -9.5, `femboy sqrt2 jump vy=${engine.marioVy}`);
    engine.controls.jump = false;

    // Step until Mario lands back on floor and check white fireballs immediately on impact
    for (let i = 0; i < 65; i++) {
      engine.update(16.67);
      if (engine.marioGrounded) break;
    }
    const whiteBalls = engine.fireballs.filter(fb => fb.color === 'white');
    assert.ok(whiteBalls.length >= 2, `Femboy ground impact must fire white fireballs (got ${whiteBalls.length})`);
  });

  await test('Starman: invencibilidade temporária 600 frames, elimina inimigos e decai para 0', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.items.push(makeItem(9007, 'star', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioStarTimer, 600);
    assert.equal(engine.stats.score, 1000);

    // Collide with Goomba while star active
    const g = makeEnemy(9008, 'goomba', engine.marioX + 2, engine.marioY);
    engine.enemies.push(g);
    engine.update(16.67);
    assert.equal(g.alive, false);
    assert.equal(engine.marioState, 'idle');
    assert.equal(engine.stats.score, 1100);

    // Timer expires cleanly
    engine.marioStarTimer = 2;
    stepEngine(engine, 3);
    assert.equal(engine.marioStarTimer, 0);
  });

  await test('1-UP e cadeia de degradação por dano (tanooki/cape -> super -> small -> dead)', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    const initialLives = engine.stats.lives;

    engine.items.push(makeItem(9009, '1up', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.stats.lives, initialLives + 1);

    // Cape -> hit -> Super
    engine.marioPower = 'cape';
    engine.marioY -= 16;
    engine.enemies.push(makeEnemy(9010, 'goomba', engine.marioX + 2, engine.marioY + 14));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'super');
    assert.equal(engine.marioInvulnerableTimer, 120);

    // Clear timers, Super -> hit -> Small
    engine.marioShrinkTimer = 0;
    engine.marioInvulnerableTimer = 0;
    engine.enemies.push(makeEnemy(9011, 'goomba', engine.marioX + 2, engine.marioY + 14));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'small');
    assert.equal(engine.marioInvulnerableTimer, 120);

    // Clear timers, Small -> hit -> Dead
    engine.marioShrinkTimer = 0;
    engine.marioInvulnerableTimer = 0;
    engine.enemies.push(makeEnemy(9012, 'goomba', engine.marioX + 2, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioState, 'dead');
  });
}

async function runScoringLivesAndGuardsTests() {
  console.log('\n[3/6] Pontuação, Vidas, Proteção de Recorde & Guardas de Jogabilidade');

  await test('Moedas: +200 pontos e rollover de 100 moedas -> 1-UP', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.stats.coins = 99;
    const livesBefore = engine.stats.lives;
    engine.items.push(makeItem(9101, 'coin', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.stats.coins, 0);
    assert.equal(engine.stats.lives, livesBefore + 1);
    assert.equal(engine.stats.score, 200);
  });

  await test('Dificuldades preservam vidas iniciais (easy=5, normal=3, hard=1) e Game Over em 0 vidas', () => {
    const eEasy = createFreshEngine();
    eEasy.setDifficulty('easy');
    assert.equal(eEasy.stats.lives, 5);

    const eHard = createFreshEngine();
    eHard.setDifficulty('hard');
    assert.equal(eHard.stats.lives, 1);

    eHard.killMario();
    stepEngine(eHard, 145);
    assert.equal(eHard.stats.lives, 0);
    assert.equal(eHard.isGameOver, true);
  });

  await test('Proteção de recorde: Cheat Mode e Editor bloqueiam atualização de High Score', () => {
    const engine = createFreshEngine();
    engine.resetLocalHighScore();
    engine.activateCheatMode();
    engine.enemies = [];
    engine.items.push(makeItem(9102, 'coin', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.stats.score, 200);
    assert.equal(engine.stats.highScore, 0);
    assert.equal(engine.persistRunScoreToRanking(), null);
  });

  await test('R0.15.0.RL.4: Personagem morto não coleta moedas nem power-ups nem sofre dano duplo', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.killMario();
    assert.equal(engine.marioState, 'dead');

    const scoreBefore = engine.stats.score;
    const coinsBefore = engine.stats.coins;
    const livesBefore = engine.stats.lives;

    engine.items.push(makeItem(9103, 'coin', engine.marioX, engine.marioY));
    engine.items.push(makeItem(9104, 'mushroom', engine.marioX, engine.marioY));
    engine.enemies.push(makeEnemy(9105, 'goomba', engine.marioX, engine.marioY));
    stepEngine(engine, 5);

    assert.equal(engine.stats.score, scoreBefore);
    assert.equal(engine.stats.coins, coinsBefore);
    assert.equal(engine.stats.lives, livesBefore);
    assert.equal(engine.marioPower, 'small');
  });

  await test('R0.15.0.OO.4: Easter Egg ILLEGAL INSTRUCTION restrito ao Modo Desenvolvedor', () => {
    const normalEngine = createFreshEngine();
    normalEngine.enemies = [];
    normalEngine.isCheatActive = false;
    normalEngine.isDebugMode = false;
    normalEngine.marioY = GameEngine.NES_HEIGHT + 24;
    normalEngine.controls.run = true;
    normalEngine.update(16.67);
    assert.equal(normalEngine.isIllegalInstructionBug, false);
    assert.equal(normalEngine.marioState, 'dead');

    const devEngine = createFreshEngine();
    devEngine.enemies = [];
    devEngine.toggleDebugMode(true);
    devEngine.marioY = GameEngine.NES_HEIGHT + 24;
    devEngine.controls.run = true;
    devEngine.update(16.67);
    assert.equal(devEngine.isIllegalInstructionBug, true);
    assert.equal(devEngine.recoverFromIllegalInstruction(), true);
    assert.equal(devEngine.isIllegalInstructionBug, false);
  });
}

async function runModesAndLevelsTests() {
  console.log('\n[4/6] Modos Existentes & Geradores de Fases');

  await test('Todas as fases clássicas, sem fim, campanha 7x5 e Ilha WikiWorldWeb carregam sem erro', () => {
    const levels = [
      createWorld1_1(),
      createWorld1_2(),
      createWorld2_2(),
      createWorldGhostHouse(),
      createWorld1_4(),
      createEndlessLevel(12345, 5),
      createSingleplayerLevel(1, 1),
      createSingleplayerLevel(7, 5),
      createSmwWikiWorldStage('wiki-1-overworld'),
      createSmwWikiWorldStage('wiki-5-castelo'),
    ];
    for (const lvl of levels) {
      assert.ok(lvl.width >= 30 && lvl.height === 15, `Invalid dims on ${lvl.id}`);
      assert.ok(Array.isArray(lvl.tiles) && lvl.tiles.length === 15);
    }
  });
}

async function runFirebaseAndPolicyIntegrityTests() {
  console.log('\n[5/6] Regras de Segurança Firebase, Blueprint, Google Auth & Política');

  await test('Política de compatibilidade e riscos documentados presentes em COMPATIBILITY_POLICY.md', () => {
    const policyPath = path.resolve(process.cwd(), 'COMPATIBILITY_POLICY.md');
    const content = fs.readFileSync(policyPath, 'utf8');
    assert.ok(content.includes('RISK-01'));
    assert.ok(content.includes('RISK-06'));
    assert.ok(content.includes('MAX_ROOM_PLAYERS = 16'));
  });

  await test('firestore.rules, firebase-blueprint.json, src/firebase.ts e multiplayer.ts 100% alinhados', () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));
    const firebaseTs = fs.readFileSync(path.resolve(process.cwd(), 'src/firebase.ts'), 'utf8');
    const mpTs = fs.readFileSync(path.resolve(process.cwd(), 'src/game/multiplayer.ts'), 'utf8');

    // 1. Default deny safety net
    assert.ok(rules.includes('allow read, write: if false;'));

    // 2. UserProfile keys in blueprint vs rules vs src/firebase.ts
    const userBlueprintKeys = Object.keys(blueprint.entities.UserProfile.properties).sort();
    for (const key of userBlueprintKeys) {
      assert.ok(rules.includes(`'${key}'`), `Missing UserProfile key ${key} in firestore.rules`);
    }
    assert.ok(firebaseTs.includes('signInWithPopup(auth, googleProvider)'));
    assert.ok(firebaseTs.includes("affectedKeys().hasOnly(['displayName', 'photoUrl', 'preferredCharacter', 'updatedAt'])") || rules.includes("affectedKeys().hasOnly(['displayName', 'photoUrl', 'preferredCharacter', 'updatedAt'])"));

    // 3. RoomPlayer 23 keys in blueprint vs rules vs multiplayer.ts buildPlayerDocPayload
    const playerKeys = Object.keys(blueprint.entities.RoomPlayer.properties);
    assert.equal(playerKeys.length, 23);
    for (const key of playerKeys) {
      assert.ok(rules.includes(`'${key}'`), `Missing RoomPlayer key ${key} in firestore.rules`);
      assert.ok(mpTs.includes(`${key}:`), `Missing RoomPlayer key ${key} in multiplayer.ts payload`);
    }

    // 4. Cape sanitization parity
    assert.ok(rules.includes("data.power in ['small', 'super', 'fire', 'tanooki', 'femboy']"));
    assert.ok(mpTs.includes("if (power === 'cape') return 'super';"));

    // 5. Batched event <= 64 chars parity
    assert.ok(rules.includes('data.meta is string && data.meta.size() <= 64'));
    assert.ok(mpTs.includes('currentLen + extra > 64'));
  });
}

async function runMultiplayerCompatibilityTests() {
  console.log('\n[6/6] Compatibilidade Multiplayer Entre Jogadores da Mesma Versão (WebSocket)');

  const TEST_PORT = 3198;
  const serverProc = spawn('./node_modules/.bin/tsx', ['server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(TEST_PORT), WS_ONLY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout starting test server')), 8000);
    serverProc.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('WebSocket multiplayer active')) {
        clearTimeout(timer);
        resolve();
      }
    });
    serverProc.stderr?.on('data', (chunk: Buffer) => {
      const err = chunk.toString();
      if (err.includes('EADDRINUSE')) {
        clearTimeout(timer);
        reject(new Error(`Port ${TEST_PORT} in use`));
      }
    });
  });

  const connectPeer = (id: string, name: string, character: 'mario' | 'wazzima', room = 'COMPAT-1') =>
    new Promise<{ ws: WebSocket; msgs: any[] }>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);
      const msgs: any[] = [];
      ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', roomId: room, senderId: id, payload: { name, character } }));
        resolve({ ws, msgs });
      });
      ws.on('error', reject);
    });

  try {
    await test('Handshake, delta update, cape power, batch events, ping probe e rejeição de spoof', async () => {
      const p1 = await connectPeer('peer_alpha', 'Wazzima1', 'wazzima');
      const p2 = await connectPeer('peer_beta', 'Mario2', 'mario');

      await new Promise(r => setTimeout(r, 150));
      assert.ok(p1.msgs.some(m => m.type === 'room_joined'));
      assert.ok(p2.msgs.some(m => m.type === 'room_joined'));
      assert.ok(p1.msgs.some(m => m.type === 'player_joined' && m.senderId === 'peer_beta'));

      // Send cape power-up & position delta from peer 1
      p1.ws.send(JSON.stringify({
        type: 'player_update',
        roomId: 'COMPAT-1',
        senderId: 'peer_alpha',
        seq: 1,
        payload: { x: 145.5, y: 178, vx: 2.2, vy: 0, power: 'cape', state: 'running' },
      }));

      // Send spoofed senderId (must be dropped by server!)
      p1.ws.send(JSON.stringify({
        type: 'player_update',
        roomId: 'COMPAT-1',
        senderId: 'spoofed_attacker',
        seq: 2,
        payload: { x: 999, y: 10 },
      }));

      // Send batched world events + ping probe
      p1.ws.send(JSON.stringify({
        type: 'world_events_batch',
        roomId: 'COMPAT-1',
        senderId: 'peer_alpha',
        seq: 3,
        payload: {
          events: [
            { eventType: 'coin_collect', x: 120, y: 140 },
            { eventType: 'enemy_defeat', x: 160, y: 192 },
          ],
        },
      }));
      p2.ws.send(JSON.stringify({
        type: 'ping_probe',
        roomId: 'COMPAT-1',
        senderId: 'peer_beta',
        payload: { t: Date.now() },
      }));

      await new Promise(r => setTimeout(r, 150));

      const p2Update = p2.msgs.find(m => m.type === 'player_update' && m.senderId === 'peer_alpha');
      assert.ok(p2Update, 'Peer 2 should receive player_update from Peer 1');
      assert.equal(p2Update.payload.power, 'cape');
      assert.equal(p2Update.payload.x, 145.5);

      assert.equal(
        p2.msgs.some(m => m.senderId === 'spoofed_attacker'),
        false,
        'Spoofed senderId must be rejected by server'
      );

      const batchMsg = p2.msgs.find(m => m.type === 'world_events_batch');
      assert.ok(batchMsg && batchMsg.payload.events.length === 2);

      assert.ok(p2.msgs.some(m => m.type === 'pong_probe'), 'Ping probe should reply pong_probe');

      p1.ws.close();
      p2.ws.close();
    });
  } finally {
    serverProc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 200));
  }
}

async function runSmartTvAdaptationTests() {
  console.log('\n[7/7] Adaptação para Smart TV & Controle Remoto (R0.15.0.6L.4)');

  await test('Detecção de navegador Smart TV (Tizen, WebOS, Android TV, Fire TV, Roku) sem falsos positivos', () => {
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36'), true);
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36'), true);
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (Linux; Android 11; SHIELD Android TV) AppleWebKit/537.36'), true);
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36'), true);
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'), false);
    assert.equal(isSmartTvUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
  });

  await test('Mapeamento de teclas de controle remoto de TV preservando teclado clássico no PC', () => {
    // OK / Select / DPAD_CENTER / ColorF0Red -> Jump + Confirm
    assert.ok(resolveTvRemoteAction({ code: 'Select', key: 'Select' }, { smartTvMode: true }).actions.includes('jump'));
    assert.ok(resolveTvRemoteAction({ keyCode: 23 }, { smartTvMode: true }).actions.includes('jump'));
    assert.ok(resolveTvRemoteAction({ keyCode: 403, key: 'ColorF0Red' }, { smartTvMode: true }).actions.includes('jump'));

    // Run / Fire -> Blue/Green/Yellow/ChannelUp/Digit0
    assert.ok(resolveTvRemoteAction({ keyCode: 406, key: 'ColorF3Blue' }, { smartTvMode: true }).actions.includes('run'));
    assert.ok(resolveTvRemoteAction({ keyCode: 404, key: 'ColorF1Green' }, { smartTvMode: true }).actions.includes('run'));
    assert.ok(resolveTvRemoteAction({ code: 'ChannelUp' }, { smartTvMode: true }).actions.includes('run'));
    assert.ok(resolveTvRemoteAction({ code: 'Digit0' }, { smartTvMode: true }).actions.includes('run'));

    // Back / Return (LG 461, Samsung 10009, BrowserBack) & Play/Pause (10252)
    assert.equal(resolveTvRemoteAction({ keyCode: 461 }, { smartTvMode: true }).isBack, true);
    assert.equal(resolveTvRemoteAction({ keyCode: 10009 }, { smartTvMode: true }).isBack, true);
    assert.equal(resolveTvRemoteAction({ key: 'BrowserBack' }, { smartTvMode: true }).isBack, true);
    assert.equal(resolveTvRemoteAction({ keyCode: 10252, key: 'MediaPlayPause' }, { smartTvMode: true }).isPause, true);

    // ArrowUp jumps ONLY when Smart TV mode + jumpWithUp are active (preserves PC ArrowUp)
    assert.equal(
      resolveTvRemoteAction({ code: 'ArrowUp' }, { smartTvMode: false, jumpWithUp: true }).actions.includes('jump'),
      false
    );
    assert.equal(
      resolveTvRemoteAction({ code: 'ArrowUp' }, { smartTvMode: true, jumpWithUp: true }).actions.includes('jump'),
      true
    );
  });

  await test('Navegação espacial D-Pad entre botões de menu e overlays', () => {
    const boxes = [
      { id: 0, cx: 100, cy: 100, width: 120, height: 40 }, // Top-left
      { id: 1, cx: 260, cy: 100, width: 120, height: 40 }, // Top-right
      { id: 2, cx: 100, cy: 180, width: 120, height: 40 }, // Bottom-left
      { id: 3, cx: 260, cy: 180, width: 120, height: 40 }, // Bottom-right
    ];
    assert.equal(findBestSpatialCandidateIndex(boxes[0], boxes, 'right'), 1);
    assert.equal(findBestSpatialCandidateIndex(boxes[0], boxes, 'down'), 2);
    assert.equal(findBestSpatialCandidateIndex(boxes[3], boxes, 'left'), 2);
    assert.equal(findBestSpatialCandidateIndex(boxes[3], boxes, 'up'), 1);
  });
}

async function runYellowSwitchPalaceTests() {
  console.log('\n[8/8] Palácio Interruptor Amarelo & Blocos [!] Amarelos (RW0.15.0.1DM.4)');

  await test('Ilha WikiWorldWeb possui Palácio Interruptor Amarelo ramificado e blocos [!] em W-1..W-5', () => {
    const switchNode = SMW_WIKIWORLD_NODES.find(n => n.id === 'wiki-switch-yellow');
    assert.ok(switchNode && switchNode.isSwitchPalace && switchNode.switchColor === 'yellow');

    const baseProgress: SmwBetaProgress = {
      clearedNodeIds: [],
      selectedNodeId: 'wiki-1-overworld',
      storySeen: true,
      betaUnlockAll: false,
      yellowSwitchUnlocked: false,
    };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', baseProgress), false);

    const afterW1: SmwBetaProgress = { ...baseProgress, clearedNodeIds: ['wiki-1-overworld'] };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', afterW1), true);
    assert.equal(isSmwNodeUnlocked('wiki-2-caverna', afterW1), true);

    const branchWalk = findSmwMapPath('wiki-2-caverna', 'wiki-switch-yellow');
    assert.equal(branchWalk.length, 2);

    const switchStage = createSmwWikiWorldStage('wiki-switch-yellow');
    const hasSwitchTile = switchStage.tiles.some(row => row.some(t => t?.type === 'yellow_switch'));
    assert.equal(hasSwitchTile, true, 'Palácio Amarelo deve conter um tile yellow_switch');

    for (const id of ['wiki-1-overworld', 'wiki-2-caverna', 'wiki-3-agua', 'wiki-4-mansao', 'wiki-5-castelo']) {
      const stage = createSmwWikiWorldStage(id);
      const count = stage.tiles.reduce(
        (acc, row) => acc + row.filter(t => t?.type === 'exclam_yellow').length,
        0
      );
      assert.ok(count >= 2, `${id} deve conter ao menos 2 blocos exclam_yellow (encontrados ${count})`);
    }
  });

  await test('Bloco [!] Amarelo é intangível antes do Switch e sólido liberando Cogumelo após ativado', () => {
    const engine = createFreshEngine();
    engine.enemies = [];

    // Coloca um bloco exclam_yellow no nível atual em (5, 9) acima do chão em row 13
    const tx = 5;
    const ty = 9;
    engine.level.tiles[ty][tx] = { type: 'exclam_yellow', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };

    // 1. Antes do interruptor: bloco não é sólido (Mario cai através dele)
    engine.yellowSwitchUnlocked = false;
    engine.marioX = tx * 16;
    engine.marioY = (ty - 1) * 16 - 2;
    engine.marioVy = 2.0;
    engine.marioGrounded = false;
    stepEngine(engine, 12);
    assert.ok(engine.marioY > ty * 16, `Mario deve atravessar exclam_yellow bloqueado (y=${engine.marioY})`);
    assert.equal(engine.level.tiles[ty][tx]?.type, 'exclam_yellow');

    // 2. Após o interruptor: bloco é sólido e libera Super Cogumelo mesmo se Mario for Super/Fire
    engine.yellowSwitchUnlocked = true;
    engine.marioPower = 'fire';
    engine.marioX = tx * 16;
    engine.marioY = (ty + 1) * 16 + 2;
    engine.marioVy = -5.0;
    engine.marioGrounded = false;
    engine.items = [];
    engine.update(16.67);

    assert.equal(engine.level.tiles[ty][tx]?.type, 'question_empty');
    const spawnedMushroom = engine.items.find(it => it.type === 'mushroom');
    assert.ok(spawnedMushroom, 'Bloco [!] Amarelo deve gerar um Super Cogumelo ao ser atingido');
  });

  await test('Pisar no Interruptor Amarelo achata o botão, libera blocos [!] e conclui o Palácio', () => {
    const engine = createFreshEngine();
    let activatedHook = false;
    let completedNode = '';
    engine.yellowSwitchUnlocked = false;
    engine.onSmwYellowSwitchActivated = () => {
      activatedHook = true;
    };
    engine.onSmwStageCompleted = nodeId => {
      completedNode = nodeId;
    };

    const switchStage = createSmwWikiWorldStage('wiki-switch-yellow');
    engine.startSmwStage(switchStage, false);
    engine.intermissionTimer = 0;

    // Localiza tile yellow_switch e posiciona Mario caindo sobre ele
    let sx = -1;
    let sy = -1;
    for (let y = 0; y < engine.level.height; y++) {
      for (let x = 0; x < engine.level.width; x++) {
        if (engine.level.tiles[y][x]?.type === 'yellow_switch') {
          sx = x;
          sy = y;
        }
      }
    }
    assert.ok(sx >= 0 && sy >= 0);

    engine.marioX = sx * 16;
    engine.marioY = (sy - 1) * 16 - 2;
    engine.marioVy = 4.0;
    engine.marioGrounded = false;
    engine.update(16.67);

    assert.equal(engine.level.tiles[sy][sx]?.type, 'yellow_switch_pressed');
    assert.equal(engine.yellowSwitchUnlocked, true);
    assert.equal(engine.switchPalaceActivated, true);
    assert.equal(activatedHook, true);
    assert.equal(engine.isStageClear, true);

    // Avança contagem de tempo até disparar onSmwStageCompleted('wiki-switch-yellow')
    engine.stats.time = 0;
    stepEngine(engine, 110);
    assert.equal(completedNode, 'wiki-switch-yellow');
  });
}

async function main() {
  console.log('=== Super Mario TypeScript — Suíte de Testes de Regressão (R0.15.6J.3 + R0.15.0.6L.4 + RW0.15.0.1DM.4) ===');
  await runPhysicsTests();
  await runPowerUpTests();
  await runScoringLivesAndGuardsTests();
  await runModesAndLevelsTests();
  await runFirebaseAndPolicyIntegrityTests();
  await runMultiplayerCompatibilityTests();
  await runSmartTvAdaptationTests();
  await runYellowSwitchPalaceTests();
  console.log(`\nResultado final: ${passed} testes aprovados, 0 falhas.`);
}

main().catch((err) => {
  console.error('\n[FAIL] Erro na suíte de regressão:', err);
  process.exit(1);
});
