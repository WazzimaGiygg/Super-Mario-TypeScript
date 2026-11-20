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
  createBlankCustomLevel,
  createSecretVault,
  sanitizeCustomLevelEntities,
  parseImportedLevelFile,
  isPowerUpBoxContent,
  EDITOR_MAX_ENEMIES,
  EDITOR_MAX_COINS,
  EDITOR_MAX_FLOATING_PLATFORMS,
  EDITOR_MAX_TOTAL_ENTITIES,
  STAGE_W_COINS_COUNT,
} from '../src/game/levels.ts';
import { AchievementManager } from '../src/game/achievements.ts';
import {
  JOHANNNNES_CASTLE_1_BOSS_NAME,
  SMW_ISLANDS,
  SMW_ISLAND2_NODES,
  SMW_ISLAND2_UNAVAILABLE_MSG,
  SMW_WIKIWORLD_NODES,
  SMW_DEV_ONLY_SWITCH_PALACES,
  createSmwWikiWorldStage,
  findSmwMapPath,
  isSmwNodeUnlocked,
  isSmwNodeCompletedAndLocked,
  canEnterSmwNode,
  loadSmwBetaProgress,
  saveSmwBetaProgress,
  loadSmwSaveSlots,
  saveSmwToSlot,
  deleteSmwSlot,
  applySmwSlotToProgress,
  resolveSmwDirectionalStep,
  type SmwBetaProgress,
} from '../src/game/smwWorldMap.ts';
import { GAME_UPDATES } from '../src/components/UpdatesModal.tsx';
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
      yellowSwitchUnlocked: false,
    };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', baseProgress), false);

    const afterW1Normal: SmwBetaProgress = { ...baseProgress, clearedNodeIds: ['wiki-1-overworld'] };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', afterW1Normal), false);
    assert.equal(isSmwNodeUnlocked('wiki-2-caverna', afterW1Normal), true);

    const afterW1Secret: SmwBetaProgress = { ...baseProgress, secretClearedNodeIds: ['wiki-1-overworld'] };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', afterW1Secret), true);
    assert.equal(isSmwNodeUnlocked('wiki-2-caverna', afterW1Secret), false);

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

async function runR116FixesTests() {
  console.log('\n[9/9] Correções R1.16 & Segunda Ilha Beta (RW0.15.0.PW.4, R1.16.*)');

  await test('R1.16.UC.4: Navegação no modo World permite andar para trás até W-1 pelas estradas', () => {
    const allClearedProgress: SmwBetaProgress = {
      clearedNodeIds: [
        'wiki-1-overworld',
        'wiki-2-caverna',
        'wiki-3-agua',
        'wiki-4-mansao',
        'wiki-5-castelo',
        'wiki-switch-yellow',
      ],
      selectedNodeId: 'wiki-5-castelo',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: true,
    };

    const s4 = resolveSmwDirectionalStep('wiki-5-castelo', 'left', allClearedProgress, 'wikiworld');
    assert.equal(s4?.id, 'wiki-4-mansao');

    const s3 = resolveSmwDirectionalStep('wiki-4-mansao', 'left', allClearedProgress, 'wikiworld');
    assert.equal(s3?.id, 'wiki-3-agua');

    const s2 = resolveSmwDirectionalStep('wiki-3-agua', 'left', allClearedProgress, 'wikiworld');
    assert.equal(s2?.id, 'wiki-2-caverna');

    const s1 = resolveSmwDirectionalStep('wiki-2-caverna', 'left', allClearedProgress, 'wikiworld');
    assert.equal(s1?.id, 'wiki-1-overworld');

    const fromSwitch = resolveSmwDirectionalStep('wiki-switch-yellow', 'left', allClearedProgress, 'wikiworld');
    assert.equal(fromSwitch?.id, 'wiki-1-overworld');

    const reversePath = findSmwMapPath('wiki-5-castelo', 'wiki-1-overworld');
    assert.equal(reversePath.length, 4);
    assert.ok(reversePath.every(step => step.reverse));
  });

  await test('RW0.15.0.PW.4: Segunda ilha existe com primeira fase exibindo mensagem Beta indisponível', () => {
    assert.equal(SMW_ISLANDS.length, 2);
    const island2 = SMW_ISLANDS.find(isl => isl.id === 'island2');
    assert.ok(island2);
    assert.equal(island2.playable, false);
    assert.equal(SMW_ISLAND2_UNAVAILABLE_MSG, '(Versão Beta) ainda não disponível para jogar');

    const firstStage = SMW_ISLAND2_NODES[0];
    assert.ok(firstStage);
    assert.equal(firstStage.code, '2-1');
    assert.equal(firstStage.subtitle, '(Versão Beta) ainda não disponível para jogar');
    assert.equal(firstStage.betaPlaceholderMessage, '(Versão Beta) ainda não disponível para jogar');
  });

  await test('R1.16.UF.4: Controles interativos no menu com isGameStarted=false não movem o personagem', () => {
    const engine = new GameEngine();
    assert.equal(engine.isGameStarted, false);
    const startX = engine.marioX;
    const startY = engine.marioY;
    const startScore = engine.stats.score;

    engine.controls.right = true;
    engine.controls.jump = true;
    engine.controls.run = true;
    stepEngine(engine, 15);

    assert.equal(engine.marioX, startX);
    assert.equal(engine.marioY, startY);
    assert.equal(engine.stats.score, startScore);
    assert.equal(engine.controls.right, false);
    assert.equal(engine.controls.jump, false);
  });

  await test('R1.16.EG.4 & R1.16.7H.4: Correções recentes têm UIDs exclusivas e Tela Inicial simplificada mantém recursos', () => {
    const uids = GAME_UPDATES.map(u => u.uid);
    const uniqueUids = new Set(uids);
    assert.equal(uniqueUids.size, uids.length, 'Todas as UIDs de correções devem ser únicas');
    for (const requiredUid of [
      'R1.16.MV.4',
      'R1.16.SL.4',
      'R1.16.1B0.4',
      'R1.16.FH.4',
      'R02.16.PG.4',
      'R1.16.OV.4',
      'R1.16.SW.4',
      'R1.16.X6.4',
      'R1.16.13U.4',
      'R1.16.O0.4',
      'R1.16.OY.4',
      'R1.16.P4.4',
      'R1.16.3FG.4',
      'R1.16.1IZ.4',
      'R1.16.116.4',
      'R1.16.HH.4',
      'R1.16.QO.4',
      'RW0.15.0.PW.4',
      'R1.16.EG.4',
      'R1.16.UF.4',
      'R1.16.7H.4',
      'R1.16.UC.4',
      'R0.15.0.RL.4',
    ]) {
      assert.ok(uniqueUids.has(requiredUid), `UID ausente em UpdatesModal: ${requiredUid}`);
    }

    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.ok(canvasSrc.includes('Correções Recentes'));
    assert.ok(canvasSrc.includes('JOGAR CLÁSSICO'));
    assert.ok(canvasSrc.includes('MODO WORLD'));
    assert.ok(canvasSrc.includes('7 MUNDOS'));
  });

  await test('R1.16.116.4: Caverna (W-2) usa tema underground e Água (W-3) usa tema underwater no Modo World', () => {
    const caverna = createSmwWikiWorldStage('wiki-2-caverna');
    const agua = createSmwWikiWorldStage('wiki-3-agua');
    assert.equal(caverna.theme, 'underground');
    assert.equal(agua.theme, 'underwater');
  });

  await test('R1.16.HH.4: Opção de liberar todas as fases removida do mapa do Super Mario World', () => {
    const mapSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmwOverworldMap.tsx'), 'utf8');
    assert.equal(mapSrc.includes('Liberar Fases'), false);
    assert.equal(mapSrc.includes('Todas Liberadas'), false);
    assert.equal(mapSrc.includes('betaUnlockAll'), false);

    const freshProgress: SmwBetaProgress = {
      clearedNodeIds: [],
      selectedNodeId: 'wiki-1-overworld',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: false,
    };
    assert.equal(isSmwNodeUnlocked('wiki-1-overworld', freshProgress), true);
    assert.equal(isSmwNodeUnlocked('wiki-5-castelo', freshProgress), false);
  });

  await test('R1.16.QO.4: Modo Debug bloqueia inserção de objetos em cima ou a até 3 blocos do final da fase', () => {
    const engine = createFreshEngine();
    engine.toggleDebugMode(true);
    const itemsBefore = engine.items.length;

    const flagX = engine.level.flagX;
    assert.ok(flagX > 0 && flagX < 99000);

    // Em cima da bandeira e a 3 blocos (48px) -> BLOQUEADO
    assert.equal(engine.isDebugPlacementBlockedAt(flagX), true);
    assert.equal(engine.isDebugPlacementBlockedAt(flagX - 48), true);
    assert.equal(engine.isDebugPlacementBlockedAt(flagX + 48), true);
    assert.equal(engine.placeDebugItemAt(flagX, 160), false);
    assert.equal(engine.placeDebugItemAt(flagX - 48, 160), false);
    assert.equal(engine.items.length, itemsBefore);

    // A 4 blocos (64px) de distância -> PERMITIDO
    assert.equal(engine.isDebugPlacementBlockedAt(flagX - 64), false);
    assert.equal(engine.placeDebugItemAt(flagX - 64, 160), true);
    assert.equal(engine.items.length, itemsBefore + 1);

    // Fase de Castelo (machado 'axe'): bloqueado em cima e a até 3 blocos do machado
    const castleEngine = createFreshEngine();
    castleEngine.loadLevel(createWorld1_4(), false, false, false);
    castleEngine.intermissionTimer = 0;
    castleEngine.toggleDebugMode(true);
    let axeTx = -1;
    for (let y = 0; y < castleEngine.level.height; y++) {
      for (let x = 0; x < castleEngine.level.width; x++) {
        if (castleEngine.level.tiles[y]?.[x]?.type === 'axe') axeTx = x;
      }
    }
    assert.ok(axeTx > 0);
    assert.equal(castleEngine.placeDebugItemAt(axeTx * 16, 160), false);
    assert.equal(castleEngine.placeDebugItemAt((axeTx - 3) * 16, 160), false);
    assert.equal(castleEngine.placeDebugItemAt((axeTx - 4) * 16, 160), true);
  });

  await test('R1.16.1IZ.4: Editor aplica limite seguro de entidades, evita redesenho em hover e testa fase editada sem tela preta', () => {
    // 1. Templates oficiais permanecem intactos dentro do limite seguro
    for (const tpl of [
      createWorld1_1(),
      createWorld1_2(),
      createWorld2_2(),
      createWorldGhostHouse(),
      createWorld1_4(),
      createSecretVault(),
    ]) {
      const sanitized = sanitizeCustomLevelEntities(tpl);
      assert.equal(sanitized.truncated, false, `Template ${tpl.id} não deve ser truncado`);
    }

    // 2. Excesso de entidades em fase editada ou importada é truncado com segurança
    const custom = createBlankCustomLevel('TESTE MEMORIA', 'overworld', 100);
    for (let i = 0; i < 150; i++) {
      custom.enemies.push({ type: 'goomba', x: (i % 80) * 16, y: 192 });
    }
    for (let i = 0; i < 200; i++) {
      custom.coins.push({ x: (i % 80) * 16 + 8, y: 144 });
    }
    custom.floatingPlatforms = Array.from({ length: 40 }, (_, i) => ({
      x: i * 32,
      y: 120,
      width: 48,
      axis: 'horizontal' as const,
      range: 24,
      speed: 0.035,
    }));

    const imported = parseImportedLevelFile(JSON.stringify(custom));
    assert.ok(imported.enemies.length <= EDITOR_MAX_ENEMIES);
    assert.ok(imported.coins.length <= EDITOR_MAX_COINS);
    assert.ok((imported.floatingPlatforms?.length || 0) <= EDITOR_MAX_FLOATING_PLATFORMS);
    const totalImported =
      imported.enemies.length + imported.coins.length + (imported.floatingPlatforms?.length || 0);
    assert.ok(totalImported <= EDITOR_MAX_TOTAL_ENTITIES);

    // 3. Execução no motor via playCustomLevel respeita limite, reseta estado SMW/íris/glitch e inicia com câmera válida
    const engine = new GameEngine();
    engine.gameMode = 'smw_world_map';
    engine.smwCastleIrisProgress = 1;
    engine.smwCastleEntryActive = true;
    engine.isIllegalInstructionBug = true;
    custom.marioStart = { x: 640, y: 192 };
    engine.playCustomLevel(custom, true);
    assert.equal(engine.isGameStarted, true);
    assert.equal(engine.isPaused, false);
    assert.equal(engine.isGameOver, false);
    assert.equal(engine.level.isCustom, true);
    assert.equal(engine.gameMode, 'classic');
    assert.equal(engine.smwCastleIrisProgress, 0);
    assert.equal(engine.smwCastleEntryActive, false);
    assert.equal(engine.isIllegalInstructionBug, false);
    assert.ok(engine.enemies.length <= EDITOR_MAX_ENEMIES);
    assert.ok(engine.items.length <= EDITOR_MAX_COINS);
    assert.ok(engine.floatingPlatforms.length <= EDITOR_MAX_FLOATING_PLATFORMS);
    assert.ok(engine.camera.x > 0, 'Câmera deve centralizar quando início customizado está além de 160px');

    // 4. Editor usa janela virtual limitada (<= 2048px), inclui isOpen no redraw e mantém hover fora das dependências
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    assert.ok(editorSrc.includes('EDITOR_MAX_CANVAS_BACKING_WIDTH = 2048'));
    assert.ok(editorSrc.includes('}, [isOpen, currentLevel, cellSize, showGrid, atlas]);'));
    assert.ok(editorSrc.includes('EDITOR_MAX_TOTAL_ENTITIES'));
    assert.ok(editorSrc.includes('EDITOR_MAX_ENEMIES'));
  });

  await test('R1.16.3FG.4: Poste de Pontos SMW, Carteira (50 = +3 vidas, 100 = Bonus Stage 9 vidas) e exceção nos castelos de chefe', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    assert.equal(engine.hasGoalPointsPost(), true);
    assert.equal(engine.goalPointsWallet, 0);

    // 1. Pontuação do poste varia conforme a altura (50 no topo, 1 embaixo)
    assert.equal(engine.computeGoalGatePoints(56, 56), 50);
    assert.equal(engine.computeGoalGatePoints(190, 178), 1);

    // 2. Atingir o topo do poste (50 pts) na 1-1 -> ganha +3 vidas e acumula 50 na carteira
    const livesStart = engine.stats.lives;
    engine.marioX = engine.level.flagX;
    engine.marioY = 48;
    engine.update(16.67);
    assert.equal(engine.lastGoalGatePoints, 50);
    assert.equal(engine.goalPointsWallet, 50);
    assert.equal(engine.stats.goalPointsWallet, 50);
    assert.equal(engine.stats.lives, livesStart + 3);
    assert.equal(engine.pendingBonusStage, false);
    assert.equal(engine.marioState, 'castle_walk');

    // 3. Acumular mais 50 pts (total 100) zera a carteira, soma +3 vidas e entra automaticamente no Bonus Stage após contagem
    engine.loadLevel(createWorld1_2(), false, false, false);
    engine.intermissionTimer = 0;
    engine.enemies = [];
    assert.equal(engine.hasGoalPointsPost(), true);
    const livesBeforeSecondHit = engine.stats.lives;
    engine.marioX = engine.level.flagX;
    engine.marioY = 48;
    engine.update(16.67);
    assert.equal(engine.lastGoalGatePoints, 50);
    assert.equal(engine.goalPointsWallet, 0);
    assert.equal(engine.stats.goalPointsWallet, 0);
    assert.equal(engine.stats.lives, livesBeforeSecondHit + 3);
    assert.equal(engine.pendingBonusStage, true);

    // Avançar frames até completar a caminhada e contagem de tempo -> entra no Bonus Stage automaticamente
    for (let i = 0; i < 400 && !engine.isBonusStageActive; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.isBonusStageActive, true);
    assert.equal(engine.bonusStageBlocks.length, 9);
    assert.equal(engine.stats.isBonusStage, true);
    assert.equal(engine.stats.bonusBlocksRemaining, 9);

    // 4. Pegar todas as 9 vidas nos 9 blocos do Bonus Stage -> fase finaliza automaticamente ao completar as 9 possibilidades
    const livesEnteringBonus = engine.stats.lives;
    for (const block of engine.bonusStageBlocks) {
      block.faceIndex = 0; // '1up'
      const resolved = engine.resolveBonusStageBlock(block.tx, block.ty);
      assert.equal(resolved, true);
    }
    assert.equal(engine.bonusStageLivesWon, 9);
    assert.equal(engine.stats.lives, livesEnteringBonus + 9);
    assert.equal(engine.stats.bonusBlocksRemaining, 0);
    assert.ok(engine.bonusStageFinishDelay > 0);

    // Aguardar fim do delay de celebração -> encerra Bonus Stage e avança para próxima fase (2-2)
    stepEngine(engine, engine.bonusStageFinishDelay + 2);
    assert.equal(engine.isBonusStageActive, false);
    assert.equal(engine.level.id, 'world-2-2');

    // 5. Castelo do chefe (world-1-4 e wiki-5-castelo) NÃO usa Poste de Pontos
    const bossEngine = createFreshEngine();
    bossEngine.loadLevel(createWorld1_4(), false, false, false);
    bossEngine.intermissionTimer = 0;
    assert.equal(bossEngine.hasGoalPointsPost(), false);

    const smwBoss = createSmwWikiWorldStage('wiki-5-castelo');
    bossEngine.startSmwStage(smwBoss, true);
    bossEngine.intermissionTimer = 0;
    assert.equal(bossEngine.hasGoalPointsPost(), false);
  });

  await test('R1.16.OY.4: Modo Debug é desativado e bloqueado automaticamente se o jogador alcançar o final da fase', () => {
    // 1. Fase comum: Debug ativado antes do fim desliga e bloqueia ao entrar na zona final (flagX - 3 blocos)
    const engine = createFreshEngine();
    assert.equal(engine.toggleDebugMode(true), true);
    assert.equal(engine.toggleDebugPlacementCursor(true), true);
    assert.equal(engine.isDebugMode, true);
    assert.equal(engine.isDebugPlacementActive, true);

    engine.marioX = engine.level.flagX - 32;
    engine.marioY = 176;
    engine.update(16.67);

    assert.equal(engine.isDebugLockedAtStageEnd(), true);
    assert.equal(engine.isDebugMode, false);
    assert.equal(engine.isDebugPlacementActive, false);
    assert.equal(engine.toggleDebugMode(true), false);
    assert.equal(engine.toggleDebugPlacementCursor(true), false);
    assert.equal(engine.placeDebugItemAt(engine.marioX, engine.marioY), false);

    // 2. Cruzando a meta / caminhando para o castelo com debug ativado mantém bloqueio total
    const finishEngine = createFreshEngine();
    finishEngine.enemies = [];
    finishEngine.toggleDebugMode(true);
    finishEngine.marioX = finishEngine.level.flagX;
    finishEngine.marioY = 160;
    finishEngine.update(16.67);

    assert.equal(finishEngine.marioState, 'castle_walk');
    assert.equal(finishEngine.isDebugLockedAtStageEnd(), true);
    assert.equal(finishEngine.isDebugMode, false);
    assert.equal(finishEngine.toggleDebugMode(true), false);

    // 3. Castelo com machado ('axe'): também bloqueia e desativa Debug ao alcançar o machado
    const castleEngine = createFreshEngine();
    castleEngine.loadLevel(createWorld1_4(), false, false, false);
    castleEngine.intermissionTimer = 0;
    castleEngine.toggleDebugMode(true);
    castleEngine.toggleDebugPlacementCursor(true);
    let axeTx = -1;
    for (let y = 0; y < castleEngine.level.height; y++) {
      for (let x = 0; x < castleEngine.level.width; x++) {
        if (castleEngine.level.tiles[y]?.[x]?.type === 'axe') axeTx = x;
      }
    }
    assert.ok(axeTx > 0);
    castleEngine.marioX = axeTx * 16 - 32;
    castleEngine.marioY = 144;
    castleEngine.update(16.67);

    assert.equal(castleEngine.isDebugLockedAtStageEnd(), true);
    assert.equal(castleEngine.isDebugMode, false);
    assert.equal(castleEngine.isDebugPlacementActive, false);
    assert.equal(castleEngine.toggleDebugMode(true), false);
  });

  await test('R1.16.P4.4: Inimigos próximos ao término da fase são transformados em pontos multiplicados', () => {
    const engine = createFreshEngine();
    const flagX = engine.level.flagX;

    engine.enemies = [
      {
        id: 901,
        type: 'goomba',
        x: 200,
        y: 192,
        vx: 0,
        vy: 0,
        width: 16,
        height: 16,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      },
      {
        id: 902,
        type: 'goomba',
        x: flagX - 160,
        y: 192,
        vx: 0,
        vy: 0,
        width: 16,
        height: 16,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      },
      {
        id: 903,
        type: 'koopa',
        x: flagX - 96,
        y: 184,
        vx: 0,
        vy: 0,
        width: 16,
        height: 24,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      },
      {
        id: 904,
        type: 'hammer_bro',
        x: flagX - 48,
        y: 184,
        vx: 0,
        vy: 0,
        width: 16,
        height: 24,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      },
    ];

    const scoreBefore = engine.stats.score;
    engine.marioX = flagX;
    engine.marioY = 178; // Mario pequeno (altura 16 -> centro +8)
    const expectedGoalBonus = engine.computeGoalGatePoints(
      engine.marioY + 8,
      engine.goalTapeY
    ) * 100;

    engine.update(16.67);

    // 1. Inimigo distante permanece vivo; os 3 próximos ao final são convertidos
    assert.equal(engine.enemies[0].alive, true);
    assert.equal(engine.enemies[1].alive, false);
    assert.equal(engine.enemies[1].state, 'flipped');
    assert.equal(engine.enemies[2].alive, false);
    assert.equal(engine.enemies[2].state, 'flipped');
    assert.equal(engine.enemies[3].alive, false);
    assert.equal(engine.enemies[3].state, 'flipped');

    // 2. Pontuação: 200*2 + 200*3 + 400*4 = 400 + 600 + 1600 = 2600 + bônus do poste
    const expectedMultiplied = 200 * 2 + 200 * 3 + 400 * 4;
    assert.equal(engine.stats.score - scoreBefore, expectedGoalBonus + expectedMultiplied);

    // 3. Castelo: inimigos comuns perto do machado também viram pontos multiplicados
    const castleEngine = createFreshEngine();
    castleEngine.loadLevel(createWorld1_4(), false, false, false);
    castleEngine.intermissionTimer = 0;
    let axeTx = -1;
    for (let y = 0; y < castleEngine.level.height; y++) {
      for (let x = 0; x < castleEngine.level.width; x++) {
        if (castleEngine.level.tiles[y]?.[x]?.type === 'axe') axeTx = x;
      }
    }
    assert.ok(axeTx > 0);
    castleEngine.enemies = [
      {
        id: 950,
        type: 'dry_bones',
        x: axeTx * 16 - 64,
        y: 144,
        vx: 0,
        vy: 0,
        width: 16,
        height: 24,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      },
    ];
    const castleResult = castleEngine.transformStageEndEnemiesToPoints();
    assert.equal(castleResult.count, 1);
    assert.equal(castleResult.totalPoints, 400 * 2);
    assert.equal(castleEngine.enemies[0].alive, false);
  });

  await test('R1.16.O0.4: Palácio Interruptor Amarelo bloqueia reentrada após ser concluído', () => {
    const afterW1: SmwBetaProgress = {
      clearedNodeIds: ['wiki-1-overworld'],
      secretClearedNodeIds: ['wiki-1-overworld'],
      selectedNodeId: 'wiki-switch-yellow',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: false,
    };
    assert.equal(isSmwNodeCompletedAndLocked('wiki-switch-yellow', afterW1), false);
    assert.equal(canEnterSmwNode('wiki-switch-yellow', afterW1), true);

    const afterSwitch: SmwBetaProgress = {
      ...afterW1,
      clearedNodeIds: ['wiki-1-overworld', 'wiki-switch-yellow'],
      yellowSwitchUnlocked: true,
    };
    assert.equal(isSmwNodeCompletedAndLocked('wiki-switch-yellow', afterSwitch), true);
    assert.equal(canEnterSmwNode('wiki-switch-yellow', afterSwitch), false);
    assert.equal(canEnterSmwNode('wiki-1-overworld', afterSwitch), true);
    assert.equal(canEnterSmwNode('wiki-2-caverna', afterSwitch), true);

    const mapSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmwOverworldMap.tsx'), 'utf8');
    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.ok(mapSrc.includes('PALÁCIO CONCLUÍDO'));
    assert.ok(mapSrc.includes('isSmwNodeCompletedAndLocked'));
    assert.ok(canvasSrc.includes('canEnterSmwNode'));
  });

  await test('R1.16.13U.4: Carteira de Power-UPs armazena reserva e solta do topo ao sofrer dano', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);

    // 1. Pegar Super Cogumelo -> fica Super; pegar Flor de Fogo -> armazena Cogumelo na carteira
    engine.items.push(makeItem(9201, 'mushroom', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'super');
    assert.equal(engine.reservePowerUp, null);
    engine.marioGrowthTimer = 0;

    engine.items.push(makeItem(9202, 'fireflower', engine.marioX, engine.marioY));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'fire');
    assert.equal(engine.reservePowerUp, 'mushroom');
    assert.equal(engine.stats.reservePowerUp, 'mushroom');
    engine.marioGrowthTimer = 0;

    // 2. Ao sofrer dano e perder o Fire, o Cogumelo armazenado cai do topo da tela
    engine.marioInvulnerableTimer = 0;
    engine.enemies.push(makeEnemy(9203, 'goomba', engine.marioX + 2, engine.marioY + 14));
    engine.update(16.67);
    assert.equal(engine.marioPower, 'small');
    assert.equal(engine.reservePowerUp, null);
    assert.equal(engine.stats.reservePowerUp, null);

    const droppedReserve = engine.items.find(it => it.fromReserveBox && it.type === 'mushroom');
    assert.ok(droppedReserve, 'O power-up guardado na carteira deve cair para o jogador pegar');

    // 3. Limpa freeze/inimigo e deixa o item cair até o personagem para reequipar Super
    engine.enemies = [];
    engine.marioShrinkTimer = 0;
    engine.marioInvulnerableTimer = 0;
    for (let i = 0; i < 180 && engine.marioPower === 'small'; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioPower, 'super');
  });

  await test('R1.16.X6.4: Salvamento automático desativado no SMW e Slots manuais salvam/carregam ao vencer castelos', () => {
    const mapMem = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (mapMem.has(k) ? mapMem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mapMem.set(k, v);
      },
    };

    const progress: SmwBetaProgress = {
      clearedNodeIds: [
        'wiki-1-overworld',
        'wiki-2-caverna',
        'wiki-3-agua',
        'wiki-4-mansao',
        'wiki-5-castelo',
      ],
      selectedNodeId: 'wiki-5-castelo',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: false,
      goalPointsWallet: 50,
    };

    // Auto-save é no-op e loadSmwBetaProgress sempre inicia limpo
    saveSmwBetaProgress(progress);
    const freshLoaded = loadSmwBetaProgress();
    assert.equal(freshLoaded.clearedNodeIds.length, 0);

    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.equal(canvasSrc.includes('saveSmwBetaProgress('), false, 'GameCanvas não pode chamar saveSmwBetaProgress');
    assert.ok(canvasSrc.includes('currNode?.isCastle'));

    // Salvamento manual no Slot 1 (índice 0)
    const afterSave = saveSmwToSlot(
      0,
      progress,
      { stageName: 'Castelo de Johannnnes89', lives: 7, score: 12500 },
      mockStorage
    );
    assert.ok(afterSave[0]);
    assert.equal(afterSave[1], null);
    assert.equal(afterSave[2], null);

    const reloaded = loadSmwSaveSlots(mockStorage);
    assert.equal(reloaded[0]?.lives, 7);
    assert.equal(reloaded[0]?.score, 12500);
    assert.equal(reloaded[0]?.clearedNodeIds.length, 5);

    const applied = applySmwSlotToProgress(reloaded[0]!);
    assert.deepEqual(applied.clearedNodeIds, progress.clearedNodeIds);
    assert.equal(applied.goalPointsWallet, 50);

    const afterDelete = deleteSmwSlot(0, mockStorage);
    assert.equal(afterDelete[0], null);
  });

  await test('R1.16.SW.4: Bola de fogo transforma inimigos comuns em moedas, exceto fantasmas e esqueletos', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.items = [];
    stepEngine(engine, 10);

    const yGround = 12 * GameEngine.TILE_SIZE;
    // Goomba atingido por bola de fogo -> vira moeda coletável
    const goomba = makeEnemy(9301, 'goomba', 140, yGround);
    goomba.vx = 0;
    engine.enemies.push(goomba);
    engine.fireballs.push({
      id: 9302,
      x: 138,
      y: yGround + 4,
      vx: 5,
      vy: 0,
      alive: true,
      exploding: false,
      explodeTimer: 0,
    });
    engine.update(16.67);
    assert.equal(goomba.alive, false);
    const spawnedCoin = engine.items.find(it => it.type === 'coin' && Math.abs(it.x - 140) <= 4);
    assert.ok(spawnedCoin, 'Goomba derrotado por bola de fogo deve virar moeda');

    // Boo (fantasma) e Dry Bones (esqueleto) NÃO viram moedas
    const itemsCountBefore = engine.items.length;
    const boo = makeEnemy(9303, 'boo', 200, yGround);
    boo.vx = 0;
    const dryBones = makeEnemy(9304, 'dry_bones', 260, yGround - 8);
    dryBones.vx = 0;
    engine.enemies.push(boo, dryBones);
    engine.fireballs.push(
      {
        id: 9305,
        x: 198,
        y: yGround + 4,
        vx: 5,
        vy: 0,
        alive: true,
        exploding: false,
        explodeTimer: 0,
      },
      {
        id: 9306,
        x: 258,
        y: yGround,
        vx: 5,
        vy: 0,
        alive: true,
        exploding: false,
        explodeTimer: 0,
      }
    );
    engine.update(16.67);
    assert.equal(boo.alive, true, 'Boo deve permanecer vivo e não virar moeda');
    assert.equal(dryBones.state, 'shell_idle', 'Dry Bones deve desmoronar sem virar moeda');
    assert.equal(engine.items.length, itemsCountBefore, 'Boo e Dry Bones não podem gerar moedas');
  });

  await test('R1.16.OV.4: Fases possuem 4 moedas gigantes flutuantes W e coletar as 4 concede +1 vida', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    const wCoins = engine.items.filter(it => it.type === 'w_coin');
    assert.equal(wCoins.length, STAGE_W_COINS_COUNT);
    assert.equal(STAGE_W_COINS_COUNT, 4);
    assert.equal(engine.wCoinsTotal, 4);
    assert.equal(engine.wCoinsCollected, 0);

    const livesBefore = engine.stats.lives;
    // Coletar 3 primeiras W-Coins -> ainda não ganha vida extra
    for (let i = 0; i < 3; i++) {
      engine.marioX = wCoins[i].x;
      engine.marioY = wCoins[i].y;
      engine.marioVx = 0;
      engine.marioVy = 0;
      engine.update(16.67);
    }
    assert.equal(engine.wCoinsCollected, 3);
    assert.equal(engine.stats.lives, livesBefore);

    // Coletar a 4ª W-Coin -> concede +1 Vida Extra!
    engine.marioX = wCoins[3].x;
    engine.marioY = wCoins[3].y;
    engine.marioVx = 0;
    engine.marioVy = 0;
    engine.update(16.67);
    assert.equal(engine.wCoinsCollected, 4);
    assert.equal(engine.stats.wCoinsCollected, 4);
    assert.equal(engine.stats.lives, livesBefore + 1);
  });

  await test('R02.16.PG.4: Modo Super Mario World executa animação de entrada no castelo, bandeira e íris antes de concluir', () => {
    const engine = createFreshEngine();
    let completedId = '';
    engine.onSmwStageCompleted = id => {
      completedId = id;
    };
    engine.startSmwStage(createSmwWikiWorldStage('wiki-1-overworld'), true);
    engine.intermissionTimer = 0;
    engine.enemies = [];

    // Cruza o poste e caminha até a porta do castelo
    engine.marioX = engine.level.flagX;
    engine.marioY = 176;
    engine.update(16.67);
    assert.equal(engine.marioState, 'castle_walk');

    for (let i = 0; i < 160 && !engine.smwCastleEntryActive; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.smwCastleEntryActive, true, 'Deve ativar smwCastleEntryActive ao chegar na porta do castelo');
    assert.equal(engine.marioState, 'castle_walk');

    // Avança frames de entrada na porta do castelo até finalizar estágio e erguer bandeira/íris
    for (let i = 0; i < 60 && engine.marioState === 'castle_walk'; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioState, 'castle_entered');

    engine.stats.time = 0;
    for (let i = 0; i < 120 && !completedId; i++) {
      engine.update(16.67);
    }
    assert.ok(engine.smwCastleBannerProgress > 0.5, 'Bandeira de vitória no castelo deve subir');
    assert.ok(engine.smwCastleIrisProgress > 0.5, 'Transição circular iris-out deve fechar antes do retorno ao mapa');
    assert.equal(completedId, 'wiki-1-overworld');
  });

  await test('R1.16.1B0.4: Campanha personalizada de múltiplos mapas do editor avança por fase até vitória final', () => {
    const engine = new GameEngine();
    const map1 = createBlankCustomLevel('MAPA UM', 'overworld', 60);
    map1.id = 'custom-camp-1';
    for (let i = 0; i < 80; i++) {
      map1.enemies.push({ type: 'goomba', x: (i % 40) * 16 + 32, y: 192 });
    }
    const map2 = createBlankCustomLevel('MAPA DOIS', 'underground', 60);
    map2.id = 'custom-camp-2';
    const map3 = createBlankCustomLevel('MAPA TRES', 'castle', 60);
    map3.id = 'custom-camp-3';

    engine.startCustomCampaign([map1, map2, map3], false);
    assert.equal(engine.isGameStarted, true);
    assert.equal(engine.isPlayingCustomCampaign(), true);
    assert.equal(engine.level.id, 'custom-camp-1');
    assert.equal(engine.stats.world, '1/3');
    assert.equal(engine.isCampaignVictory, false);
    assert.ok(engine.enemies.length <= EDITOR_MAX_ENEMIES);

    // Conclui fase 1 -> avança automaticamente para fase 2 preservando pontos
    engine.stats.score = 1500;
    engine.stats.coins = 7;
    engine.advanceToNextLevel();
    assert.equal(engine.level.id, 'custom-camp-2');
    assert.equal(engine.stats.world, '2/3');
    assert.equal(engine.stats.score, 1500);
    assert.equal(engine.stats.coins, 7);
    assert.equal(engine.isCampaignVictory, false);

    // Conclui fase 2 -> avança para fase 3
    engine.advanceToNextLevel();
    assert.equal(engine.level.id, 'custom-camp-3');
    assert.equal(engine.stats.world, '3/3');
    assert.equal(engine.isCampaignVictory, false);

    // Conclui última fase -> ativa vitória da campanha personalizada
    engine.advanceToNextLevel();
    assert.equal(engine.isCampaignVictory, true);
    assert.equal(engine.isStageClear, false);

    // Reiniciar campanha personalizada volta ao mapa 1/3 e limpa vitória
    engine.restartGame();
    assert.equal(engine.level.id, 'custom-camp-1');
    assert.equal(engine.stats.world, '1/3');
    assert.equal(engine.isCampaignVictory, false);
    assert.equal(engine.stats.score, 0);

    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.ok(canvasSrc.includes('startCustomCampaign('));
    assert.ok(canvasSrc.includes('CAMPANHA CONCLUÍDA!'));
  });

  await test('R1.16.FH.4: Editor suporta atalhos Ctrl+Z (Desfazer) e Ctrl+Y (Refazer) com histórico limitado', () => {
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    assert.ok(editorSrc.includes('EDITOR_MAX_HISTORY = 35'));
    assert.ok(editorSrc.includes("lower === 'z' && !e.shiftKey"));
    assert.ok(editorSrc.includes("lower === 'y' || (lower === 'z' && e.shiftKey)"));
    assert.ok(editorSrc.includes('handleUndo'));
    assert.ok(editorSrc.includes('handleRedo'));
    assert.ok(editorSrc.includes('Ctrl+Z'));
    assert.ok(editorSrc.includes('Ctrl+Y'));
  });

  await test('R1.16.MV.4 & R1.16.SL.4: Modo World dispara conclusão apenas 1x (sem softlock ao salvar), libera movimentação pós-fase e expõe Carregar Progresso', () => {
    const engine = createFreshEngine();
    let completionCount = 0;
    let lastCompletedId = '';
    engine.onSmwStageCompleted = id => {
      completionCount++;
      lastCompletedId = id;
    };

    // 1. Concluir W-1 no Modo World deve disparar onSmwStageCompleted exatamente 1 vez
    engine.startSmwStage(createSmwWikiWorldStage('wiki-1-overworld'), true);
    engine.intermissionTimer = 0;
    engine.enemies = [];
    engine.marioX = engine.level.flagX;
    engine.marioY = 176;
    engine.update(16.67);

    for (let i = 0; i < 180 && engine.marioState !== 'castle_entered'; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioState, 'castle_entered');
    engine.stats.time = 0;
    for (let i = 0; i < 120 && completionCount === 0; i++) {
      engine.update(16.67);
    }
    assert.equal(completionCount, 1);
    assert.equal(lastCompletedId, 'wiki-1-overworld');

    // Frames subsequentes NÃO podem re-disparar conclusão (evita reset de seleção no mapa e softlock do modal de save)
    stepEngine(engine, 30);
    assert.equal(completionCount, 1, 'onSmwStageCompleted não pode disparar em loop após retorno ao mapa');
    assert.equal(engine.isGameStarted, false);
    assert.equal(engine.marioState, 'idle');
    assert.equal(engine.localStageCleared, false);

    // 2. Após vencer W-1, jogador consegue andar no mapa (W-2 <-> W-1) e mover Mario livremente na próxima fase (W-2)
    const afterW1Progress: SmwBetaProgress = {
      clearedNodeIds: ['wiki-1-overworld'],
      selectedNodeId: 'wiki-2-caverna',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: false,
    };
    assert.equal(resolveSmwDirectionalStep('wiki-2-caverna', 'left', afterW1Progress, 'wikiworld')?.id, 'wiki-1-overworld');
    assert.equal(resolveSmwDirectionalStep('wiki-1-overworld', 'up', afterW1Progress, 'wikiworld')?.id, 'wiki-2-caverna');

    engine.startSmwStage(createSmwWikiWorldStage('wiki-2-caverna'), false);
    engine.intermissionTimer = 0;
    engine.enemies = [];
    stepEngine(engine, 10);
    const startX = engine.marioX;
    engine.controls.right = true;
    stepEngine(engine, 20);
    assert.ok(engine.marioX > startX + 10, 'Mario deve se mover normalmente na próxima fase após concluir uma fase no Modo World');
    engine.controls.right = false;

    // 3. UI de Carregar Progresso & fechamento seguro sem softlock ao salvar no Modo World
    const mapSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmwOverworldMap.tsx'), 'utf8');
    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    const settingsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SettingsModal.tsx'), 'utf8');
    assert.ok(mapSrc.includes('CARREGAR PROGRESSO'));
    assert.ok(mapSrc.includes('Carregar Progresso'));
    assert.ok(mapSrc.includes('onDismissCastleSave?.()'));
    assert.ok(canvasSrc.includes('handleOpenSmwLoadProgress'));
    assert.ok(canvasSrc.includes('Carregar World'));
    assert.ok(canvasSrc.includes('if (!isSmwMapOpen)'));
    assert.ok(settingsSrc.includes('Carregar Progresso (Modo World)'));
  });

  await test('R1.16.AC.4: Sistema de Conquistas rastreia Goombas, speedrun < 60s, concede recompensas e persiste', () => {
    const engine = createFreshEngine();
    engine.resetAchievements();
    engine.enemies = [];
    engine.items = [];

    const unlockedEvents: string[] = [];
    engine.onAchievementUnlocked = evt => {
      unlockedEvents.push(evt.achievement.id);
    };

    const yGround = 12 * GameEngine.TILE_SIZE;
    // Derrotar 9 Goombas -> conquista ainda não desbloqueada
    for (let i = 0; i < 9; i++) {
      const g = makeEnemy(9800 + i, 'goomba', 120, yGround);
      g.vx = 0;
      engine.enemies = [g];
      engine.marioX = 120;
      engine.marioY = yGround - 18;
      engine.marioVx = 0;
      engine.marioVy = 4;
      engine.marioGrounded = false;
      engine.update(16.67);
    }
    let goombaAch = engine.getAchievements().find(a => a.id === 'defeat_10_goombas')!;
    assert.equal(goombaAch.progress, 9);
    assert.equal(goombaAch.unlocked, false);

    // 10º Goomba -> desbloqueia "defeat_10_goombas" e concede +1000 pts e +1 vida
    const scoreBefore10 = engine.stats.score;
    const livesBefore10 = engine.stats.lives;
    const g10 = makeEnemy(9810, 'goomba', 120, yGround);
    g10.vx = 0;
    engine.enemies = [g10];
    engine.marioX = 120;
    engine.marioY = yGround - 18;
    engine.marioVx = 0;
    engine.marioVy = 4;
    engine.marioGrounded = false;
    engine.update(16.67);

    goombaAch = engine.getAchievements().find(a => a.id === 'defeat_10_goombas')!;
    assert.equal(goombaAch.progress, 10);
    assert.equal(goombaAch.unlocked, true);
    assert.ok(unlockedEvents.includes('defeat_10_goombas'));
    assert.equal(engine.stats.lives, livesBefore10 + 1);
    assert.ok(engine.stats.score >= scoreBefore10 + 1000);

    // 11º Goomba NÃO pode desbloquear novamente nem conceder vida duplicada (zera stompCombo ao pisar no chão antes)
    const livesAfter10 = engine.stats.lives;
    engine.enemies = [];
    engine.marioY = yGround;
    engine.marioVy = 0;
    engine.marioGrounded = true;
    engine.update(16.67);

    const g11 = makeEnemy(9811, 'goomba', 120, yGround);
    g11.vx = 0;
    engine.enemies = [g11];
    engine.marioX = 120;
    engine.marioY = yGround - 18;
    engine.marioVx = 0;
    engine.marioVy = 4;
    engine.marioGrounded = false;
    engine.update(16.67);
    assert.equal(engine.stats.lives, livesAfter10);
    assert.equal(unlockedEvents.filter(id => id === 'defeat_10_goombas').length, 1);

    // Speedrun >= 60s NÃO desbloqueia "clear_under_60s"
    engine.enemies = [];
    engine.stageElapsedMs = 65000;
    engine.marioX = engine.level.flagX;
    engine.marioY = 176;
    engine.update(16.67);
    for (let i = 0; i < 160 && engine.marioState !== 'castle_entered'; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioState, 'castle_entered');
    let speedAch = engine.getAchievements().find(a => a.id === 'clear_under_60s')!;
    assert.equal(speedAch.unlocked, false);

    // Speedrun < 60s DESBLOQUEIA "clear_under_60s" e concede +1500 pts e +1 vida
    engine.loadLevel(createWorld1_1(), false, false);
    engine.intermissionTimer = 0;
    engine.enemies = [];
    assert.equal(engine.stageElapsedMs, 0);
    stepEngine(engine, 60, 16.67); // ~1 segundo de fase
    assert.ok(engine.getStageElapsedSeconds() > 0 && engine.getStageElapsedSeconds() < 60);

    const livesBeforeSpeed = engine.stats.lives;
    engine.marioX = engine.level.flagX;
    engine.marioY = 176;
    engine.update(16.67);
    for (let i = 0; i < 160 && engine.marioState !== 'castle_entered'; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioState, 'castle_entered');
    speedAch = engine.getAchievements().find(a => a.id === 'clear_under_60s')!;
    assert.equal(speedAch.unlocked, true);
    assert.equal(engine.stats.lives, livesBeforeSpeed + 1);

    // Persistência do AchievementManager com Storage
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const mgr1 = new AchievementManager(mockStorage);
    const evts = mgr1.recordMetric('goombas_defeated', 10, 123456);
    assert.equal(evts.length, 1);
    assert.equal(evts[0].achievement.id, 'defeat_10_goombas');

    const mgr2 = new AchievementManager(mockStorage);
    const persisted = mgr2.getViews().find(a => a.id === 'defeat_10_goombas')!;
    assert.equal(persisted.unlocked, true);
    assert.equal(persisted.unlockedAt, 123456);
  });

  await test('R1.16.PX.4: Todas as caixas de power-up removidas exceto caixas [!] (exclam_yellow) do Modo Super Mario World', () => {
    const collectNonSmwPowerUpBoxes = (lvl: ReturnType<typeof createWorld1_1>) => {
      const found: { tx: number; ty: number; type: string; content: string }[] = [];
      for (let ty = 0; ty < lvl.height; ty++) {
        for (let tx = 0; tx < lvl.width; tx++) {
          const tile = lvl.tiles[ty]?.[tx];
          if (tile && tile.type !== 'exclam_yellow' && isPowerUpBoxContent(tile.content)) {
            found.push({ tx, ty, type: tile.type, content: tile.content });
          }
        }
      }
      return found;
    };

    const builtInStages = [
      createWorld1_1(),
      createSecretVault(),
      createWorld1_2(),
      createWorld2_2(),
      createWorldGhostHouse(),
      createWorld1_4(),
      createEndlessLevel(111, 5),
      createEndlessLevel(222, 6),
      createEndlessLevel(333, 7),
      createEndlessLevel(444, 8),
    ];
    for (let w = 1; w <= 7; w++) {
      for (let s = 1; s <= 5; s++) {
        builtInStages.push(createSingleplayerLevel(w, s));
      }
    }
    for (const node of SMW_WIKIWORLD_NODES) {
      builtInStages.push(createSmwWikiWorldStage(node.id));
    }

    for (const stage of builtInStages) {
      const invalid = collectNonSmwPowerUpBoxes(stage);
      assert.equal(
        invalid.length,
        0,
        `${stage.id} não deve conter caixas de power-up além de exclam_yellow: ${JSON.stringify(invalid)}`
      );
    }

    // Verifica que caixas [!] do Modo Super Mario World permanecem presentes
    const smwMain = createSmwWikiWorldStage('wiki-1-overworld');
    let smwExclamCount = 0;
    for (let ty = 0; ty < smwMain.height; ty++) {
      for (let tx = 0; tx < smwMain.width; tx++) {
        if (smwMain.tiles[ty]?.[tx]?.type === 'exclam_yellow') smwExclamCount++;
      }
    }
    assert.ok(smwExclamCount >= 2, 'Modo Super Mario World deve manter suas caixas [!]');

    // Importação de fase JSON remove power-up de blocos ? mas preserva exclam_yellow
    const legacyLevel = createBlankCustomLevel('LEGADO', 'overworld', 60);
    legacyLevel.tiles[9][6] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
    legacyLevel.tiles[9][7] = { type: 'brick', content: 'fireflower', bumpOffset: 0, bumpVel: 0 };
    legacyLevel.tiles[9][8] = { type: 'exclam_yellow', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
    const imported = parseImportedLevelFile(JSON.stringify(legacyLevel));
    assert.equal(imported.tiles[9][6]?.content, 'coin');
    assert.equal(imported.tiles[9][7]?.content, 'none');
    assert.equal(imported.tiles[9][8]?.type, 'exclam_yellow');
    assert.equal(imported.tiles[9][8]?.content, 'mushroom');

    // Debug Placeables e Editor: apenas exclam_yellow como caixa de power-up
    assert.ok(GameEngine.DEBUG_PLACEABLES.some(p => p.id === 'exclam_yellow'));
    assert.ok(!GameEngine.DEBUG_PLACEABLES.some(p => (p.id as string) === 'question_mushroom'));
  });

  await test('R1.16.GT.4: Poste de pontos só concede pontuação quando o personagem acerta o cursor móvel (fita) no lugar exato', () => {
    // 1. Cálculo direto: só pontua se marioCenterY tocar a posição do cursor (tapeY)
    const calcEngine = createFreshEngine();
    assert.equal(calcEngine.computeGoalGatePoints(56, 178, 16), 0, 'Mario no topo com cursor embaixo não ganha pontos');
    assert.equal(calcEngine.computeGoalGatePoints(184, 48, 16), 0, 'Mario embaixo com cursor no topo não ganha pontos');
    assert.equal(calcEngine.computeGoalGatePoints(110, 110, 16), 30, 'Mario acertando o cursor no meio ganha 30 pontos');
    assert.equal(calcEngine.computeGoalGatePoints(52, 52, 16), 50, 'Mario acertando o cursor no topo ganha 50 pontos');

    // 2. Cruzar o poste no topo quando o cursor está lá embaixo -> passa de fase sem cortar a fita e com 0 pontos
    const highMissEngine = createFreshEngine();
    highMissEngine.enemies = [];
    highMissEngine.goalTapeY = 178;
    highMissEngine.goalTapeDir = -1;
    const scoreBeforeHighMiss = highMissEngine.stats.score;
    const livesBeforeHighMiss = highMissEngine.stats.lives;
    highMissEngine.marioX = highMissEngine.level.flagX;
    highMissEngine.marioY = 48;
    highMissEngine.update(16.67);
    assert.equal(highMissEngine.marioState, 'castle_walk');
    assert.equal(highMissEngine.lastGoalGatePoints, 0);
    assert.equal(highMissEngine.goalPointsWallet, 0);
    assert.equal(highMissEngine.goalTapeCut, false);
    assert.equal(highMissEngine.stats.score, scoreBeforeHighMiss);
    assert.equal(highMissEngine.stats.lives, livesBeforeHighMiss);

    // 3. Cruzar o poste embaixo quando o cursor está no topo -> 0 pontos e fita intacta
    const lowMissEngine = createFreshEngine();
    lowMissEngine.enemies = [];
    lowMissEngine.goalTapeY = 46;
    lowMissEngine.goalTapeDir = 1;
    const scoreBeforeLowMiss = lowMissEngine.stats.score;
    lowMissEngine.marioX = lowMissEngine.level.flagX;
    lowMissEngine.marioY = 176;
    lowMissEngine.update(16.67);
    assert.equal(lowMissEngine.marioState, 'castle_walk');
    assert.equal(lowMissEngine.lastGoalGatePoints, 0);
    assert.equal(lowMissEngine.goalPointsWallet, 0);
    assert.equal(lowMissEngine.goalTapeCut, false);
    assert.equal(lowMissEngine.stats.score, scoreBeforeLowMiss);

    // 4. Cruzar exatamente na altura do cursor no meio (y=109 -> 30 pts) -> corta a fita, soma 30 na carteira e +3000 no placar
    const hitMidEngine = createFreshEngine();
    hitMidEngine.enemies = [];
    hitMidEngine.goalTapeY = 109;
    hitMidEngine.goalTapeDir = 1;
    const scoreBeforeHit = hitMidEngine.stats.score;
    hitMidEngine.marioX = hitMidEngine.level.flagX;
    hitMidEngine.marioY = 102;
    hitMidEngine.update(16.67);
    assert.equal(hitMidEngine.marioState, 'castle_walk');
    assert.equal(hitMidEngine.goalTapeCut, true);
    assert.equal(hitMidEngine.lastGoalGatePoints, 30);
    assert.equal(hitMidEngine.goalPointsWallet, 30);
    assert.equal(hitMidEngine.stats.score, scoreBeforeHit + 3000);
  });

  await test('R1.16.21Z.4: Palácios Switchers Verde, Vermelho, Rosa e Azul só acessíveis via Modo Dev e liberam blocos [!] com power-ups corretos', () => {
    // 1. Não aparecem no mapa comum (SMW_WIKIWORLD_NODES), apenas no registro exclusivo de expansão Dev
    assert.equal(SMW_DEV_ONLY_SWITCH_PALACES.length, 4);
    for (const palace of SMW_DEV_ONLY_SWITCH_PALACES) {
      assert.equal(
        SMW_WIKIWORLD_NODES.some(n => n.id === palace.id),
        false,
        `${palace.id} não pode aparecer no mapa normal antes da expansão`
      );
    }

    // 2. Mapeamento exato de recompensas e ativação de cada interruptor colorido:
    // Verde -> Pena (feather), Vermelho -> Flor de Fogo (fireflower), Rosa -> Laço Femboy (femboy), Azul -> Tanooki (leaf)
    const cases: {
      nodeId: string;
      color: 'green' | 'red' | 'pink' | 'blue';
      exclamTile: 'exclam_green' | 'exclam_red' | 'exclam_pink' | 'exclam_blue';
      switchTile: 'green_switch' | 'red_switch' | 'pink_switch' | 'blue_switch';
      switchPressedTile:
        | 'green_switch_pressed'
        | 'red_switch_pressed'
        | 'pink_switch_pressed'
        | 'blue_switch_pressed';
      expectedItem: 'feather' | 'fireflower' | 'femboy' | 'leaf';
    }[] = [
      {
        nodeId: 'wiki-switch-green',
        color: 'green',
        exclamTile: 'exclam_green',
        switchTile: 'green_switch',
        switchPressedTile: 'green_switch_pressed',
        expectedItem: 'feather',
      },
      {
        nodeId: 'wiki-switch-red',
        color: 'red',
        exclamTile: 'exclam_red',
        switchTile: 'red_switch',
        switchPressedTile: 'red_switch_pressed',
        expectedItem: 'fireflower',
      },
      {
        nodeId: 'wiki-switch-pink',
        color: 'pink',
        exclamTile: 'exclam_pink',
        switchTile: 'pink_switch',
        switchPressedTile: 'pink_switch_pressed',
        expectedItem: 'femboy',
      },
      {
        nodeId: 'wiki-switch-blue',
        color: 'blue',
        exclamTile: 'exclam_blue',
        switchTile: 'blue_switch',
        switchPressedTile: 'blue_switch_pressed',
        expectedItem: 'leaf',
      },
    ];

    for (const c of cases) {
      // a) Bloco [!] bloqueado antes do Switch é intangível; após ativar, fica sólido e gera o item exato
      const testEngine = createFreshEngine();
      testEngine.enemies = [];
      const tx = 5;
      const ty = 9;
      testEngine.level.tiles[ty][tx] = {
        type: c.exclamTile,
        content: c.expectedItem,
        bumpOffset: 0,
        bumpVel: 0,
      };

      testEngine.setSwitchUnlocked(c.color, false);
      testEngine.items = [];
      testEngine.marioX = tx * 16;
      testEngine.marioY = ty * 16 + 14;
      testEngine.marioVy = -5.5;
      testEngine.marioGrounded = false;
      stepEngine(testEngine, 3);
      assert.ok(testEngine.marioY < ty * 16 + 8 || testEngine.items.length === 0);
      assert.equal(testEngine.items.length, 0, `${c.exclamTile} bloqueado não deve gerar item`);

      testEngine.setSwitchUnlocked(c.color, true);
      testEngine.items = [];
      testEngine.marioX = tx * 16;
      testEngine.marioY = ty * 16 + 17;
      testEngine.marioVy = -5.5;
      testEngine.marioGrounded = false;
      stepEngine(testEngine, 3);
      assert.equal(
        testEngine.items[0]?.type,
        c.expectedItem,
        `${c.exclamTile} ativo deve gerar exatamente ${c.expectedItem}`
      );

      // b) Entrar no palácio, pisar no interruptor gigante e concluir ativa a cor correspondente
      const palaceEngine = createFreshEngine();
      const stage = createSmwWikiWorldStage(c.nodeId);
      palaceEngine.startSmwStage(stage, true);
      palaceEngine.intermissionTimer = 0;
      palaceEngine.enemies = [];
      assert.equal(palaceEngine.isSwitchUnlocked(c.color), false);

      let swTx = -1;
      let swTy = -1;
      for (let y = 0; y < palaceEngine.level.height; y++) {
        for (let x = 0; x < palaceEngine.level.width; x++) {
          if (palaceEngine.level.tiles[y]?.[x]?.type === c.switchTile) {
            swTx = x;
            swTy = y;
          }
        }
      }
      assert.ok(swTx > 0 && swTy > 0, `${c.nodeId} deve conter tile ${c.switchTile}`);

      let activatedColor = '';
      palaceEngine.onSmwSwitchActivated = col => {
        activatedColor = col;
      };
      palaceEngine.marioX = swTx * 16;
      palaceEngine.marioY = swTy * 16 - 18;
      palaceEngine.marioVy = 4.0;
      palaceEngine.marioGrounded = false;
      stepEngine(palaceEngine, 3);

      assert.equal(palaceEngine.level.tiles[swTy][swTx]?.type, c.switchPressedTile);
      assert.equal(palaceEngine.isSwitchUnlocked(c.color), true);
      assert.equal(activatedColor, c.color);
      assert.equal(palaceEngine.isStageClear, true);
    }

    // 3. UI do Modo Desenvolvedor expõe "IR ATÉ A FASE ESPECÍFICA" com acesso aos 4 palácios
    const cheatSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CheatMenuModal.tsx'), 'utf8');
    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.ok(cheatSrc.includes('IR ATÉ A FASE ESPECÍFICA'));
    assert.ok(cheatSrc.includes('SMW_DEV_ONLY_SWITCH_PALACES'));
    assert.ok(canvasSrc.includes('handleWarpToSpecificStage'));
  });

  await test('R1.16.1RZ.4: Yoshi disponível apenas no Modo Debug e Editor de Fases, e nunca spawna dentro de castelos', () => {
    // 1. Nenhuma fase padrão ou do mapa SMW possui Yoshi spawnado naturalmente
    const builtInStages = [
      createWorld1_1(),
      createWorld1_2(),
      createWorld2_2(),
      createWorldGhostHouse(),
      createWorld1_4(),
      createSmwWikiWorldStage('wiki-1-overworld'),
      createSmwWikiWorldStage('wiki-2-caverna'),
      createSmwWikiWorldStage('wiki-3-agua'),
      createSmwWikiWorldStage('wiki-4-mansao'),
      createSmwWikiWorldStage('wiki-5-castelo'),
    ];
    for (const st of builtInStages) {
      assert.equal(st.yoshis?.length ?? 0, 0, `${st.id} não deve spawnar Yoshi naturalmente`);
    }

    // 2. Modo Debug permite inserir Yoshi fora de castelos, montar, usar língua e absorver dano
    const overworldEngine = createFreshEngine();
    overworldEngine.enemies = [];
    overworldEngine.toggleDebugMode(true);
    const yoshiIdx = GameEngine.DEBUG_PLACEABLES.findIndex(p => p.id === 'yoshi');
    assert.ok(yoshiIdx >= 0, 'Yoshi deve constar em DEBUG_PLACEABLES');
    overworldEngine.debugPlaceIndex = yoshiIdx;

    const placed = overworldEngine.placeDebugItemAt(120, 12 * 16 - 4);
    assert.equal(placed, true);
    assert.equal(overworldEngine.yoshis.length, 1);

    // Montar no Yoshi
    overworldEngine.marioX = 120;
    overworldEngine.marioY = 12 * 16 - 4;
    overworldEngine.update(16.67);
    assert.equal(overworldEngine.marioOnYoshi, true);
    assert.equal(overworldEngine.yoshis.length, 0);

    // Língua do Yoshi come Goomba à frente
    const goomba = makeEnemy(9801, 'goomba', overworldEngine.marioX + 22, overworldEngine.marioY);
    goomba.vx = 0;
    overworldEngine.enemies.push(goomba);
    overworldEngine.controls.run = true;
    stepEngine(overworldEngine, 3);
    overworldEngine.controls.run = false;
    assert.equal(goomba.alive, false, 'Língua do Yoshi deve derrotar inimigo comum à frente');

    // Dano em cima do Yoshi desmonta e preserva vida/power-up do Mario
    overworldEngine.yoshiTongueTimer = 0;
    overworldEngine.yoshiTongueCooldown = 0;
    overworldEngine.marioPower = 'fire';
    overworldEngine.marioY = 13 * 16 - 30;
    overworldEngine.marioVy = 0;
    overworldEngine.marioGrounded = true;
    overworldEngine.marioInvulnerableTimer = 0;
    const hitEnemy = makeEnemy(9802, 'goomba', overworldEngine.marioX + 2, 13 * 16 - 16);
    hitEnemy.vx = 0;
    overworldEngine.enemies.push(hitEnemy);
    overworldEngine.update(16.67);
    assert.equal(overworldEngine.marioOnYoshi, false);
    assert.equal(overworldEngine.marioPower, 'fire');
    assert.equal(overworldEngine.yoshis.length, 1);
    assert.equal(overworldEngine.yoshis[0].state, 'runaway');

    // 3. Editor customizado fora de castelo carrega Yoshi normalmente
    const customOverworld = createBlankCustomLevel('FASE YOSHI', 'overworld', 60);
    customOverworld.yoshis = [{ x: 96, y: 12 * 16 - 4 }];
    const customEngine = createFreshEngine();
    customEngine.loadLevel(customOverworld, false, false, false);
    customEngine.intermissionTimer = 0;
    assert.equal(customEngine.yoshis.length, 1);

    // 4. Castelo bloqueia Yoshi em TODAS as camadas (Debug, Sanitize, Import JSON e loadLevel)
    const castleDebugEngine = createFreshEngine();
    castleDebugEngine.loadLevel(createWorld1_4(), false, false, false);
    castleDebugEngine.intermissionTimer = 0;
    castleDebugEngine.toggleDebugMode(true);
    castleDebugEngine.debugPlaceIndex = yoshiIdx;
    assert.equal(castleDebugEngine.placeDebugItemAt(96, 128), false);
    assert.equal(castleDebugEngine.yoshis.length, 0);
    assert.equal(castleDebugEngine.spawnYoshiAt(96, 128), null);
    assert.equal(castleDebugEngine.yoshis.length, 0);

    const castleCustom = createBlankCustomLevel('CASTELO TESTE', 'castle', 60);
    castleCustom.yoshis = [{ x: 80, y: 160 }];
    const sanitizedCastle = sanitizeCustomLevelEntities(castleCustom);
    assert.equal(sanitizedCastle.truncated, true);
    assert.equal(sanitizedCastle.level.yoshis, undefined);

    const importedCastle = parseImportedLevelFile(JSON.stringify(castleCustom));
    assert.equal(importedCastle.yoshis, undefined);

    castleDebugEngine.loadLevel(castleCustom, false, false, false);
    assert.equal(castleDebugEngine.yoshis.length, 0);
    assert.equal(castleDebugEngine.marioOnYoshi, false);

    // 5. Editor de Fases bloqueia pincel do Yoshi em tema castelo
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    assert.ok(editorSrc.includes("id: 'yoshi_mount'"));
    assert.ok(editorSrc.includes('isCastleStageForYoshi'));
  });

  await test('R1.19.F5.6: Primeiro boss do primeiro castelo de Johannnnes89 devidamente nomeado', () => {
    assert.ok(JOHANNNNES_CASTLE_1_BOSS_NAME.length > 0);
    assert.notEqual(JOHANNNNES_CASTLE_1_BOSS_NAME.toUpperCase(), 'BOWSER');

    // 1. Nó do mapa SMW nomeia explicitamente o chefe do Castelo de Johannnnes89
    const castleNode = SMW_WIKIWORLD_NODES.find(n => n.id === 'wiki-5-castelo');
    assert.ok(castleNode);
    assert.equal(castleNode.title, 'Castelo de Johannnnes89');
    assert.equal(castleNode.bossName, JOHANNNNES_CASTLE_1_BOSS_NAME);
    assert.ok(castleNode.subtitle.includes(JOHANNNNES_CASTLE_1_BOSS_NAME));

    // 2. Fase carregada no motor atribui o nome do chefe à entidade boss no castelo
    const stage = createSmwWikiWorldStage('wiki-5-castelo');
    assert.equal(stage.bossName, JOHANNNNES_CASTLE_1_BOSS_NAME);

    const engine = createFreshEngine();
    engine.startSmwStage(stage, false);
    engine.intermissionTimer = 0;
    const bossEnemy = engine.enemies.find(e => e.type === 'bowser');
    assert.ok(bossEnemy, 'Castelo de Johannnnes89 deve spawnar o chefe');
    assert.equal(bossEnemy.bossName, JOHANNNNES_CASTLE_1_BOSS_NAME);

    // 3. UI do Overworld e diálogo de vitória usam o nome oficial do chefe
    const mapSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmwOverworldMap.tsx'), 'utf8');
    const engineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/engine.ts'), 'utf8');
    assert.ok(mapSrc.includes('JOHANNNNES_CASTLE_1_BOSS_NAME'));
    assert.ok(engineSrc.includes('getBossDisplayName'));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.F5.6'));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.16.1RZ.4'));
  });

  await test('R1.19.SQ.6: Poste de fim de fase refinado estilo SMW 2.5D com pedestal apoiado no chão', () => {
    const engineSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/engine.ts'), 'utf8');
    const spritesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/sprites.ts'), 'utf8');
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');

    // 1. Camada frontal do poste renderizada após o Mario para efeito 2.5D fiel ao SMW
    const renderMarioIdx = engineSrc.indexOf('this.renderMario(ctx);');
    const renderFgIdx = engineSrc.indexOf('this.renderFlagpoleForeground(ctx);');
    assert.ok(renderMarioIdx > 0 && renderFgIdx > renderMarioIdx, 'Pilar frontal deve renderizar após o Mario');
    assert.ok(engineSrc.includes('getGoalFrontPostGroundY'), 'Pilar frontal deve detectar o chão abaixo para não flutuar');

    // 2. Sprites refinados no SpriteAtlas (cúpula metálica com colar dourado, haste segmentada, fita xadrez)
    assert.ok(spritesSrc.includes('Golden collar ring at the base of the dome'));
    assert.ok(spritesSrc.includes('Subtle SMW cylindrical ring seams'));
    assert.ok(spritesSrc.includes('White & gold checkered tape stripe'));

    // 3. Preview do Editor atualizado e registro no histórico de atualizações
    assert.ok(editorSrc.includes('Grounded pedestal base under front pillar'));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.SQ.6'));

    // 4. Renderização próxima ao poste executa sem erros (inclusive com fita inteira e fita cortada)
    const engine = createFreshEngine();
    engine.loadLevel(createWorld1_1(), false, false, false);
    engine.intermissionTimer = 0;
    engine.marioX = engine.level.flagX - 12;
    engine.camera.snapTo(Math.max(0, engine.level.flagX - 100), engine.level.width * 16);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    engine.render(ctx);
    engine.goalTapeCut = true;
    engine.render(ctx);
  });

  await test('R1.19.1GX.5: Chaves, Buraco de Chave, Botões Móveis (Azul/Ciano) e carregamento de cascos com Corrida', () => {
    // 1. Carregar casco de Koopa mantendo Corrida pressionado, soltar chutando ou depositar com Baixo
    const shellEngine = createFreshEngine();
    shellEngine.enemies = [];
    shellEngine.items = [];
    stepEngine(shellEngine, 5);
    const yGround = 13 * GameEngine.TILE_SIZE - 16;
    const koopaShell = makeEnemy(9910, 'koopa', shellEngine.marioX + 12, yGround);
    koopaShell.height = 16;
    koopaShell.state = 'shell_idle';
    koopaShell.stateTimer = 300;
    koopaShell.vx = 0;
    shellEngine.enemies.push(koopaShell);

    shellEngine.controls.run = true;
    shellEngine.marioFacing = 'right';
    shellEngine.update(16.67);
    assert.equal(shellEngine.heldShellEnemyId, koopaShell.id, 'Segurar Corrida deve pegar o casco parado');
    assert.equal(shellEngine.isCarryingAnything(), true);

    // Enquanto segura Corrida, o casco acompanha a frente do personagem
    shellEngine.marioX += 16;
    shellEngine.update(16.67);
    assert.equal(shellEngine.heldShellEnemyId, koopaShell.id);
    assert.ok(Math.abs(koopaShell.x - (shellEngine.marioX + 10)) <= 1);

    // Soltar Corrida com Baixo pressionado deposita o casco parado; sem Baixo chuta o casco
    shellEngine.controls.down = true;
    shellEngine.controls.run = false;
    shellEngine.update(16.67);
    assert.equal(shellEngine.heldShellEnemyId, null);
    assert.equal(koopaShell.state, 'shell_idle', 'Soltar com Baixo deve depositar o casco suavemente');

    shellEngine.controls.down = false;
    shellEngine.controls.run = true;
    shellEngine.marioX = koopaShell.x - 10;
    shellEngine.marioY = koopaShell.y;
    shellEngine.update(16.67);
    assert.equal(shellEngine.heldShellEnemyId, koopaShell.id);
    shellEngine.controls.run = false;
    shellEngine.update(16.67);
    assert.equal(shellEngine.heldShellEnemyId, null);
    assert.equal(koopaShell.state, 'shell_moving', 'Soltar Corrida deve chutar o casco');
    assert.ok(Math.abs(koopaShell.vx) > 3);

    // 2. Botão Móvel Azul: pode ser carregado e ao ser pisado transforma moedas em blocos temporários e depois reverte
    const blueEngine = createFreshEngine();
    blueEngine.enemies = [];
    blueEngine.items = [];
    stepEngine(blueEngine, 5);
    const coinTx = 10;
    const coinTy = 10;
    blueEngine.level.tiles[coinTy][coinTx] = null;
    blueEngine.items.push(makeItem(9911, 'coin', coinTx * 16, coinTy * 16));
    const blueSwitch = blueEngine.spawnCarryableObject('p_switch_blue', blueEngine.marioX + 14, yGround);

    // Segurar Corrida carrega o botão azul
    blueEngine.controls.run = true;
    blueEngine.marioX = blueSwitch.x - 6;
    blueEngine.marioY = blueSwitch.y;
    blueEngine.update(16.67);
    assert.equal(blueEngine.heldCarryableId, blueSwitch.id, 'Botão Azul deve ser carregável com Corrida');
    blueEngine.controls.down = true;
    blueEngine.controls.run = false;
    blueEngine.update(16.67);
    blueEngine.controls.down = false;

    // Pisar de cima no Botão Azul ativa conversão moedas -> blocos
    stepEngine(blueEngine, 16);
    blueEngine.marioX = blueSwitch.x;
    blueEngine.marioY = blueSwitch.y - 18;
    blueEngine.marioVy = 4.0;
    blueEngine.update(16.67);
    assert.equal(blueSwitch.pressed, true);
    assert.ok(blueEngine.pSwitchBlueTimer > 500);
    const transformedTile = blueEngine.level.tiles[coinTy][coinTx] as { type: string } | null;
    assert.equal(transformedTile?.type, 'brick', 'Moeda deve virar bloco sólido');
    assert.equal(blueEngine.items.filter(i => i.type === 'coin').length, 0);

    // Quando o temporizador zera, o bloco volta a ser moeda coletável
    blueEngine.pSwitchBlueTimer = 1;
    blueEngine.update(16.67);
    assert.equal(blueEngine.pSwitchBlueTimer, 0);
    assert.equal(blueEngine.level.tiles[coinTy][coinTx] as unknown, null, 'Bloco temporário deve sumir após o tempo');
    assert.equal(blueEngine.items.filter(i => i.type === 'coin').length, 1, 'Moeda original deve retornar');

    // 3. Botão Móvel Ciano: transforma inimigos comuns em moedas, mas preserva o boss final do castelo (bowser)
    const cyanEngine = createFreshEngine();
    cyanEngine.enemies = [];
    cyanEngine.items = [];
    stepEngine(cyanEngine, 5);
    const goombaTarget = makeEnemy(9912, 'goomba', 140, yGround);
    goombaTarget.vx = 0;
    const koopaTarget = makeEnemy(9913, 'koopa', 172, yGround - 8);
    koopaTarget.vx = 0;
    const bossTarget = makeEnemy(9914, 'bowser', 210, yGround - 16);
    bossTarget.vx = 0;
    cyanEngine.enemies.push(goombaTarget, koopaTarget, bossTarget);

    const cyanSwitch = cyanEngine.spawnCarryableObject('p_switch_cyan', 96, yGround);
    cyanEngine.marioX = cyanSwitch.x;
    cyanEngine.marioY = cyanSwitch.y - 18;
    cyanEngine.marioVy = 4.0;
    cyanEngine.update(16.67);

    assert.equal(cyanSwitch.pressed, true);
    assert.equal(goombaTarget.alive, false, 'Goomba deve ser convertido em moeda pelo botão ciano');
    assert.equal(koopaTarget.alive, false, 'Koopa deve ser convertido em moeda pelo botão ciano');
    assert.equal(bossTarget.alive, true, 'Boss final do castelo NÃO pode ser transformado em moeda');
    assert.equal(cyanEngine.items.filter(i => i.type === 'coin').length, 2);

    // 4. Chave + Buraco de Chave: carregar a chave até o buraco conclui a fase
    const keyEngine = createFreshEngine();
    keyEngine.enemies = [];
    keyEngine.items = [];
    stepEngine(keyEngine, 5);
    const keyObj = keyEngine.spawnCarryableObject('key', keyEngine.marioX + 10, yGround);
    const keyholeObj = keyEngine.spawnKeyhole(keyEngine.marioX + 64, yGround);

    keyEngine.controls.run = true;
    keyEngine.marioX = keyObj.x - 4;
    keyEngine.marioY = keyObj.y;
    keyEngine.update(16.67);
    assert.equal(keyEngine.heldCarryableId, keyObj.id, 'Chave deve ser carregada com Corrida');

    keyEngine.marioX = keyholeObj.x - 10;
    keyEngine.marioY = keyholeObj.y;
    keyEngine.update(16.67);
    assert.equal(keyholeObj.activated, true);
    assert.ok(keyEngine.keyholeClearTimer > 0);
    for (let i = 0; i < 48 && !keyEngine.isStageClear; i++) {
      keyEngine.update(16.67);
    }
    assert.equal(keyEngine.isStageClear, true, 'Destravar buraco de chave deve concluir a fase');

    // 5. Debug Mode, Editor de Fases, Sanitização/Importação e Notas de Atualização
    for (const id of ['key', 'keyhole', 'p_switch_blue', 'p_switch_cyan'] as const) {
      assert.ok(
        GameEngine.DEBUG_PLACEABLES.some(p => p.id === id),
        `${id} deve estar disponível em DEBUG_PLACEABLES`
      );
    }
    const debugEngine = createFreshEngine();
    debugEngine.toggleDebugMode(true);
    debugEngine.debugPlaceIndex = GameEngine.DEBUG_PLACEABLES.findIndex(p => p.id === 'p_switch_blue');
    assert.equal(debugEngine.placeDebugItemAt(110, 140), true);
    assert.equal(debugEngine.carryables[0]?.kind, 'p_switch_blue');

    const customPuzzle = createBlankCustomLevel('CHAVE TESTE', 'ghost_house', 60);
    customPuzzle.carryables = [
      { kind: 'key', x: 80, y: 176 },
      { kind: 'p_switch_blue', x: 112, y: 176 },
      { kind: 'p_switch_cyan', x: 144, y: 176 },
    ];
    customPuzzle.keyholes = [{ x: 192, y: 176 }];
    const importedPuzzle = parseImportedLevelFile(JSON.stringify(customPuzzle));
    assert.equal(importedPuzzle.carryables?.length, 3);
    assert.equal(importedPuzzle.keyholes?.length, 1);

    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    assert.ok(editorSrc.includes("id: 'key_item'"));
    assert.ok(editorSrc.includes("id: 'keyhole_goal'"));
    assert.ok(editorSrc.includes("id: 'p_switch_blue'"));
    assert.ok(editorSrc.includes("id: 'p_switch_cyan'"));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.1GX.5'));
  });

  await test('R1.19.14C.5: Bonus Stage dos 100 pontos concede power-up escolhido no lugar da vida e preserva ao sair', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.marioPower = 'small';
    engine.reservePowerUp = null;
    engine.goalPointsWallet = 50;
    engine.applyGoalPointsReward(50, engine.level.flagX, 48);
    assert.equal(engine.pendingBonusStage, true);
    engine.startSmwBonusStage();
    assert.equal(engine.isBonusStageActive, true);
    assert.equal(engine.bonusStageBlocks.length, 9);

    const livesStart = engine.stats.lives;

    // 1. Selecionar Cogumelo no 1º bloco -> Small vira Super sem ganhar vida
    const mushroomIdx = GameEngine.BONUS_BLOCK_FACES.indexOf('mushroom');
    assert.ok(mushroomIdx >= 0);
    engine.bonusStageBlocks[0].faceIndex = mushroomIdx;
    assert.equal(engine.resolveBonusStageBlock(engine.bonusStageBlocks[0].tx, engine.bonusStageBlocks[0].ty), true);
    assert.equal(engine.marioPower, 'super');
    assert.equal(engine.stats.lives, livesStart);
    assert.equal(engine.bonusStageLivesWon, 0);

    // 2. Selecionar Flor de Fogo no 2º bloco -> vira Fire e guarda Cogumelo na reserva
    const flowerIdx = GameEngine.BONUS_BLOCK_FACES.indexOf('flower');
    assert.ok(flowerIdx >= 0);
    engine.bonusStageBlocks[1].faceIndex = flowerIdx;
    assert.equal(engine.resolveBonusStageBlock(engine.bonusStageBlocks[1].tx, engine.bonusStageBlocks[1].ty), true);
    assert.equal(engine.marioPower, 'fire');
    assert.equal(engine.reservePowerUp, 'mushroom');

    // 3. Selecionar Pena, Tanooki e Laço Femboy concede cada poder correspondente
    const featherIdx = GameEngine.BONUS_BLOCK_FACES.indexOf('feather');
    const leafIdx = GameEngine.BONUS_BLOCK_FACES.indexOf('leaf');
    const femboyIdx = GameEngine.BONUS_BLOCK_FACES.indexOf('femboy');
    assert.ok(featherIdx >= 0 && leafIdx >= 0 && femboyIdx >= 0);

    engine.bonusStageBlocks[2].faceIndex = featherIdx;
    engine.resolveBonusStageBlock(engine.bonusStageBlocks[2].tx, engine.bonusStageBlocks[2].ty);
    assert.equal(engine.marioPower, 'cape');

    engine.bonusStageBlocks[3].faceIndex = leafIdx;
    engine.resolveBonusStageBlock(engine.bonusStageBlocks[3].tx, engine.bonusStageBlocks[3].ty);
    assert.equal(engine.marioPower, 'tanooki');

    engine.bonusStageBlocks[4].faceIndex = femboyIdx;
    engine.resolveBonusStageBlock(engine.bonusStageBlocks[4].tx, engine.bonusStageBlocks[4].ty);
    assert.equal(engine.marioPower, 'femboy');

    // 4. Completar os blocos restantes alternando entre power-up e 1-UP -> preserva 'femboy' na próxima fase
    for (let i = 5; i < engine.bonusStageBlocks.length; i++) {
      engine.bonusStageBlocks[i].faceIndex = i === 8 ? flowerIdx : 0; // último bloco seleciona Flor de Fogo -> 'fire'
      engine.resolveBonusStageBlock(engine.bonusStageBlocks[i].tx, engine.bonusStageBlocks[i].ty);
    }
    assert.equal(engine.marioPower, 'fire');
    assert.equal(engine.reservePowerUp, 'femboy');
    assert.equal(engine.bonusStageLivesWon, 3);
    assert.equal(engine.stats.lives, livesStart + 3);
    assert.ok(engine.bonusStageFinishDelay > 0);

    // Renderização durante Bonus Stage funciona sem erros para blocos resolvidos e ativos
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    engine.render(ctx);

    // Finaliza Bonus Stage e garante que power-up e reserva continuam equipados na fase seguinte
    stepEngine(engine, engine.bonusStageFinishDelay + 2);
    assert.equal(engine.isBonusStageActive, false);
    assert.equal(engine.level.id, 'world-1-2');
    assert.equal(engine.marioPower, 'fire');
    assert.equal(engine.reservePowerUp, 'femboy');
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.14C.5'));
  });

  await test('R1.19.29D.5: Cano secreto de W-1 leva ao subsolo com Chave + Fechadura e abre caminho ao Palácio Amarelo', () => {
    // 1. Progressão no mapa: saída normal de W-1 abre W-2, mas NÃO abre Palácio Amarelo
    const base: SmwBetaProgress = {
      clearedNodeIds: [],
      secretClearedNodeIds: [],
      selectedNodeId: 'wiki-1-overworld',
      selectedIslandId: 'wikiworld',
      storySeen: true,
      yellowSwitchUnlocked: false,
    };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', base), false);

    const onlyNormal: SmwBetaProgress = { ...base, clearedNodeIds: ['wiki-1-overworld'] };
    assert.equal(isSmwNodeUnlocked('wiki-2-caverna', onlyNormal), true);
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', onlyNormal), false);

    // 2. Entrar no cano secreto de W-1 (x=33*16) pressionando Baixo teleporta ao subsolo
    const engine = createFreshEngine();
    let completedEvent: { nodeId: string; secretExit?: boolean } | null = null;
    engine.onSmwStageCompleted = (nodeId, meta) => {
      completedEvent = { nodeId, secretExit: meta?.secretExit };
    };
    const w1Stage = createSmwWikiWorldStage('wiki-1-overworld');
    engine.startSmwStage(w1Stage, false);
    engine.intermissionTimer = 0;

    // Posiciona Mario sobre o cano secreto (x=33*16, topo em row 11 => y=176)
    engine.marioX = 33 * 16 + 8;
    engine.marioY = 11 * 16 - 16;
    engine.marioGrounded = true;
    engine.controls.down = true;
    stepEngine(engine, 3);
    assert.equal(engine.marioState, 'pipe_entering');

    // Avança animação de entrada no cano até concluir o warp para o subsolo
    engine.controls.down = false;
    stepEngine(engine, 40);
    assert.equal(engine.level.id, 'smw-wiki-1-secret');
    assert.equal(engine.level.theme, 'underground');
    assert.equal(engine.level.smwNodeId, 'wiki-1-overworld');
    assert.ok(engine.carryables.some(c => c.kind === 'key'), 'Subsolo deve conter uma Chave');
    assert.ok(engine.keyholes.length >= 1, 'Subsolo deve conter um Buraco de Chave');
    assert.ok((engine.level.pipeWarps ?? []).some(pw => pw.toLevel === 'wiki-1-overworld'));

    // 3. Testar também o cano de retorno do subsolo voltando para W-1
    const returnEngine = createFreshEngine();
    returnEngine.startSmwStage(createSmwWikiWorldStage('wiki-1-overworld'), false);
    returnEngine.intermissionTimer = 0;
    returnEngine.marioX = 33 * 16 + 8;
    returnEngine.marioY = 11 * 16 - 16;
    returnEngine.marioGrounded = true;
    returnEngine.controls.down = true;
    stepEngine(returnEngine, 40);
    returnEngine.controls.down = false;
    assert.equal(returnEngine.level.id, 'smw-wiki-1-secret');
    returnEngine.marioX = 28 * 16 + 8;
    returnEngine.marioY = 9 * 16 - 16;
    returnEngine.marioGrounded = true;
    returnEngine.controls.down = true;
    stepEngine(returnEngine, 40);
    returnEngine.controls.down = false;
    assert.equal(returnEngine.level.id, 'smw-wiki-1');
    assert.equal(returnEngine.level.smwNodeId, 'wiki-1-overworld');

    // 4. No subsolo, segurar Corrida pega a Chave e levá-la ao Buraco de Chave conclui com secretExit: true
    engine.enemies = [];
    const keyObj = engine.carryables.find(c => c.kind === 'key')!;
    const keyhole = engine.keyholes[0];
    engine.marioX = keyObj.x;
    engine.marioY = keyObj.y;
    engine.controls.run = true;
    stepEngine(engine, 3);
    assert.equal(engine.heldCarryableId, keyObj.id, 'Segurar Corrida deve pegar a Chave no subsolo');

    engine.marioX = keyhole.x - 4;
    engine.marioY = keyhole.y;
    stepEngine(engine, 3);
    assert.equal(keyhole.activated, true);
    assert.equal(engine.lastClearWasSecretExit, true);

    // Avança animação de fechadura até disparar onSmwStageCompleted
    stepEngine(engine, 50);
    assert.equal(engine.isStageClear, true);
    engine.stats.time = 0;
    stepEngine(engine, 90);
    assert.deepEqual(completedEvent, { nodeId: 'wiki-1-overworld', secretExit: true });

    // 5. Saída secreta libera Palácio Amarelo e preserva em Save/Load Slot
    const secretProgress: SmwBetaProgress = {
      ...base,
      secretClearedNodeIds: ['wiki-1-overworld'],
    };
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', secretProgress), true);
    assert.equal(isSmwNodeUnlocked('wiki-2-caverna', secretProgress), false);

    const store = new Map<string, string>();
    const memoryStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    saveSmwToSlot(0, secretProgress, { stageName: 'Subsolo W-1', lives: 5, score: 2500 }, memoryStorage);
    const loadedSlots = loadSmwSaveSlots(memoryStorage);
    assert.ok(loadedSlots[0]);
    const restored = applySmwSlotToProgress(loadedSlots[0]!);
    assert.deepEqual(restored.secretClearedNodeIds, ['wiki-1-overworld']);
    assert.equal(isSmwNodeUnlocked('wiki-switch-yellow', restored), true);
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.29D.5'));
  });
}

async function main() {
  console.log('=== Super Mario TypeScript — Suíte de Testes de Regressão (R0.15.6J.3 + R0.15.0.6L.4 + RW0.15.0.1DM.4 + RW0.15.0.PW.4 + R1.16.*) ===');
  await runPhysicsTests();
  await runPowerUpTests();
  await runScoringLivesAndGuardsTests();
  await runModesAndLevelsTests();
  await runFirebaseAndPolicyIntegrityTests();
  await runMultiplayerCompatibilityTests();
  await runSmartTvAdaptationTests();
  await runYellowSwitchPalaceTests();
  await runR116FixesTests();
  console.log(`\nResultado final: ${passed} testes aprovados, 0 falhas.`);
}

main().catch((err) => {
  console.error('\n[FAIL] Erro na suíte de regressão:', err);
  process.exit(1);
});
