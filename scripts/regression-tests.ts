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
    rect: noop,
    clip: noop,
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
import { Goomba, KoopaTroopa, PiranhaPlant, Player, QuestionBlock, TileMap } from '../src/components/GameCanvas.tsx';
import {
  isModeAndEditorLocked,
  canOpenLevelEditor,
  canSwitchGameMode,
  canExitToMainMenu,
} from '../src/game/modePolicy.ts';
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
  parseWorldStageFromJson,
  serializeLevelToFileJson,
  placeKeyCavePipeInLevel,
  pruneKeyCavePipeWarps,
  placeSurfaceExitPipeInLevel,
  pruneSurfaceExitPipeWarps,
  isSurfaceExitPipeWarp,
  placeGhostDoorInLevel,
  pruneGhostDoorWarps,
  isGhostDoorTile,
  isGhostOutsideExitDoorWarp,
  placeWarpPipeInLevel,
  placeWCoinInLevel,
  placeMidwayCheckpointInLevel,
  insertLevelColumnAt,
  deleteLevelColumnAt,
  applyTerrainPresetToLevel,
  KEY_CAVE_PIPE_TARGET,
  isPowerUpBoxContent,
  normalizeHexLevelCode,
  formatHexCoord,
  parseHexCoord,
  EDITOR_MAX_ENEMIES,
  EDITOR_MAX_COINS,
  EDITOR_MAX_FLOATING_PLATFORMS,
  EDITOR_MAX_TOTAL_ENTITIES,
  STAGE_W_COINS_COUNT,
} from '../src/game/levels.ts';
import { CameraSystem } from '../src/game/camera.ts';
import { AchievementManager } from '../src/game/achievements.ts';
import {
  JOHANNNNES_CASTLE_1_BOSS_NAME,
  SMW_ISLANDS,
  SMW_ISLAND2_NODES,
  SMW_ISLAND2_UNAVAILABLE_MSG,
  SMW_WIKIWORLD_NODES,
  SMW_DEV_ONLY_SWITCH_PALACES,
  WORLD_STAGE_JSON_REGISTRY,
  HEX_LEVEL_LIST,
  inspectHexLevelTarget,
  resolveHexLevelTarget,
  createSmwWiki1SecretRoom,
  createSmwWikiWorldStage,
  getWorldStageFilename,
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
  isSmwNodeCleared,
  canExitSmwStageWithSelect,
  type SmwBetaProgress,
} from '../src/game/smwWorldMap.ts';
import { GAME_UPDATES } from '../src/components/UpdatesModal.tsx';
import {
  isSmartTvUserAgent,
  resolveTvRemoteAction,
  findBestSpatialCandidateIndex,
} from '../src/game/smartTv.ts';
import { SoundEngine } from '../src/game/audio.ts';
import {
  COMMERCIAL_SKIP_DELAY_SECONDS,
  WAZZIMAGIYGG_COMMERCIALS,
  canSkipCommercial,
  getActiveCommercialScene,
  getCommercialById,
  getCommercialRemainingSeconds,
  getDossierWazzimaCommercial,
  getNextCommercialInRotation,
  getPrimaryWazzimaCommercial,
} from '../src/game/commercials.ts';
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

  await test('Classe Player em GameCanvas replica velocidade, gravidade e pulo originais do NES', () => {
    const player = new Player(40, 192, 'small');
    assert.equal(Player.WIDTH, 16);
    assert.equal(Player.SMALL_HEIGHT, 16);
    assert.equal(Player.BIG_HEIGHT, 30);
    assert.equal(Player.WALK_MAX_SPEED, 2.0);
    assert.equal(Player.RUN_MAX_SPEED, 3.4);
    assert.equal(Player.GRAVITY_ASCENDING, 0.38);
    assert.equal(Player.GRAVITY_DESCENDING, 0.62);
    assert.equal(Player.WALK_JUMP_IMPULSE, -7.4);
    assert.equal(Player.RUN_JUMP_IMPULSE, -8.4);

    // 1. Settle on ground (y + height = 208)
    for (let i = 0; i < 10; i++) {
      player.update({}, { groundY: 208 });
    }
    assert.equal(player.grounded, true);
    assert.equal(player.y, 192);
    assert.equal(player.vy, 0);

    // 2. Walk vs Run velocity & skidding/friction
    for (let i = 0; i < 40; i++) {
      player.update({ right: true, run: false }, { groundY: 208 });
    }
    assert.ok(player.vx > 1.8 && player.vx <= 2.01, `player walk vx=${player.vx}`);
    assert.equal(player.state, 'running');

    for (let i = 0; i < 40; i++) {
      player.update({ right: true, run: true }, { groundY: 208 });
    }
    assert.ok(player.vx > 3.2 && player.vx <= 3.41, `player run vx=${player.vx}`);

    // Skid on turnaround
    player.update({ left: true, run: true }, { groundY: 208 });
    assert.equal(player.state, 'skidding');

    // Crisp stop on release
    for (let i = 0; i < 30; i++) {
      player.update({}, { groundY: 208 });
    }
    assert.equal(player.vx, 0);
    assert.equal(player.state, 'idle');

    // 3. Standing jump (-7.4 + 0.38), variable jump cut (-2.5 + 0.38), descending gravity (0.62), terminal velocity (7.0)
    player.update({ jump: true }, { groundY: 208 });
    assert.ok(Math.abs(player.vy - (-7.4 + 0.38)) < 1e-4, `player walk jump vy=${player.vy}`);
    assert.equal(player.grounded, false);
    assert.equal(player.state, 'jumping');

    player.update({ jump: false }, { groundY: 208 });
    assert.ok(Math.abs(player.vy - (-2.5 + 0.38)) < 1e-4, `player variable cut vy=${player.vy}`);

    // Step until descending and verify 0.62 gravity
    for (let i = 0; i < 10; i++) {
      player.update({}, {});
    }
    assert.ok(player.vy > 0, `player should be descending vy=${player.vy}`);
    const vyBefore = player.vy;
    player.update({}, {});
    assert.ok(Math.abs((player.vy - vyBefore) - 0.62) < 1e-4, `descending gravity step=${player.vy - vyBefore}`);

    // Terminal velocity clamp
    for (let i = 0; i < 30; i++) {
      player.update({}, {});
    }
    assert.equal(player.vy, Player.MAX_FALL_SPEED);

    // Land back on ground & verify running jump impulse (-8.4 + 0.38)
    for (let i = 0; i < 50; i++) {
      player.update({}, { groundY: 208 });
    }
    assert.equal(player.grounded, true);
    player.update({ jump: true, run: true }, { groundY: 208 });
    assert.ok(Math.abs(player.vy - (-8.4 + 0.38)) < 1e-4, `player run jump vy=${player.vy}`);

    // 4. Sync with live GameEngine state
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.controls.right = true;
    stepEngine(engine, 12);
    player.syncFromEngine(engine);
    assert.equal(player.x, engine.marioX);
    assert.equal(player.y, engine.marioY);
    assert.equal(player.vx, engine.marioVx);
    assert.equal(player.vy, engine.marioVy);
    assert.equal(player.power, engine.marioPower);
  });

  await test('Sistema TileMap em GameCanvas carrega fases, renderiza blocos estáticos e resolve colisões com Player', () => {
    const world = createWorld1_1();
    const tileMap = new TileMap();
    tileMap.loadLevel(world);
    assert.equal(tileMap.width, world.width);
    assert.equal(tileMap.height, world.height);
    assert.equal(tileMap.tileSize, 16);

    // 1. Verificação de solidez (chão, tijolo e [!] controlado por Switch)
    assert.equal(tileMap.isSolidTile('ground'), true);
    assert.equal(tileMap.isSolidTile('brick'), true);
    assert.equal(tileMap.isSolidTile('exclam_yellow'), false);
    tileMap.setSwitchStates({ yellow: true });
    assert.equal(tileMap.isSolidTile('exclam_yellow'), true);

    // 2. Renderização de blocos estáticos visíveis dentro da câmera sem erros
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    tileMap.render(ctx, 0, 256);

    // 3. Colisão vertical (pouso no chão, batida no teto e revelação de bloco invisível)
    const testLevel = createBlankCustomLevel('TILEMAP TEST', 'overworld', 30);
    // Floor at row 13 (y = 208)
    for (let tx = 0; tx < 30; tx++) {
      testLevel.tiles[13][tx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Brick wall at tx=6, ty=12 (x=96..112, y=192..208)
    testLevel.tiles[12][6] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    // Ceiling question block at tx=3, ty=9 (y=144..160)
    testLevel.tiles[9][3] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
    // Hidden block at tx=4, ty=9 (y=144..160)
    testLevel.tiles[9][4] = { type: 'question', content: '1up', bumpOffset: 0, bumpVel: 0, invisible: true };

    const map = new TileMap(testLevel);
    const p = new Player(48, 190, 'small');
    p.vy = 4;
    const landRes = map.resolvePlayerCollision(p);
    assert.equal(landRes.landed, true);
    assert.equal(p.grounded, true);
    assert.equal(p.y, 13 * 16 - 16);

    // Horizontal wall collision against tx=6
    p.x = 78;
    p.vx = 6;
    p.vy = 0;
    const wallRes = map.resolvePlayerCollision(p);
    assert.equal(wallRes.hitWall, true);
    assert.equal(p.vx, 0);
    assert.equal(p.x, 6 * 16 - 15);

    // Ceiling question block hit from below
    p.x = 3 * 16;
    p.y = 162;
    p.vx = 0;
    p.vy = -5;
    let hitCount = 0;
    const ceilRes = map.resolvePlayerCollision(p, {
      onBlockHit: (hit) => {
        hitCount++;
        assert.equal(hit.tileX, 3);
        assert.equal(hit.tileY, 9);
      },
    });
    assert.equal(ceilRes.hitCeiling, true);
    assert.equal(hitCount, 1);
    assert.equal(p.y, 10 * 16);

    // Hidden block reveal from below
    p.x = 4 * 16;
    p.y = 160;
    p.vy = -4;
    const hiddenRes = map.resolvePlayerCollision(p);
    assert.equal(hiddenRes.revealedHiddenBlocks.length, 1);
    assert.equal(map.getTileAt(4, 9)?.invisible, false);

    // 4. Sincronização com GameEngine
    const engine = createFreshEngine();
    map.syncFromEngine(engine);
    assert.equal(map.level, engine.level);
    assert.equal(map.width, engine.level.width);
  });

  await test('Classe Goomba (GameCanvas.tsx): patrulha horizontal, colisão com canos e interação com Mario', () => {
    const level = createBlankCustomLevel('GOOMBA TEST', 'overworld', 30);
    // Floor at row 13 (y = 208)
    for (let tx = 0; tx < 30; tx++) {
      level.tiles[13][tx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Pipe at tx=10..11, ty=11..12 (x=160..192, y=176..208)
    level.tiles[11][10] = { type: 'pipe_top_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[11][11] = { type: 'pipe_top_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][10] = { type: 'pipe_body_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][11] = { type: 'pipe_body_right', content: 'none', bumpOffset: 0, bumpVel: 0 };

    const map = new TileMap(level);

    // 1. Patrulha para direita, pouso no chão e reversão ao bater no cano
    const g = new Goomba(140, 192, Goomba.DEFAULT_SPEED, 1);
    let sawPipeHit = false;
    for (let i = 0; i < 20; i++) {
      const res = g.update(map);
      if (res.hitPipe) {
        sawPipeHit = true;
        assert.equal(res.turnedAround, true);
        assert.equal(g.x, 10 * 16 - Goomba.WIDTH);
        assert.ok(g.vx < 0);
        assert.equal(g.facing, 'left');
        break;
      }
    }
    assert.equal(sawPipeHit, true);
    assert.equal(g.grounded, true);
    assert.equal(g.y, 13 * 16 - Goomba.HEIGHT);

    // 2. Reversão no limite esquerdo do mundo
    const leftGoomba = new Goomba(1, 192, -Goomba.DEFAULT_SPEED, 2);
    let sawWorldBounce = false;
    for (let i = 0; i < 10; i++) {
      const res = leftGoomba.update(map);
      if (res.hitWorldBound) {
        sawWorldBounce = true;
        assert.equal(leftGoomba.x, 0);
        assert.ok(leftGoomba.vx > 0);
        assert.equal(leftGoomba.facing, 'right');
        break;
      }
    }
    assert.equal(sawWorldBounce, true);

    // 3. Colisão lateral fere Mario
    const patrolGoomba = new Goomba(100, 192, -Goomba.DEFAULT_SPEED, 3);
    const sideMario = new Player(90, 192, 'small');
    sideMario.vy = 0;
    assert.equal(patrolGoomba.checkPlayerCollision(sideMario), 'hurt_player');
    assert.equal(patrolGoomba.alive, true);

    // 4. Stomp de cima esmaga Goomba e aplica quique no Mario
    const stompGoomba = new Goomba(100, 192, -Goomba.DEFAULT_SPEED, 4);
    const stompMario = new Player(100, 181, 'small');
    stompMario.vy = 4.5;
    assert.equal(stompGoomba.checkPlayerCollision(stompMario), 'stomped');
    assert.equal(stompGoomba.alive, false);
    assert.equal(stompGoomba.state, 'squashed');
    assert.equal(stompMario.vy, Goomba.STOMP_BOUNCE_VY);

    // Timer de squashed até expirar
    for (let i = 0; i < Goomba.SQUASH_DURATION; i++) {
      stompGoomba.update(map);
    }
    assert.equal(stompGoomba.isExpired(), true);

    // 5. Starman vira Goomba de ponta-cabeça e renderização headless sem erro
    const starGoomba = new Goomba(100, 192, -Goomba.DEFAULT_SPEED, 5);
    const starMario = new Player(96, 192, 'small');
    starMario.starTimer = 120;
    assert.equal(starGoomba.checkPlayerCollision(starMario), 'star_defeat');
    assert.equal(starGoomba.state, 'flipped');
    assert.equal(starGoomba.vy, Goomba.STAR_FLIP_VY);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    patrolGoomba.render(ctx, 0);
    stompGoomba.render(ctx, 0);
    starGoomba.render(ctx, 0);
  });

  await test('Classe QuestionBlock (GameCanvas.tsx): moedas, power-ups progressivos, bloco invisível e colisão por baixo', () => {
    // 1. Bloco de moeda único: colisão por cima não ativa; colisão por baixo dispensa moeda e esgota
    const coinBlock = new QuestionBlock(5, 9, 'coin'); // x=80, y=144, bottom=160
    const fallingMario = new Player(80, 128, 'small');
    fallingMario.vy = 3.0;
    const topHit = coinBlock.checkPlayerBumpFromBelow(fallingMario);
    assert.equal(topHit.bumped, false);
    assert.equal(coinBlock.isEmpty(), false);

    const bumpingMario = new Player(80, 158, 'small');
    bumpingMario.vy = -4.5;
    const coinHit = coinBlock.checkPlayerBumpFromBelow(bumpingMario);
    assert.equal(coinHit.bumped, true);
    assert.equal(coinHit.spawnedItem, 'coin');
    assert.equal(coinHit.coinAwarded, true);
    assert.equal(coinHit.depletedToEmpty, true);
    assert.equal(coinBlock.type, 'question_empty');
    assert.equal(coinBlock.isEmpty(), true);
    assert.equal(bumpingMario.y, 160);
    assert.equal(bumpingMario.vy, 0);

    // Animação de quique sobe e retorna a 0 após alguns frames
    coinBlock.update();
    assert.ok(coinBlock.bumpOffset < 0);
    for (let i = 0; i < 15; i++) {
      coinBlock.update();
    }
    assert.equal(coinBlock.bumpOffset, 0);
    assert.equal(coinBlock.bumpVel, 0);

    // Segunda batida no bloco já vazio não dispensa novamente
    bumpingMario.y = 158;
    bumpingMario.vy = -4.5;
    const emptyHit = coinBlock.checkPlayerBumpFromBelow(bumpingMario);
    assert.equal(emptyHit.bumped, false);
    assert.equal(emptyHit.spent, true);
    assert.equal(emptyHit.spawnedItem, 'none');

    // 2. Bloco multi-moedas mantém '?' até a última moeda
    const multiCoinBlock = new QuestionBlock(6, 9, 'coin', { coinsLeft: 3 });
    const r1 = multiCoinBlock.bumpFromBelow(new Player(96, 160, 'small'));
    assert.equal(r1.bumped, true);
    assert.equal(r1.spawnedItem, 'coin');
    assert.equal(r1.depletedToEmpty, false);
    assert.equal(multiCoinBlock.coinsLeft, 2);
    assert.equal(multiCoinBlock.type, 'question');
    for (let i = 0; i < 15; i++) multiCoinBlock.update();

    const r2 = multiCoinBlock.bumpFromBelow();
    assert.equal(r2.depletedToEmpty, false);
    assert.equal(multiCoinBlock.coinsLeft, 1);
    for (let i = 0; i < 15; i++) multiCoinBlock.update();

    const r3 = multiCoinBlock.bumpFromBelow();
    assert.equal(r3.depletedToEmpty, true);
    assert.equal(multiCoinBlock.type, 'question_empty');
    assert.equal(multiCoinBlock.isEmpty(), true);

    // 3. Bloco de power-up progressivo ('mushroom'): Small -> 'mushroom', Super+ -> 'fireflower'
    const smallPowerBlock = new QuestionBlock(7, 9, 'mushroom');
    const smallMario = new Player(112, 158, 'small');
    smallMario.vy = -4;
    const smallRes = smallPowerBlock.checkPlayerBumpFromBelow(smallMario);
    assert.equal(smallRes.bumped, true);
    assert.equal(smallRes.spawnedItem, 'mushroom');
    assert.equal(smallRes.coinAwarded, false);
    assert.equal(smallPowerBlock.type, 'question_empty');

    const superPowerBlock = new QuestionBlock(8, 9, 'mushroom');
    const superMario = new Player(128, 158, 'super');
    superMario.vy = -4;
    const superRes = superPowerBlock.checkPlayerBumpFromBelow(superMario);
    assert.equal(superRes.bumped, true);
    assert.equal(superRes.spawnedItem, 'fireflower');
    assert.equal(superPowerBlock.type, 'question_empty');

    // Itens explícitos (Leaf, Feather, Star, 1UP)
    assert.equal(new QuestionBlock(9, 9, 'leaf').bumpFromBelow(superMario).spawnedItem, 'leaf');
    assert.equal(new QuestionBlock(10, 9, 'feather').bumpFromBelow(superMario).spawnedItem, 'feather');
    assert.equal(new QuestionBlock(11, 9, 'star').bumpFromBelow(smallMario).spawnedItem, 'star');
    assert.equal(new QuestionBlock(12, 9, '1up').bumpFromBelow(smallMario).spawnedItem, '1up');

    // 4. Bloco oculto (invisible) é revelado ao ser batido por baixo
    const hiddenBlock = new QuestionBlock(13, 9, '1up', { invisible: true });
    assert.equal(hiddenBlock.isSolid(), false);
    const hiddenMario = new Player(13 * 16, 158, 'small');
    hiddenMario.vy = -4.2;
    const hiddenRes = hiddenBlock.checkPlayerBumpFromBelow(hiddenMario);
    assert.equal(hiddenRes.bumped, true);
    assert.equal(hiddenRes.revealedInvisible, true);
    assert.equal(hiddenRes.spawnedItem, '1up');
    assert.equal(hiddenBlock.invisible, false);
    assert.equal(hiddenBlock.isSolid(), true);

    // 5. Integração com TileMap e renderização headless sem erro
    const level = createBlankCustomLevel('QBLOCK TEST', 'overworld', 20);
    level.tiles[9][4] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
    const map = new TileMap(level);
    const qBlocks = map.getQuestionBlocks();
    assert.equal(qBlocks.length, 1);
    assert.equal(qBlocks[0].tileX, 4);
    assert.equal(qBlocks[0].content, 'mushroom');
    const resMap = qBlocks[0].bumpFromBelow(smallMario);
    assert.equal(resMap.spawnedItem, 'mushroom');
    qBlocks[0].syncToTile(level.tiles[9][4]!);
    assert.equal(level.tiles[9][4]!.type, 'question_empty');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    coinBlock.render(ctx, 0);
    multiCoinBlock.render(ctx, 0);
    qBlocks[0].render(ctx, 0);
  });

  await test('Classe KoopaTroopa (GameCanvas.tsx): patrulha, quina do Red Koopa, casco deslizante, ricochete e despertar', () => {
    const level = createBlankCustomLevel('KOOPA TEST', 'overworld', 30);
    // Chão em row 13 (y = 208) com buraco em tx=16..17
    for (let tx = 0; tx < 30; tx++) {
      if (tx === 16 || tx === 17) {
        level.tiles[13][tx] = null;
        if (level.tiles[14]) level.tiles[14][tx] = null;
        continue;
      }
      level.tiles[13][tx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Cano em tx=10..11, ty=11..12 (x=160..192, y=176..208)
    level.tiles[11][10] = { type: 'pipe_top_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[11][11] = { type: 'pipe_top_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][10] = { type: 'pipe_body_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][11] = { type: 'pipe_body_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
    // Parede à esquerda em tx=2, ty=11..12
    level.tiles[11][2] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][2] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

    const map = new TileMap(level);

    // 1. Koopa Verde patrulha horizontal e reverte ao bater no cano
    const green = new KoopaTroopa(138, 184, 'koopa', KoopaTroopa.GREEN_SPEED, 1);
    let sawPipeTurn = false;
    for (let i = 0; i < 20; i++) {
      const res = green.update(map);
      if (res.hitPipe) {
        sawPipeTurn = true;
        assert.equal(res.turnedAround, true);
        assert.ok(green.vx < 0);
        assert.equal(green.facing, 'left');
        break;
      }
    }
    assert.equal(sawPipeTurn, true);
    assert.equal(green.grounded, true);
    assert.equal(green.y, 13 * 16 - KoopaTroopa.WALK_HEIGHT);

    // 2. Koopa Vermelho detecta quina de plataforma e retorna sem cair no buraco
    const red = new KoopaTroopa(14 * 16, 184, 'red_koopa', KoopaTroopa.RED_SPEED, 2);
    let sawLedgeTurn = false;
    for (let i = 0; i < 30; i++) {
      const res = red.update(map);
      if (res.turnedAtLedge) {
        sawLedgeTurn = true;
        assert.ok(red.vx < 0);
        assert.equal(red.facing, 'left');
        break;
      }
    }
    assert.equal(sawLedgeTurn, true);

    // 3. Stomp de cima recolhe Koopa no casco ('shell_idle', altura 16) e aplica quique no Mario
    const stompedKoopa = new KoopaTroopa(90, 184, 'koopa', -KoopaTroopa.GREEN_SPEED, 3);
    const stompMario = new Player(90, 174, 'small');
    stompMario.vy = 4.0;
    assert.equal(stompedKoopa.checkPlayerCollision(stompMario), 'entered_shell');
    assert.equal(stompedKoopa.state, 'shell_idle');
    assert.equal(stompedKoopa.height, KoopaTroopa.SHELL_HEIGHT);
    assert.equal(stompedKoopa.y, 192);
    assert.equal(stompedKoopa.vx, 0);
    assert.equal(stompMario.vy, KoopaTroopa.STOMP_BOUNCE_VY);

    // 4. Chute lateral dispara casco deslizante ('shell_moving'), derrota Goomba, ricocheteia no cano e para ao ser pisado
    const kickMario = new Player(78, 192, 'small');
    kickMario.vy = 0;
    assert.equal(stompedKoopa.checkPlayerCollision(kickMario), 'kicked_shell');
    assert.equal(stompedKoopa.state, 'shell_moving');
    assert.equal(stompedKoopa.vx, KoopaTroopa.SHELL_SLIDE_SPEED);

    // Durante a janela de graça logo após o chute, não fere quem chutou
    assert.equal(stompedKoopa.checkPlayerCollision(kickMario), 'none');

    // Casco deslizando derrota Goomba no caminho e ricocheteia no cano
    const victimGoomba = new Goomba(128, 192, -Goomba.DEFAULT_SPEED, 99);
    let defeatedGoomba = false;
    let shellRebounded = false;
    for (let i = 0; i < 25; i++) {
      const res = stompedKoopa.update(map);
      const col = stompedKoopa.checkEnemyCollision(victimGoomba);
      if (col.defeatedOther) defeatedGoomba = true;
      if (res.hitPipe) {
        shellRebounded = true;
        assert.ok(stompedKoopa.vx < 0);
        break;
      }
    }
    assert.equal(defeatedGoomba, true);
    assert.equal(victimGoomba.alive, false);
    assert.equal(victimGoomba.state, 'flipped');
    assert.equal(shellRebounded, true);

    // Pisar no casco em movimento interrompe o deslize ('stopped_shell')
    const stopMario = new Player(stompedKoopa.x, stompedKoopa.y - 11, 'small');
    stopMario.vy = 4.0;
    assert.equal(stompedKoopa.checkPlayerCollision(stopMario), 'stopped_shell');
    assert.equal(stompedKoopa.state, 'shell_idle');
    assert.equal(stompedKoopa.vx, 0);

    // 5. Casco parado desperta ao expirar timer e volta a patrulhar
    stompedKoopa.x = 64;
    stompedKoopa.stateTimer = 2;
    stompedKoopa.update(map);
    const wakeRes = stompedKoopa.update(map, stompedKoopa.x + 32);
    assert.equal(wakeRes.wokeUp, true);
    assert.equal(stompedKoopa.state, 'walk');
    assert.equal(stompedKoopa.height, KoopaTroopa.WALK_HEIGHT);
    assert.ok(stompedKoopa.vx > 0);

    // 6. Sincronização Enemy <-> KoopaTroopa e renderização headless
    const synced = KoopaTroopa.fromEnemy(stompedKoopa.toEnemy());
    assert.equal(synced.type, 'koopa');
    assert.equal(synced.state, 'walk');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    green.render(ctx, 0);
    red.render(ctx, 0);
    synced.enterShell();
    synced.render(ctx, 0);
  });

  await test('Classe PiranhaPlant (GameCanvas.tsx): emergência temporizada em canos verdes, proximidade e colisão', () => {
    const level = createBlankCustomLevel('PIRANHA TEST', 'overworld', 25);
    // Cano verde em tx=10..11, ty=11..12 (topo em y=176)
    level.tiles[11][10] = { type: 'pipe_top_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[11][11] = { type: 'pipe_top_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][10] = { type: 'pipe_body_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[12][11] = { type: 'pipe_body_right', content: 'none', bumpOffset: 0, bumpVel: 0 };

    const map = new TileMap(level);
    const maybePlant = PiranhaPlant.fromPipeTile(map, 10, 1);
    assert.ok(maybePlant !== null, 'PiranhaPlant deve ancorar no topo do cano verde');
    if (!maybePlant) {
      throw new Error('PiranhaPlant deve ancorar no topo do cano verde');
    }
    const plant: PiranhaPlant = maybePlant;
    assert.equal(plant.x, 10 * 16 + 8);
    assert.equal(plant.pipeOriginY, 11 * 16);
    assert.equal(plant.y, 176);
    assert.equal(plant.isExposed(), false);
    assert.equal(plant.getHitbox(), null);

    // 1. Proximidade do Mario impede que a planta escondida saia do cano
    const nearMario = new Player(plant.x - 10, plant.pipeOriginY - 16, 'small');
    for (let i = 0; i < 20; i++) {
      const updateRes = plant.update(nearMario);
      assert.equal(updateRes.blockedByProximity, true);
      assert.equal(plant.y, plant.pipeOriginY);
      assert.equal(plant.isExposed(), false);
    }

    // 2. Com Mario afastado, planta emerge no intervalo temporizado e depois retrai
    const freshPlant = new PiranhaPlant(168, 176, 2);
    const farMario = new Player(40, 192, 'small');
    for (let i = 0; i < 48; i++) {
      freshPlant.update(farMario);
    }
    assert.equal(freshPlant.phase, 'emerging');
    assert.equal(freshPlant.y, 176 - PiranhaPlant.MAX_RISE_HEIGHT);
    assert.equal(freshPlant.isExposed(), true);
    assert.ok(freshPlant.getHitbox() !== null);

    // Continua ciclo até retrair completamente para dentro do cano
    for (let i = 48; i < 120; i++) {
      freshPlant.update(farMario);
    }
    assert.equal(freshPlant.y, freshPlant.pipeOriginY);
    assert.equal(freshPlant.phase, 'hidden');
    assert.equal(freshPlant.isExposed(), false);

    // 3. Enquanto exposta, fere Mario normalmente, rebate Spin Jump e é derrotada por Starman
    const exposedPlant = new PiranhaPlant(168, 176, 3);
    exposedPlant.y = 152; // totalmente exposta

    const stompAttemptMario = new Player(164, 144, 'small');
    stompAttemptMario.vy = 2.0;
    assert.equal(exposedPlant.checkPlayerCollision(stompAttemptMario), 'hurt_player');
    assert.equal(exposedPlant.alive, true);

    const spinMario = new Player(164, 144, 'small');
    spinMario.vy = 2.0;
    spinMario.isSpinJumping = true;
    assert.equal(exposedPlant.checkPlayerCollision(spinMario), 'spin_bounce');
    assert.equal(spinMario.vy, Goomba.SPIN_STOMP_BOUNCE_VY);
    assert.equal(exposedPlant.alive, true);

    const starMario = new Player(164, 144, 'small');
    starMario.starTimer = 120;
    assert.equal(exposedPlant.checkPlayerCollision(starMario), 'star_defeat');
    assert.equal(exposedPlant.alive, false);
    assert.equal(exposedPlant.state, 'flipped');

    // 4. Sincronização Enemy <-> PiranhaPlant e renderização headless sem erro
    const synced = PiranhaPlant.fromEnemy(freshPlant.toEnemy());
    assert.equal(synced.type, 'piranha');
    assert.equal(synced.pipeOriginY, 176);
    synced.y = 156;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    synced.render(ctx, 0);
    exposedPlant.render(ctx, 0);
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
    assert.ok(
      editorSrc.includes(
        '}, [isOpen, currentLevel, cellSize, showGrid, showScreenGuides, showSpritesLayer, showExitsOverlay, atlas]);'
      )
    );
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

  await test('R1.19.1CU.5: Pulo Carpado (Spin Jump) em tecla dedicada quica em Boos/espinhos e desmonta do Yoshi', () => {
    // 1. Mapeamento dedicado em smartTv.ts (KeyC e KeyQ -> spinJump, sem disparar jump/run)
    const keyC = resolveTvRemoteAction({ code: 'KeyC', key: 'c', keyCode: 67 }, { smartTvMode: false });
    const keyQ = resolveTvRemoteAction({ code: 'KeyQ', key: 'q', keyCode: 81 }, { smartTvMode: false });
    assert.ok(keyC.actions.includes('spinJump'));
    assert.equal(keyC.actions.includes('jump'), false);
    assert.equal(keyC.actions.includes('run'), false);
    assert.ok(keyQ.actions.includes('spinJump'));

    // 2. Pulo Carpado no chão ativa isSpinJumping, gira no ar, renderiza em múltiplos power-ups e reseta ao pousar
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.items = [];
    stepEngine(engine, 10);
    assert.equal(engine.marioGrounded, true);
    assert.equal(engine.isSpinJumping, false);

    engine.controls.spinJump = true;
    stepEngine(engine, 2);
    assert.equal(engine.isSpinJumping, true);
    assert.equal(engine.marioGrounded, false);
    assert.ok(engine.marioVy < 0);
    stepEngine(engine, 5);
    assert.ok(engine.spinJumpTimer > 0);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    for (const power of ['small', 'super', 'fire', 'tanooki', 'femboy', 'cape'] as const) {
      engine.marioPower = power;
      engine.render(ctx);
    }

    engine.controls.spinJump = false;
    for (let i = 0; i < 120 && !engine.marioGrounded; i++) {
      engine.update(16.67);
    }
    assert.equal(engine.marioGrounded, true);
    assert.equal(engine.isSpinJumping, false);

    // 3. Sair do Yoshi com a tecla de Pulo Carpado (tanto no chão quanto no ar)
    for (const startGrounded of [true, false]) {
      const yoshiEngine = createFreshEngine();
      yoshiEngine.enemies = [];
      yoshiEngine.items = [];
      stepEngine(yoshiEngine, 10);
      yoshiEngine.marioOnYoshi = true;
      yoshiEngine.yoshis = [];
      if (!startGrounded) {
        yoshiEngine.marioGrounded = false;
        yoshiEngine.marioY -= 24;
        yoshiEngine.marioVy = 0.5;
      }

      yoshiEngine.controls.spinJump = true;
      stepEngine(yoshiEngine, 2);
      assert.equal(yoshiEngine.marioOnYoshi, false, `Deve desmontar do Yoshi (grounded=${startGrounded})`);
      assert.ok(yoshiEngine.yoshis.length >= 1, 'Yoshi desmontado deve aparecer no cenário');
      assert.equal(yoshiEngine.isSpinJumping, true, 'Desmontar com Pulo Carpado deve entrar em isSpinJumping');
      assert.ok(yoshiEngine.marioVy < 0);
      yoshiEngine.controls.spinJump = false;
    }

    // 4. Lista de inimigos protegidos para quique no Pulo Carpado (fantasmas, espinhosos e futuros espinhos)
    assert.equal(engine.isSpinBounceProtectedEnemy('boo'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('piranha'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('dry_bones'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('bowser'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('spiny'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('spike_top'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('thwomp'), true);
    assert.equal(engine.isSpinBounceProtectedEnemy('goomba'), false);

    // 5. Quicar com Pulo Carpado em Boo, Piranha, Dry Bones e Bowser sem tomar dano
    for (const enemyType of ['boo', 'piranha', 'dry_bones', 'bowser'] as const) {
      const bounceEngine = createFreshEngine();
      bounceEngine.enemies = [];
      bounceEngine.items = [];
      stepEngine(bounceEngine, 10);
      bounceEngine.marioPower = 'super';
      bounceEngine.marioInvulnerableTimer = 0;

      const enemyX = 160;
      const enemyY = 144;
      const enemy = makeEnemy(9800, enemyType, enemyX, enemyY);
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemyType === 'bowser') {
        enemy.width = 28;
        enemy.height = 32;
      } else if (enemyType === 'piranha') {
        enemy.x = enemyX + 8;
        enemy.pipeOriginY = enemyY + 24;
      }
      bounceEngine.enemies.push(enemy);

      bounceEngine.marioX = enemyX + 2;
      bounceEngine.marioY = enemyY - 26;
      bounceEngine.marioVx = 0;
      bounceEngine.marioVy = 2.5;
      bounceEngine.marioGrounded = false;
      bounceEngine.isSpinJumping = true;
      bounceEngine.controls.spinJump = true;

      stepEngine(bounceEngine, 4);
      assert.equal(bounceEngine.marioPower, 'super', `Não deve sofrer dano ao quicar com Pulo Carpado em ${enemyType}`);
      assert.equal(bounceEngine.isSpinJumping, true, `Deve manter Pulo Carpado após quicar em ${enemyType}`);
      assert.ok(bounceEngine.marioVy < 0, `Deve quicar para cima sobre ${enemyType}`);
    }

    // 6. Pulo normal (sem carpado) sobre Boo continua causando dano
    const dmgEngine = createFreshEngine();
    dmgEngine.enemies = [];
    dmgEngine.items = [];
    stepEngine(dmgEngine, 10);
    dmgEngine.marioPower = 'super';
    dmgEngine.marioInvulnerableTimer = 0;
    const booDmg = makeEnemy(9810, 'boo', 160, 144);
    booDmg.vx = 0;
    booDmg.vy = 0;
    dmgEngine.enemies.push(booDmg);
    dmgEngine.marioX = 162;
    dmgEngine.marioY = 118;
    dmgEngine.marioVx = 0;
    dmgEngine.marioVy = 2.5;
    dmgEngine.marioGrounded = false;
    dmgEngine.isSpinJumping = false;
    stepEngine(dmgEngine, 4);
    assert.equal(dmgEngine.marioPower, 'small', 'Pular normalmente sobre Boo sem Pulo Carpado deve causar dano');

    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.1CU.5'));
  });

  await test('R1.19.KH.6: Animação de fim de fase na fechadura segue estilo SMW sem flash claro', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.items = [];
    stepEngine(engine, 5);

    const yGround = 12 * GameEngine.TILE_SIZE;
    const keyObj = engine.spawnCarryableObject('key', engine.marioX + 12, yGround);
    const keyhole = engine.spawnKeyhole(engine.marioX + 64, yGround);
    engine.controls.run = true;
    engine.marioX = keyObj.x;
    engine.marioY = keyObj.y;
    stepEngine(engine, 2);
    assert.equal(engine.heldCarryableId, keyObj.id);

    engine.marioX = keyhole.x - 4;
    engine.marioY = keyhole.y;
    stepEngine(engine, 2);
    assert.equal(keyhole.activated, true);
    assert.equal(engine.keyholeTransitionActive, true);
    assert.ok(engine.keyholeClearTimer > 0);
    assert.ok(engine.keyholeTotalTimer > 0);

    const canvas = document.createElement('canvas');
    canvas.width = GameEngine.NES_WIDTH;
    canvas.height = GameEngine.NES_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    // Espiona chamadas Canvas2D para validar a abertura em fechadura ('evenodd') e o blackout sólido final
    let evenOddCount = 0;
    let blackFullScreenFill = false;
    const origFill = ctx.fill;
    const origFillRect = ctx.fillRect;
    ctx.fill = ((...args: unknown[]) => {
      if (args[0] === 'evenodd') evenOddCount++;
      return (origFill as (...a: unknown[]) => void).apply(ctx, args);
    }) as typeof ctx.fill;
    ctx.fillRect = ((x: number, y: number, w: number, h: number) => {
      if (ctx.fillStyle === '#000000' && x === 0 && y === 0 && w === GameEngine.NES_WIDTH && h === GameEngine.NES_HEIGHT) {
        blackFullScreenFill = true;
      }
      return origFillRect.call(ctx, x, y, w, h);
    }) as typeof ctx.fillRect;

    try {
      // Fase 1 (encaixe da chave) e Fase 2 (abertura em formato de fechadura fechando): usa 'evenodd'
      stepEngine(engine, 16);
      engine.render(ctx);
      assert.equal(engine.keyholeTransitionActive, true);
      assert.ok(evenOddCount >= 1, 'Deve desenhar a máscara de fechadura com fill("evenodd")');

      // Após finishStage (~frame 45), keyholeTransitionActive permanece ativo e smwCastleIrisProgress nunca é usado
      stepEngine(engine, 30);
      assert.equal(engine.isStageClear, true);
      assert.equal(engine.keyholeTransitionActive, true);
      assert.equal(engine.smwCastleIrisProgress, 0);

      // Após fechar completamente (>= frame 78), a tela inteira recebe blackout sólido preto sem flash claro
      stepEngine(engine, 32);
      assert.ok(engine.keyholeTotalTimer >= 78);
      engine.render(ctx);
      assert.equal(blackFullScreenFill, true, 'Deve manter preenchimento sólido preto ao concluir o fechamento');
    } finally {
      ctx.fill = origFill;
      ctx.fillRect = origFillRect;
    }

    // Concluir / avançar limpa os flags de transição da fechadura
    engine.advanceToNextLevel();
    assert.equal(engine.keyholeTransitionActive, false);
    assert.equal(engine.keyholeTotalTimer, 0);
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.KH.6'));
  });

  await test('Screen shake ao atingir bloco de tijolo (pequeno, moeda e quebra) e quando boss pisa no chão', () => {
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.items = [];
    stepEngine(engine, 5);

    const tx = 6;
    const ty = 10;
    engine.level.tiles[ty][tx] = {
      type: 'brick',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };

    // 1. Small Mario bate no tijolo por baixo -> dispara screen shake
    engine.marioPower = 'small';
    engine.marioX = tx * GameEngine.TILE_SIZE + 2;
    engine.marioY = (ty + 1) * GameEngine.TILE_SIZE + 1;
    engine.marioVx = 0;
    engine.marioVy = -5;
    engine.marioGrounded = false;
    engine.screenShakeTimer = 0;
    engine.screenShakeIntensity = 0;
    engine.update(16.67);
    assert.ok(engine.screenShakeTimer > 0, 'Bater no tijolo pequeno deve ativar screen shake');
    assert.ok(engine.screenShakeIntensity >= 2.0);
    assert.ok(engine.level.tiles[ty][tx], 'Small Mario não deve quebrar o tijolo');

    // Aguarda bump do bloco zerar e shake decair
    stepEngine(engine, 16);
    assert.equal(engine.screenShakeTimer, 0);

    // 2. Tijolo com moeda -> dispara screen shake ao ser atingido
    engine.level.tiles[ty][tx] = {
      type: 'brick',
      content: 'none',
      coinsLeft: 2,
      bumpOffset: 0,
      bumpVel: 0,
    };
    engine.marioX = tx * GameEngine.TILE_SIZE + 2;
    engine.marioY = (ty + 1) * GameEngine.TILE_SIZE + 1;
    engine.marioVy = -5;
    engine.marioGrounded = false;
    engine.screenShakeTimer = 0;
    engine.screenShakeIntensity = 0;
    engine.update(16.67);
    assert.ok(engine.screenShakeTimer > 0, 'Tijolo com moeda deve ativar screen shake');
    stepEngine(engine, 16);

    // 3. Super Mario quebra tijolo -> dispara screen shake mais forte
    engine.level.tiles[ty][tx] = {
      type: 'brick',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };
    engine.marioPower = 'super';
    engine.marioX = tx * GameEngine.TILE_SIZE + 2;
    engine.marioY = (ty + 1) * GameEngine.TILE_SIZE + 1;
    engine.marioVy = -5;
    engine.marioGrounded = false;
    engine.screenShakeTimer = 0;
    engine.screenShakeIntensity = 0;
    engine.update(16.67);
    assert.equal(engine.level.tiles[ty][tx], null, 'Super Mario deve quebrar o tijolo');
    assert.ok(engine.screenShakeTimer > 0);
    assert.ok(engine.screenShakeIntensity >= 3.0);

    // 4. Boss (Bowser / Johannnnes89): parado no chão não treme a tela, mas ao cair de um salto (stomp) treme
    const bossEngine = createFreshEngine();
    bossEngine.items = [];
    stepEngine(bossEngine, 5);
    const bossX = 160;
    const floorY = 13 * GameEngine.TILE_SIZE;
    const boss = makeEnemy(9950, 'bowser', bossX, floorY - 32);
    boss.originX = bossX;
    boss.width = 28;
    boss.height = 32;
    boss.vx = 0;
    boss.vy = 0;
    boss.fireTimer = 9999;
    boss.stateTimer = 1;
    bossEngine.enemies = [boss];
    bossEngine.screenShakeTimer = 0;
    bossEngine.screenShakeIntensity = 0;

    // Parado no chão -> sem screen shake espúrio
    bossEngine.update(16.67);
    assert.equal(bossEngine.screenShakeTimer, 0, 'Boss parado no chão não deve gerar screen shake');

    // Boss caindo de um salto sobre o chão -> impacto gera screen shake forte
    boss.y = floorY - 32 - 3;
    boss.vy = 4.5;
    bossEngine.update(16.67);
    assert.equal(boss.vy, 0);
    assert.ok(bossEngine.screenShakeTimer > 0, 'Pouso/pisão do boss no chão deve ativar screen shake');
    assert.ok(bossEngine.screenShakeIntensity >= 3.5);
  });

  await test('R1.19.BS.6: Finalização suave no Bonus Stage (pouso no chão, timeout, íris, mapa SMW e espera multiplayer)', () => {
    // 1. Bater o 9º bloco no ar faz Mario pousar suavemente, anima íris-out e bloqueia cliques extras
    const engine = createFreshEngine();
    engine.enemies = [];
    engine.startSmwBonusStage();
    assert.equal(engine.isBonusStageActive, true);

    for (let i = 0; i < 8; i++) {
      const b = engine.bonusStageBlocks[i];
      b.faceIndex = 0;
      assert.equal(engine.resolveBonusStageBlock(b.tx, b.ty), true);
    }

    // Posiciona Mario no ar longe do chão antes do 9º bloco (sobre área aberta sem bloco abaixo)
    const lastBlock = engine.bonusStageBlocks[8];
    lastBlock.faceIndex = 0;
    engine.marioX = 24;
    engine.marioY = 110;
    engine.marioVy = -2.0;
    engine.marioGrounded = false;
    assert.equal(engine.resolveBonusStageBlock(lastBlock.tx, lastBlock.ty), true);
    assert.ok(engine.bonusStageFinishDelay > 0);

    // Tentativa tardia de resolver bloco durante bonusStageFinishDelay deve ser ignorada
    assert.equal(engine.resolveBonusStageBlock(lastBlock.tx, lastBlock.ty), false);

    // Durante o delay, Mario deve cair suavemente até o chão e a íris deve fechar nos frames finais
    stepEngine(engine, 40);
    assert.equal(engine.isBonusStageActive, true);
    assert.equal(engine.marioGrounded, true, 'Mario deve pousar durante a finalização do Bonus Stage');
    assert.equal(engine.marioState, 'idle');

    // Render durante finalização com íris não gera erros
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    stepEngine(engine, 30);
    assert.ok(engine.bonusStageIrisProgress > 0, 'Íris circular deve fechar ao fim do Bonus Stage');
    engine.render(ctx);

    // Concluir restante do delay avança para 1-2 e zera estado do Bonus Stage
    stepEngine(engine, engine.bonusStageFinishDelay + 2);
    assert.equal(engine.isBonusStageActive, false);
    assert.equal(engine.bonusStageIrisProgress, 0);
    assert.equal(engine.level.id, 'world-1-2');

    // 2. Timeout do Bonus Stage inicia sequência de finalização em vez de cortar abruptamente
    const timeoutEngine = createFreshEngine();
    timeoutEngine.enemies = [];
    timeoutEngine.startSmwBonusStage();
    timeoutEngine.bonusStageTimeFrames = 2;
    stepEngine(timeoutEngine, 3);
    assert.equal(timeoutEngine.isBonusStageActive, true, 'Timeout deve entrar no delay de finalização antes de sair');
    assert.ok(timeoutEngine.bonusStageFinishDelay > 0);
    stepEngine(timeoutEngine, timeoutEngine.bonusStageFinishDelay + 2);
    assert.equal(timeoutEngine.isBonusStageActive, false);
    assert.equal(timeoutEngine.level.id, 'world-1-2');

    // 3. No modo Mapa SMW, concluir Bonus Stage dispara onSmwStageCompleted e restartGame dentro do Bonus reinicia a fase SMW
    const smwEngine = createFreshEngine();
    smwEngine.startSmwStage(createSmwWikiWorldStage('wiki-1-overworld'), true);
    smwEngine.intermissionTimer = 0;
    smwEngine.startSmwBonusStage();
    smwEngine.restartGame();
    assert.equal(smwEngine.isBonusStageActive, false);
    assert.equal(smwEngine.gameMode, 'smw_world_map');
    assert.equal(smwEngine.level.smwNodeId, 'wiki-1-overworld');

    let completedNode: string | null = null;
    smwEngine.intermissionTimer = 0;
    smwEngine.onSmwStageCompleted = (nodeId) => {
      completedNode = nodeId;
    };
    smwEngine.startSmwBonusStage();
    smwEngine.bonusStageTimeFrames = 1;
    stepEngine(smwEngine, 2);
    stepEngine(smwEngine, smwEngine.bonusStageFinishDelay + 2);
    assert.equal(completedNode, 'wiki-1-overworld');
    assert.equal(smwEngine.isBonusStageActive, false);
    assert.equal(smwEngine.bonusStageIrisProgress, 0);

    // 4. Multiplayer: se colega ainda está jogando a fase, entra em espera segura com blackout e isStageClear=true
    const mpEngine = createFreshEngine();
    mpEngine.isMultiplayerConnected = true;
    mpEngine.isMultiplayerFirebase = true;
    mpEngine.isMultiplayerHost = true;
    mpEngine.remotePlayers.set('p2', {
      id: 'p2',
      name: 'Luigi',
      character: 'mario',
      x: 120,
      y: 176,
      vx: 0,
      vy: 0,
      power: 'small',
      state: 'running',
      facing: 'right',
      animFrame: 0,
      score: 0,
      coins: 0,
      lives: 3,
      levelId: 'world-1-1',
      stageCleared: false,
      lastUpdated: Date.now(),
    });
    mpEngine.startSmwBonusStage();
    mpEngine.finishSmwBonusStage();
    assert.equal(mpEngine.isBonusStageActive, false);
    assert.equal(mpEngine.isStageClear, true);
    assert.equal(mpEngine.marioState, 'castle_entered');
    assert.equal(mpEngine.waitingForPlayersFinish, true);
    assert.equal(mpEngine.bonusStageIrisProgress, 1);

    // Colega conclui a fase -> countdown avança e muda para world-1-2 limpando o blackout
    mpEngine.remotePlayers.get('p2')!.stageCleared = true;
    stepEngine(mpEngine, 120);
    assert.equal(mpEngine.level.id, 'world-1-2');
    assert.equal(mpEngine.waitingForPlayersFinish, false);
    assert.equal(mpEngine.bonusStageIrisProgress, 0);
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.BS.6'));
  });

  await test('R1.19.BM.6: Música de Bonus Stage aplicada no Bonus Stage e nos Palácios de Botão com fundo de fase bônus', () => {
    const engine = createFreshEngine();

    // 1. Bonus Stage ativa trilha 'bonus' e fundo '#0c1230' com useBonusBackdrop
    engine.startSmwBonusStage();
    assert.equal(SoundEngine.get().getStatus().currentTrack, 'bonus');
    assert.equal(engine.level.bgColor, '#0c1230');
    assert.equal(engine.level.useBonusBackdrop, true);

    // 2. Todos os Palácios de Botão (Amarelo, Verde, Vermelho, Rosa, Azul) usam música 'bonus' e fundo da sala bônus
    const palaceIds = [
      'wiki-switch-yellow',
      'wiki-switch-green',
      'wiki-switch-red',
      'wiki-switch-pink',
      'wiki-switch-blue',
    ];
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;

    for (const palaceId of palaceIds) {
      const palaceEngine = createFreshEngine();
      const palaceStage = createSmwWikiWorldStage(palaceId);
      palaceEngine.startSmwStage(palaceStage, true);
      palaceEngine.intermissionTimer = 0;

      assert.equal(palaceEngine.level.musicTrack, 'bonus', `${palaceId} deve definir musicTrack='bonus'`);
      assert.equal(palaceEngine.level.useBonusBackdrop, true, `${palaceId} deve usar useBonusBackdrop=true`);
      assert.equal(palaceEngine.level.bgColor, '#0c1230', `${palaceId} deve usar cor de fundo #0c1230 da fase bônus`);
      assert.equal(SoundEngine.get().getStatus().currentTrack, 'bonus', `${palaceId} deve tocar trilha 'bonus'`);

      // Renderizar o Palácio garante uso do renderBonusBackdrop sem erros
      palaceEngine.render(ctx);

      // Após Starman expirar no Palácio, a música deve voltar para 'bonus' (e não underground)
      palaceEngine.marioStarTimer = 1;
      palaceEngine.update(16.67);
      assert.equal(SoundEngine.get().getStatus().currentTrack, 'bonus', `${palaceId} deve restaurar trilha 'bonus' após Starman`);
    }

    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.BM.6'));
  });

  await test('R1.19.ML.6: Bloqueio de troca de modo e Editor de Fases após iniciar partida (com exceções para Dev e Editor)', () => {
    // 1. Antes de iniciar (!hasStarted), é permitido escolher modo e abrir Editor de Fases
    const beforeStart = {
      hasStarted: false,
      isDeveloperMode: false,
      isUsingEditor: false,
    };
    assert.equal(isModeAndEditorLocked(beforeStart), false);
    assert.equal(canSwitchGameMode(beforeStart), true);
    assert.equal(canOpenLevelEditor(beforeStart), true);
    assert.equal(canExitToMainMenu(beforeStart), true);

    // 2. Após iniciar partida (Normal, World ou 7 Fases) sem Modo Dev e sem Editor, troca de modo e Editor ficam bloqueados
    const activeMatch = {
      hasStarted: true,
      isDeveloperMode: false,
      isUsingEditor: false,
    };
    assert.equal(isModeAndEditorLocked(activeMatch), true);
    assert.equal(canSwitchGameMode(activeMatch), false);
    assert.equal(canOpenLevelEditor(activeMatch), false);
    assert.equal(canExitToMainMenu(activeMatch), false);

    // 3. Exceção: Modo Desenvolvedor ativo libera troca de modo, retorno ao menu e Editor de Fases
    const devMatch = {
      hasStarted: true,
      isDeveloperMode: true,
      isUsingEditor: false,
    };
    assert.equal(isModeAndEditorLocked(devMatch), false);
    assert.equal(canSwitchGameMode(devMatch), true);
    assert.equal(canOpenLevelEditor(devMatch), true);
    assert.equal(canExitToMainMenu(devMatch), true);

    // 4. Exceção: Usuário utilizando/testando o Editor de Fases mantém acesso ao Editor e troca de modo
    const editorMatch = {
      hasStarted: true,
      isDeveloperMode: false,
      isUsingEditor: true,
    };
    assert.equal(isModeAndEditorLocked(editorMatch), false);
    assert.equal(canSwitchGameMode(editorMatch), true);
    assert.equal(canOpenLevelEditor(editorMatch), true);
    assert.equal(canExitToMainMenu(editorMatch), true);

    // 5. Após vitória na campanha 7 Mundos, botão Menu Inicial é liberado na tela de vitória sem liberar troca no Pause/Editor
    assert.equal(
      canExitToMainMenu({
        hasStarted: true,
        isDeveloperMode: false,
        isUsingEditor: false,
        isCampaignVictory: true,
      }),
      true
    );

    // 6. Garantir integração nos componentes UI (GameCanvas, SettingsModal, SmwOverworldMap) e UpdatesModal
    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    const settingsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SettingsModal.tsx'), 'utf8');
    const mapSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SmwOverworldMap.tsx'), 'utf8');

    assert.ok(canvasSrc.includes('canOpenLevelEditor(getModePolicyInput())'));
    assert.ok(canvasSrc.includes('canSwitchGameMode(getModePolicyInput())'));
    assert.ok(canvasSrc.includes('canExitToMainMenu(getModePolicyInput())'));
    assert.ok(canvasSrc.includes('isModeAndEditorLocked={isModeAndEditorLocked}'));
    assert.ok(canvasSrc.includes('isReturnToMenuLocked={isModeAndEditorLocked}'));
    assert.ok(settingsSrc.includes('disabled={isModeAndEditorLocked}'));
    assert.ok(mapSrc.includes('disabled={isReturnToMenuLocked}'));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.ML.6'));
  });

  await test('R1.19.SB.6: Botão Select usa Power-Up da carteira e sai apenas de fases já passadas no Modo World', () => {
    // 1. Teclas V e Tab mapeiam para a ação 'select'
    const keyV = resolveTvRemoteAction({ code: 'KeyV', key: 'v' }, { smartTvMode: false });
    assert.equal(keyV.isSelect, true);
    assert.ok(keyV.actions.includes('select'));

    const keyTab = resolveTvRemoteAction({ code: 'Tab', key: 'Tab' }, { smartTvMode: false });
    assert.equal(keyTab.isSelect, true);
    assert.ok(keyTab.actions.includes('select'));

    // 2. Pressionar Select durante o jogo solta o Power-Up armazenado na Carteira (Reserve Box)
    const engine = createFreshEngine();
    engine.enemies = [];
    stepEngine(engine, 10);
    engine.marioPower = 'fire';
    engine.reservePowerUp = 'feather';
    engine.stats.reservePowerUp = 'feather';

    engine.controls.select = true;
    engine.update(16.67);
    assert.equal(engine.reservePowerUp, null);
    assert.equal(engine.stats.reservePowerUp, null);
    const released = engine.items.find(it => it.fromReserveBox && it.type === 'feather');
    assert.ok(released, 'Select deve soltar o Power-Up armazenado na carteira');

    // Segurar Select não solta repetidamente se outro item entrar até soltar e apertar de novo
    engine.reservePowerUp = 'mushroom';
    engine.stats.reservePowerUp = 'mushroom';
    engine.update(16.67);
    assert.equal(engine.reservePowerUp, 'mushroom');
    engine.controls.select = false;
    engine.update(16.67);
    engine.controls.select = true;
    engine.update(16.67);
    assert.equal(engine.reservePowerUp, null);

    // 3. No Modo World, Select permite sair apenas de fases já passadas (normal ou saída secreta)
    const freshProgress = loadSmwBetaProgress();
    assert.equal(isSmwNodeCleared('wiki-1-overworld', freshProgress), false);
    assert.equal(
      canExitSmwStageWithSelect({
        isSmwModeActive: true,
        activeNodeId: 'wiki-1-overworld',
        progress: freshProgress,
      }),
      false
    );

    const normalCleared: SmwBetaProgress = {
      ...freshProgress,
      clearedNodeIds: ['wiki-1-overworld'],
    };
    assert.equal(isSmwNodeCleared('wiki-1-overworld', normalCleared), true);
    assert.equal(
      canExitSmwStageWithSelect({
        isSmwModeActive: true,
        activeNodeId: 'wiki-1-overworld',
        progress: normalCleared,
      }),
      true
    );
    assert.equal(
      canExitSmwStageWithSelect({
        isSmwModeActive: true,
        activeNodeId: 'wiki-2-caverna',
        progress: normalCleared,
      }),
      false
    );
    assert.equal(
      canExitSmwStageWithSelect({
        isSmwModeActive: false,
        activeNodeId: 'wiki-1-overworld',
        progress: normalCleared,
      }),
      false
    );

    const secretCleared: SmwBetaProgress = {
      ...freshProgress,
      secretClearedNodeIds: ['wiki-1-overworld'],
    };
    assert.equal(
      canExitSmwStageWithSelect({
        isSmwModeActive: true,
        activeNodeId: 'wiki-1-overworld',
        progress: secretCleared,
      }),
      true
    );

    // 4. Verificação de UI nos componentes (TouchControls, GameCanvas e UpdatesModal)
    const touchSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TouchControls.tsx'), 'utf8');
    const canvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    assert.ok(touchSrc.includes('aria-label="Botão Select"'));
    assert.ok(touchSrc.includes('onSelectAction'));
    assert.ok(canvasSrc.includes('handleSelectAction'));
    assert.ok(canvasSrc.includes('canExitSmwStageWithSelect'));
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.SB.6'));
  });

  await test('Comercial pré-jogo WazzimaGiygg (WikiMaker): 15 segundos de espera e botão Pular comercial', () => {
    assert.equal(COMMERCIAL_SKIP_DELAY_SECONDS, 15);
    assert.ok(WAZZIMAGIYGG_COMMERCIALS.length >= 1);

    const primary = getPrimaryWazzimaCommercial();
    assert.equal(primary.ecosystem, 'WazzimaGiygg');
    assert.equal(primary.siteUrl, 'https://wikimaker.wazzimagiygg.com/');
    assert.equal(primary.durationSeconds, 15);
    assert.equal(primary.skipDelaySeconds, 15);

    // Antes dos 15s não permite pular; após 15s libera o botão Pular comercial
    assert.equal(canSkipCommercial(0), false);
    assert.equal(canSkipCommercial(14.9), false);
    assert.equal(canSkipCommercial(15), true);
    assert.equal(getCommercialRemainingSeconds(0), 15);
    assert.equal(getCommercialRemainingSeconds(10.2), 5);
    assert.equal(getCommercialRemainingSeconds(15), 0);

    // Cenas do comercial progridem corretamente ao longo dos 15 segundos
    assert.equal(getActiveCommercialScene(primary, 1).id, 'wikimaker-intro');
    assert.equal(getActiveCommercialScene(primary, 6).id, 'wikimaker-editor');
    assert.equal(getActiveCommercialScene(primary, 12).id, 'wikimaker-cta');

    // Verificação de integração na UI do comercial e GameCanvas
    const adOverlaySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/WazzimaCommercialOverlay.tsx'),
      'utf8'
    );
    const canvasSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'),
      'utf8'
    );
    assert.ok(adOverlaySrc.includes('Pular comercial'));
    assert.ok(adOverlaySrc.includes('commercial.siteUrl'));
    assert.ok(canvasSrc.includes('WazzimaCommercialOverlay'));
    assert.ok(canvasSrc.includes('isCommercialOpen'));
  });

  await test('Comercial Dossiê Wikipédia (averdade), áudio de fundo, narração e suspensão do som do jogo', () => {
    assert.ok(WAZZIMAGIYGG_COMMERCIALS.length >= 2);

    const dossier = getDossierWazzimaCommercial();
    assert.equal(dossier.id, 'wazzimagiygg-averdade-02');
    assert.equal(dossier.ecosystem, 'WazzimaGiygg');
    assert.equal(dossier.siteUrl, 'https://wazzimagiygg.com/averdade/');
    assert.equal(dossier.audioTheme, 'investigative');
    assert.equal(dossier.durationSeconds, 15);
    assert.equal(dossier.skipDelaySeconds, 15);
    assert.equal(dossier.scenes.length, 3);

    // Todas as cenas possuem narração falada (spokenText) sincronizada
    for (const scene of dossier.scenes) {
      assert.ok(scene.spokenText.trim().length >= 20);
    }
    assert.equal(getActiveCommercialScene(dossier, 1).id, 'averdade-intro');
    assert.equal(getActiveCommercialScene(dossier, 6).id, 'averdade-evidencias');
    assert.equal(getActiveCommercialScene(dossier, 12).id, 'averdade-cta');

    // Rotação alterna entre WikiMaker e Dossiê A Verdade
    assert.equal(getNextCommercialInRotation(null).id, 'wazzimagiygg-wikimaker-01');
    assert.equal(
      getNextCommercialInRotation('wazzimagiygg-wikimaker-01').id,
      'wazzimagiygg-averdade-02'
    );
    assert.equal(
      getNextCommercialInRotation('wazzimagiygg-averdade-02').id,
      'wazzimagiygg-wikimaker-01'
    );
    assert.equal(getCommercialById('wazzimagiygg-averdade-02').id, 'wazzimagiygg-averdade-02');

    // SoundEngine suspende som e música do jogo durante o comercial e restaura ao encerrar
    const sound = SoundEngine.get();
    sound.setCommercialSuspended(true);
    assert.equal(sound.isCommercialSuspended(), true);
    assert.equal(sound.getStatus().commercialSuspended, true);

    sound.playMusic('overworld');
    assert.equal(sound.isCommercialSuspended(), true);
    assert.equal(sound.getStatus().currentTrack, 'overworld');

    sound.setCommercialSuspended(false);
    assert.equal(sound.isCommercialSuspended(), false);
    assert.equal(sound.getStatus().commercialSuspended, false);
    sound.stopMusic();

    // Verificação de integração na UI: som de fundo, fala de texto e suspensão no GameCanvas
    const adOverlaySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/WazzimaCommercialOverlay.tsx'),
      'utf8'
    );
    const canvasSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'),
      'utf8'
    );
    assert.ok(adOverlaySrc.includes('SpeechSynthesisUtterance'));
    assert.ok(adOverlaySrc.includes('playUnderscoreSlice'));
    assert.ok(adOverlaySrc.includes('Som do jogo suspenso durante o comercial'));
    assert.ok(canvasSrc.includes('setCommercialSuspended(isCommercialOpen)'));
    assert.ok(canvasSrc.includes('getNextCommercialInRotation'));
  });

  await test('Trilha sonora pós-comercial, Game Over sem loop de som e opção Tela Inicial no Game Over', () => {
    const sound = SoundEngine.get();
    sound.setCommercialSuspended(false);
    sound.stopMusic();

    // 1. Antes de iniciar partida (após comercial), trilha de fase não dispara na tela inicial
    const menuEngine = new GameEngine();
    assert.equal(menuEngine.isGameStarted, false);
    assert.equal(sound.getStatus().currentTrack, 'none');

    // Ao iniciar partida, trilha da fase inicia normalmente
    menuEngine.restartGame();
    assert.equal(menuEngine.isGameStarted, true);
    assert.equal(sound.getStatus().currentTrack, 'overworld');

    // 2. No Game Over, playGameOver() dispara apenas 1 vez (nunca em loop 60fps)
    let gameOverCalls = 0;
    const origPlayGameOver = sound.playGameOver.bind(sound);
    sound.playGameOver = () => {
      gameOverCalls++;
      origPlayGameOver();
    };
    try {
      menuEngine.intermissionTimer = 0;
      menuEngine.stats.lives = 1;
      menuEngine.marioState = 'dead';
      menuEngine.marioDeathTimer = 136;
      stepEngine(menuEngine, 15);
      assert.equal(menuEngine.isGameOver, true);
      assert.equal(sound.getStatus().currentTrack, 'none');
      assert.equal(gameOverCalls, 1, 'playGameOver deve ser chamado exatamente 1 vez ao perder a última vida');
    } finally {
      sound.playGameOver = origPlayGameOver;
      sound.stopMusic();
    }

    // 3. Política permite sair para Tela Inicial durante Game Over mantendo bloqueio durante partida ativa
    assert.equal(
      canExitToMainMenu({
        hasStarted: true,
        isDeveloperMode: false,
        isUsingEditor: false,
        isGameOver: false,
      }),
      false
    );
    assert.equal(
      canExitToMainMenu({
        hasStarted: true,
        isDeveloperMode: false,
        isUsingEditor: false,
        isGameOver: true,
      }),
      true
    );

    const canvasSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'),
      'utf8'
    );
    const gameOverIdx = canvasSrc.indexOf('Solo Game Over Overlay');
    const victoryIdx = canvasSrc.indexOf('Final Campaign Victory Overlay');
    assert.ok(gameOverIdx > 0 && victoryIdx > gameOverIdx);
    const gameOverBlock = canvasSrc.slice(gameOverIdx, victoryIdx);
    assert.ok(gameOverBlock.includes('handleReturnToMainMenu'));
    assert.ok(gameOverBlock.includes('TELA INICIAL'));
  });

  await test('W-1 (wiki-1-overworld) fiel à primeira fase do Super Mario World preservando cano secreto da chave', () => {
    const w1 = createSmwWikiWorldStage('wiki-1-overworld');
    assert.equal(w1.id, 'smw-wiki-1');
    assert.equal(w1.smwNodeId, 'wiki-1-overworld');
    assert.ok(w1.biomeLabel?.includes("YOSHI'S ISLAND"), 'biomeLabel deve referenciar Yoshi\'s Island');

    // Platôs elevados característicos de Yoshi's Island 2
    assert.equal(w1.tiles[11][25]?.type, 'ground');
    assert.equal(w1.tiles[11][50]?.type, 'ground');
    assert.equal(w1.tiles[10][113]?.type, 'ground');

    // Blocos [!] amarelos SMW (>= 4) e zero caixas de power-up não-SMW
    let exclamCount = 0;
    for (const row of w1.tiles) {
      for (const tile of row) {
        if (tile?.type === 'exclam_yellow') exclamCount++;
      }
    }
    assert.ok(exclamCount >= 4, `Esperado >= 4 blocos [!] amarelos em W-1, obtido ${exclamCount}`);

    // Elenco clássico SMW (Koopa verde, Red Koopa em platôs, Paratroopa e Piranha)
    assert.ok(w1.enemies.some((e) => e.type === 'koopa'));
    assert.ok(w1.enemies.some((e) => e.type === 'red_koopa'));
    assert.ok(w1.enemies.some((e) => e.type === 'paratroopa'));
    assert.ok(w1.enemies.some((e) => e.type === 'piranha'));

    // P-Switch azul, plataforma móvel, checkpoint intermediário, 4 Dragon/W-Coins e sem Yoshi natural
    assert.ok(w1.carryables?.some((c) => c.kind === 'p_switch_blue'));
    assert.ok((w1.floatingPlatforms?.length ?? 0) >= 1);
    assert.ok((w1.checkpoints?.length ?? 0) >= 1);
    assert.equal(w1.wCoins?.length, 4);
    assert.equal(w1.yoshis?.length ?? 0, 0);

    // Cano secreto da caverna da chave preservado exatamente em x=33 e desobstruído acima
    assert.equal(w1.tiles[11][33]?.type, 'pipe_warp_top_left');
    assert.equal(w1.tiles[11][34]?.type, 'pipe_warp_top_right');
    assert.equal(w1.tiles[9][33], null);
    assert.equal(w1.tiles[9][34], null);
    const keyCaveWarp = w1.pipeWarps?.find((pw) => pw.toLevel === 'smw-wiki-1-secret');
    assert.ok(keyCaveWarp, 'Cano secreto para smw-wiki-1-secret deve estar presente');
    assert.equal(keyCaveWarp.from.x, 33 * 16);
    assert.equal(keyCaveWarp.from.y, 10 * 16);
    assert.equal(keyCaveWarp.type, 'down');
  });

  await test('Cano exclusivo para entrar na caverna da chave no editor de fases', () => {
    const editorSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'),
      'utf8'
    );
    assert.ok(editorSrc.includes("id: 'pipe_key_cave'"));
    assert.ok(editorSrc.includes("label: 'Cano Caverna Chave'"));
    assert.ok(editorSrc.includes('placeKeyCavePipeInLevel'));
    assert.ok(editorSrc.includes('pruneKeyCavePipeWarps'));

    // 1. Posicionar o cano exclusivo gera tiles de warp + entrada para smw-wiki-1-secret
    const customStage = createBlankCustomLevel('CAVERNA CUSTOM', 'overworld', 60);
    customStage.id = 'custom-keycave-1';
    const placed = placeKeyCavePipeInLevel(customStage, 20, 12, 2);
    assert.equal(placed, true);
    assert.equal(customStage.tiles[11][20]?.type, 'pipe_warp_top_left');
    assert.equal(customStage.tiles[11][21]?.type, 'pipe_warp_top_right');
    assert.equal(customStage.tiles[12][20]?.type, 'pipe_body_left');
    assert.equal(customStage.tiles[12][21]?.type, 'pipe_body_right');
    assert.equal(customStage.pipeWarps?.length, 1);
    assert.equal(customStage.pipeWarps?.[0].toLevel, KEY_CAVE_PIPE_TARGET);
    assert.equal(customStage.pipeWarps?.[0].from.x, 20 * 16);
    assert.equal(customStage.pipeWarps?.[0].from.y, 10 * 16);

    // 2. Exportação e importação preservam o cano exclusivo e seu warp
    const exportedJson = serializeLevelToFileJson(customStage);
    const reimported = parseImportedLevelFile(exportedJson);
    assert.equal(reimported.tiles[11][20]?.type, 'pipe_warp_top_left');
    assert.equal(reimported.pipeWarps?.length, 1);
    assert.equal(reimported.pipeWarps?.[0].toLevel, KEY_CAVE_PIPE_TARGET);

    // 3. Apagar a boca do cano limpa o warp órfão automaticamente
    const erasedDraft = parseImportedLevelFile(exportedJson);
    erasedDraft.tiles[11][20] = null;
    pruneKeyCavePipeWarps(erasedDraft);
    assert.equal(erasedDraft.pipeWarps, undefined);

    // 4. Em partida da fase customizada: entra na caverna da chave e retorna ao cano de origem
    const engine = createFreshEngine();
    engine.playCustomLevel(customStage, false);
    engine.intermissionTimer = 0;
    engine.marioX = 20 * 16 + 8;
    engine.marioY = 11 * 16 - 16;
    engine.marioGrounded = true;
    engine.controls.down = true;
    stepEngine(engine, 3);
    assert.equal(engine.marioState, 'pipe_entering');
    engine.controls.down = false;
    stepEngine(engine, 40);
    assert.equal(engine.level.id, KEY_CAVE_PIPE_TARGET);
    assert.ok(engine.carryables.some(c => c.kind === 'key'));
    assert.ok(engine.keyholes.length >= 1);

    // Retorna pelo cano de saída da caverna para o cano exato da fase customizada
    engine.marioX = 28 * 16 + 8;
    engine.marioY = 9 * 16 - 16;
    engine.marioGrounded = true;
    engine.controls.down = true;
    stepEngine(engine, 40);
    engine.controls.down = false;
    assert.equal(engine.level.id, 'custom-keycave-1');
    assert.equal(engine.level.isCustom, true);
    assert.equal(engine.marioX, 20 * 16 + 8);

    // 5. Em campanha personalizada, destravar a fechadura dentro da caverna avança para a próxima fase
    const secondStage = createBlankCustomLevel('FASE DOIS', 'underground', 60);
    secondStage.id = 'custom-keycave-2';
    const campEngine = createFreshEngine();
    campEngine.startCustomCampaign([customStage, secondStage], false);
    campEngine.intermissionTimer = 0;
    campEngine.marioX = 20 * 16 + 8;
    campEngine.marioY = 11 * 16 - 16;
    campEngine.marioGrounded = true;
    campEngine.controls.down = true;
    stepEngine(campEngine, 40);
    campEngine.controls.down = false;
    assert.equal(campEngine.level.id, KEY_CAVE_PIPE_TARGET);

    campEngine.enemies = [];
    const caveKey = campEngine.carryables.find(c => c.kind === 'key')!;
    const caveKeyhole = campEngine.keyholes[0];
    campEngine.marioX = caveKey.x;
    campEngine.marioY = caveKey.y;
    campEngine.controls.run = true;
    stepEngine(campEngine, 3);
    campEngine.marioX = caveKeyhole.x - 4;
    campEngine.marioY = caveKeyhole.y;
    stepEngine(campEngine, 3);
    assert.equal(caveKeyhole.activated, true);
    stepEngine(campEngine, 50);
    campEngine.stats.time = 0;
    stepEngine(campEngine, 90);
    assert.equal(campEngine.level.id, 'custom-keycave-2');
    assert.equal(campEngine.customCampaignIndex, 1);
  });

  await test('Fases do Modo World em JSON individuais com suporte a edição, exportação e substituição manual', () => {
    assert.equal(WORLD_STAGE_JSON_REGISTRY.length, 11);

    const worldLevelsDir = path.resolve(process.cwd(), 'src/game/worldLevels');
    for (const entry of WORLD_STAGE_JSON_REGISTRY) {
      const jsonPath = path.join(worldLevelsDir, entry.filename);
      assert.ok(fs.existsSync(jsonPath), `Arquivo JSON ausente: ${entry.filename}`);
      const rawText = fs.readFileSync(jsonPath, 'utf8');
      const parsedPayload = JSON.parse(rawText);
      assert.equal(parsedPayload.format, 'smb-custom-level');
      assert.equal(parsedPayload.version, 1);

      const loaded =
        entry.key === 'smw-wiki-1-secret'
          ? createSmwWiki1SecretRoom()
          : createSmwWikiWorldStage(entry.key);
      assert.equal(loaded.isCustom, false);
      assert.equal(loaded.smwNodeId, entry.defaults.smwNodeId);
      assert.equal(getWorldStageFilename(loaded), entry.filename);

      // Round-trip via Editor upload + export mantém filename exato para substituição manual
      const editorImported = parseImportedLevelFile(rawText);
      assert.equal(editorImported.isCustom, true);
      assert.equal(getWorldStageFilename(editorImported), entry.filename);
    }

    // smw-wiki-1-secret preserva o retorno exato para W-1 (536px mesmo tendo largura de 32 tiles)
    const secretRoom = createSmwWiki1SecretRoom();
    assert.equal(secretRoom.width, 32);
    assert.equal(secretRoom.pipeWarps?.[0].toLevel, 'wiki-1-overworld');
    assert.equal(secretRoom.pipeWarps?.[0].toPos.x, 33 * 16 + 8);

    // Simula edição de W-1 no editor, exportação JSON e substituição manual do arquivo
    const w1Raw = fs.readFileSync(path.join(worldLevelsDir, 'wiki-1-overworld.json'), 'utf8');
    const editedW1 = parseImportedLevelFile(w1Raw);
    editedW1.coins.push({ x: 18 * 16, y: 10 * 16 });
    const exportedEditedW1Json = serializeLevelToFileJson(editedW1);
    const w1Entry = WORLD_STAGE_JSON_REGISTRY.find(e => e.key === 'wiki-1-overworld')!;
    const replacedStage = parseWorldStageFromJson(JSON.parse(exportedEditedW1Json), w1Entry.defaults);
    assert.equal(replacedStage.isCustom, false);
    assert.equal(replacedStage.smwNodeId, 'wiki-1-overworld');
    assert.ok(replacedStage.coins.some(c => c.x === 18 * 16 && c.y === 10 * 16));
    assert.equal(replacedStage.wCoins?.length, STAGE_W_COINS_COUNT);
    assert.ok((replacedStage.checkpoints?.length ?? 0) >= 1);

    // Não-World não recebe filename de World Mode
    const blankCustom = createBlankCustomLevel('FASE LIVRE', 'overworld', 60);
    assert.equal(getWorldStageFilename(blankCustom), null);

    // LevelEditorModal expõe as fases do Modo World e usa getWorldStageFilename na exportação
    const editorSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'),
      'utf8'
    );
    assert.ok(editorSrc.includes('WORLD_STAGE_JSON_REGISTRY'));
    assert.ok(editorSrc.includes('getWorldStageFilename'));
    assert.ok(editorSrc.includes('Modo World (JSON)'));
  });

  await test('Sistema de partículas para quebra de tijolos, coleta de itens e derrota de inimigos', () => {
    const engine = createFreshEngine();
    engine.loadLevel(createWorld1_1());
    engine.intermissionTimer = 0;

    // 1. Quebra de tijolo emite brick_piece, debris, impact_ring, star_burst e dust temáticos
    engine.particleSystem.clear();
    engine.particleSystem.emitBrickBreak(80, 144, 'underwater');
    assert.ok(engine.particles.some(p => p.type === 'brick_piece'));
    assert.ok(engine.particles.some(p => p.type === 'debris' && p.color === '#98e0ff'));
    assert.ok(engine.particles.some(p => p.type === 'impact_ring'));
    assert.ok(engine.particles.some(p => p.type === 'star_burst'));
    assert.ok(engine.particles.some(p => p.type === 'dust'));

    // Mario pequeno batendo em tijolo emite poeira de impacto sem quebrar
    engine.particleSystem.clear();
    engine.marioPower = 'small';
    engine.level.tiles[9][10] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    engine.marioX = 10 * 16;
    engine.marioY = 10 * 16;
    engine.marioVy = -4;
    (engine as any).hitBlock(10, 9, engine.level.tiles[9][10]!);
    assert.ok(engine.level.tiles[9][10] !== null);
    assert.ok(engine.particles.some(p => p.type === 'dust'));

    // 2. Coleta de itens (incluindo 1-UP, estrela, cogumelo, pena, laço femboy e W-coin) emite partículas dedicadas
    const itemTypes = ['mushroom', 'fireflower', 'leaf', 'feather', 'femboy', 'star', '1up', 'w_coin', 'coin'] as const;
    for (const itemType of itemTypes) {
      engine.particleSystem.clear();
      engine.spawnItemCollectParticles(100, 120, itemType);
      assert.ok(engine.particles.length >= 4, `Item ${itemType} deve emitir partículas`);
      assert.ok(engine.particles.some(p => p.type === 'impact_ring'));
    }

    // Coleta real de 1-UP via GameEngine agora emite partículas de item
    engine.particleSystem.clear();
    engine.items = [{
      id: 9001,
      type: '1up',
      x: 112,
      y: 192,
      vx: 0,
      vy: 0,
      width: 16,
      height: 16,
      grounded: true,
      collected: false,
      emerging: false,
      emergeY: 192,
    }];
    engine.marioX = 112;
    engine.marioY = 192 - (engine as any).getMarioHeight() + 16;
    stepEngine(engine, 1);
    assert.ok(engine.particles.some(p => p.type === 'impact_ring' && p.color === '#78f858'));
    assert.ok(engine.particles.some(p => p.type === 'star_burst' || p.type === 'coin_glint'));

    // 3. Derrota de inimigos (squash, fire, boss e língua do Yoshi na altura real)
    engine.particleSystem.clear();
    engine.particleSystem.emitEnemyDefeat(120, 176, 'goomba', 'squash');
    assert.ok(engine.particles.some(p => p.type === 'enemy_poof'));
    assert.ok(engine.particles.some(p => p.type === 'debris'));
    assert.ok(engine.particles.some(p => p.type === 'star_burst'));

    engine.particleSystem.clear();
    engine.particleSystem.emitEnemyDefeat(140, 176, 'koopa', 'fire');
    assert.ok(engine.particles.some(p => p.type === 'enemy_poof' && p.color === '#fce078'));

    engine.particleSystem.clear();
    engine.particleSystem.emitEnemyDefeat(200, 150, 'bowser', 'boss');
    assert.ok(engine.particles.filter(p => p.type === 'impact_ring').length >= 2);
    assert.ok(engine.particles.filter(p => p.type === 'debris').length >= 16);

    // Yoshi comendo inimigo deve gerar partículas na posição real do inimigo (não fora da tela)
    engine.particleSystem.clear();
    engine.marioOnYoshi = true;
    engine.marioFacing = 'right';
    engine.yoshiTongueTimer = 7;
    engine.marioX = 100;
    engine.marioY = 176;
    engine.enemies = [{
      id: 9002,
      type: 'goomba',
      x: 120,
      y: 176,
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
    }];
    (engine as any).checkYoshiTongueCollisions();
    assert.equal(engine.enemies[0].alive, false);
    const defeatRing = engine.particles.find(p => p.type === 'impact_ring');
    assert.ok(defeatRing, 'Yoshi comendo inimigo deve emitir impact_ring');
    assert.ok(defeatRing.y < 220, `Partícula não pode nascer fora da tela (y=${defeatRing.y})`);
  });

  await test('R1.19.1KI.7: Fases aquáticas isolam tela da superfície no cano final e editor possui Cano Superfície (Fim)', () => {
    // 1. CameraSystem respeita limites de zona (sub-área aquática vs superfície seca)
    const cam = new CameraSystem();
    const levelPx = 220 * 16;
    const dryX = 165 * 16;
    cam.centerOn(dryX - 24, levelPx, { minX: 0, maxX: dryX });
    assert.ok(cam.x + 256 <= dryX, `Câmera subaquática não pode vazar para superfície seca (cam.x=${cam.x})`);
    cam.centerOn(dryX + 64, levelPx, { minX: dryX, maxX: levelPx });
    assert.ok(cam.x >= dryX, `Câmera na superfície após sair do cano não pode vazar para área aquática (cam.x=${cam.x})`);

    // 2. World 2-2 e Wiki-3 (Fase da Água) isolam a câmera e transitam para superfície com fade e overworld
    for (const waterLevel of [createWorld2_2(), createSmwWikiWorldStage('wiki-3-agua')]) {
      assert.ok(
        waterLevel.dryFinishStartX !== undefined && waterLevel.dryFinishStartX > 0,
        `${waterLevel.id} deve definir dryFinishStartX`
      );
      const dryStart = waterLevel.dryFinishStartX!;
      const surfaceWarp = waterLevel.pipeWarps?.find(pw => isSurfaceExitPipeWarp(waterLevel, pw));
      assert.ok(surfaceWarp, `${waterLevel.id} deve ter pipeWarp de retorno à superfície`);
      assert.ok(surfaceWarp!.toPos.x >= dryStart, `${waterLevel.id} warp deve levar à zona seca >= ${dryStart}`);

      const engine = createFreshEngine();
      engine.loadLevel(waterLevel, false, false, false);
      engine.intermissionTimer = 0;

      // Antes do cano final: câmera travada à esquerda de dryFinishStartX
      engine.marioX = dryStart - 48;
      engine.marioY = 160;
      engine.camera.centerOn(engine.marioX, waterLevel.width * 16, (engine as any).getActiveCameraBounds());
      assert.ok(engine.camera.x + GameEngine.NES_WIDTH <= dryStart);

      // Entra no cano de saída e emerge na outra tela (superfície)
      engine.warpTarget = surfaceWarp!;
      engine.marioX = surfaceWarp!.from.x + 4;
      engine.marioY = surfaceWarp!.from.y + 8;
      (engine as any).finishPipeWarp();
      assert.equal(engine.marioState, 'pipe_exiting');
      assert.equal(engine.pipeExitDir, 'up');
      assert.ok(engine.marioX >= dryStart);
      assert.ok(engine.camera.x >= dryStart);
      assert.ok(engine.warpScreenFadeTimer > 0);
    }

    // 3. Editor possui pincel 'pipe_surface_exit' ('Cano Superfície (Fim)') e sprites horizontais
    const editorSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'),
      'utf8'
    );
    assert.ok(editorSrc.includes("id: 'pipe_surface_exit'"));
    assert.ok(editorSrc.includes("label: 'Cano Superfície (Fim)'"));
    assert.ok(editorSrc.includes('placeSurfaceExitPipeInLevel'));
    assert.ok(editorSrc.includes("pipe_horiz_top"));

    // 4. Colocar Cano Superfície (Fim) em fase aquática em branco cria saída próxima à bandeira, dryFinishStartX e remapeia ID ao importar
    const customWater = createBlankCustomLevel('AGUA EDITOR', 'underwater', 90);
    customWater.id = 'custom-water-test';
    const placed = placeSurfaceExitPipeInLevel(customWater, 58, 12, 2);
    assert.equal(placed, true);
    assert.equal(customWater.tiles[11][58]?.type, 'pipe_warp_top_left');
    assert.equal(customWater.tiles[11][59]?.type, 'pipe_warp_top_right');
    assert.ok(customWater.dryFinishStartX !== undefined && customWater.dryFinishStartX > 59 * 16);
    assert.ok(customWater.flagX < 999999 && customWater.flagX > customWater.dryFinishStartX!);
    assert.equal(customWater.pipeWarps?.length, 1);
    assert.equal(customWater.pipeWarps?.[0].toLevel, customWater.id);
    assert.ok(customWater.pipeWarps![0].toPos.x >= customWater.dryFinishStartX!);
    assert.ok(customWater.pipeWarps![0].toPos.x < customWater.flagX);

    // Exporta e reimporta: novo ID gerado remapeia auto-warp para continuar funcionando
    const exportedJson = serializeLevelToFileJson(customWater);
    const reimported = parseImportedLevelFile(exportedJson);
    assert.notEqual(reimported.id, customWater.id);
    assert.equal(reimported.pipeWarps?.length, 1);
    assert.equal(reimported.pipeWarps?.[0].toLevel, reimported.id);

    // Apagar boca do cano remove warp órfão automaticamente
    reimported.tiles[11][58] = null;
    pruneSurfaceExitPipeWarps(reimported);
    assert.equal(reimported.pipeWarps, undefined);

    // 5. UpdatesModal registra correção R1.19.1KI.7
    assert.ok(GAME_UPDATES.some(u => u.version === 'R1.19.1KI.7' || u.uid === 'R1.19.1KI.7'));
  });

  await test('Suporte Smartphone PWA, ícones e overlay D-Pad touchscreen (Left, Right, Jump, Duck)', () => {
    const touchSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TouchControls.tsx'), 'utf8');
    const gameCanvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
    const viteCfgSrc = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const indexHtmlSrc = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const mainSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');

    // Overlay D-Pad com posicionamento absoluto sobre o canvas e handlers de toque completos
    assert.ok(touchSrc.includes("variant?: 'canvas-overlay' | 'docked'"));
    assert.ok(touchSrc.includes('absolute inset-0'));
    assert.ok(touchSrc.includes('onTouchStart'));
    assert.ok(touchSrc.includes('onTouchMove'));
    assert.ok(touchSrc.includes('onTouchEnd'));
    assert.ok(touchSrc.includes('onTouchCancel'));
    assert.ok(touchSrc.includes('data-direction="left"'));
    assert.ok(touchSrc.includes('data-direction="right"'));
    assert.ok(touchSrc.includes('data-direction="down"'));
    assert.ok(touchSrc.includes("onControlChange('left', nextLeft)"));
    assert.ok(touchSrc.includes("onControlChange('right', nextRight)"));
    assert.ok(touchSrc.includes("onControlChange('down', nextDown)"));
    assert.ok(touchSrc.includes("onControlChange('jump', nextJump)"));
    assert.ok(touchSrc.includes('safe-area-inset'));
    assert.ok(gameCanvasSrc.includes('variant="canvas-overlay"'));
    assert.ok(gameCanvasSrc.includes('min-h-[100dvh]'));

    // PWA configurado com vite-plugin-pwa, registro SW, banner offline, botão de instalação e ícones no /public
    assert.ok(viteCfgSrc.includes('VitePWA('));
    assert.ok(viteCfgSrc.includes('navigateFallbackDenylist'));
    assert.ok(mainSrc.includes('registerSW({immediate: true})'));
    assert.ok(indexHtmlSrc.includes('apple-touch-icon.png'));
    assert.ok(gameCanvasSrc.includes('<PWAInstallButton'));
    assert.ok(gameCanvasSrc.includes('<OfflineIndicator'));

    for (const iconFile of [
      'public/icon.svg',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ]) {
      const fullPath = path.resolve(process.cwd(), iconFile);
      assert.ok(fs.existsSync(fullPath), `Ícone PWA ausente: ${iconFile}`);
      assert.ok(fs.statSync(fullPath).size > 100, `Ícone PWA inválido/vazio: ${iconFile}`);
    }
  });

  await test('Correção R1.19.1BM.7 — Portas exclusivas de Mansões Fantasmas para outros mapas e saída "fora da mansão"', () => {
    // 1. Exclusividade de tema: recusar colocação fora de ghost_house e limpar portas órfãs/proibidas
    for (const nonGhostTheme of ['overworld', 'underground', 'underwater', 'castle'] as const) {
      const lvl = createBlankCustomLevel(`TEMA-${nonGhostTheme}`, nonGhostTheme, 80);
      assert.equal(placeGhostDoorInLevel(lvl, 20, 12, { mode: 'outside_exit' }), false);
      assert.equal(placeGhostDoorInLevel(lvl, 20, 12, { mode: 'map', toLevel: 'secret-vault' }), false);

      // Mesmo que alguém injete tiles/warps de porta manualmente, a sanitização remove tudo fora de ghost_house
      lvl.tiles[11][20] = { type: 'ghost_door_top', content: 'none', bumpOffset: 0, bumpVel: 0 };
      lvl.tiles[12][20] = { type: 'ghost_door_bottom', content: 'none', bumpOffset: 0, bumpVel: 0 };
      lvl.pipeWarps = [
        { from: { x: 20 * 16, y: 11 * 16, width: 16, height: 32 }, toLevel: 'secret-vault', toPos: { x: 48, y: 160 }, type: 'door' },
      ];
      const sanitized = sanitizeCustomLevelEntities(lvl).level;
      assert.equal(isGhostDoorTile(sanitized.tiles[11][20]?.type), false);
      assert.equal(isGhostDoorTile(sanitized.tiles[12][20]?.type), false);
      assert.equal(sanitized.pipeWarps, undefined);

      // Em runtime, GameEngine.checkPipeWarp ignora warps do tipo 'door' se o tema não for ghost_house
      lvl.pipeWarps = [
        { from: { x: 20 * 16, y: 11 * 16, width: 16, height: 32 }, toLevel: 'secret-vault', toPos: { x: 48, y: 160 }, type: 'door' },
      ];
      const guardEngine = createFreshEngine();
      guardEngine.loadLevel(lvl, false, false, false);
      guardEngine.intermissionTimer = 0;
      guardEngine.marioX = 20 * 16;
      guardEngine.marioY = 12 * 16;
      guardEngine.marioGrounded = true;
      guardEngine.controls.up = true;
      guardEngine.update(0.016);
      assert.notEqual(guardEngine.marioState, 'pipe_entering');
    }

    // 2. Mansões Fantasmas oficiais (World 1-3 e W-4 do Modo World) possuem porta de saída para "fora da mansão"
    for (const ghostLevel of [createWorldGhostHouse(), createSmwWikiWorldStage('wiki-4-mansao')]) {
      assert.equal(ghostLevel.theme, 'ghost_house');
      assert.ok(ghostLevel.dryFinishStartX !== undefined && ghostLevel.dryFinishStartX > 160 * 16);
      const exitWarp = ghostLevel.pipeWarps?.find(w => w.type === 'door' && isGhostOutsideExitDoorWarp(ghostLevel, w));
      assert.ok(exitWarp, `Falta warp de saída fora da mansão em ${ghostLevel.id}`);
      assert.ok(exitWarp!.toPos.x >= ghostLevel.dryFinishStartX!);
      assert.ok(exitWarp!.toPos.x < ghostLevel.flagX);

      const engine = createFreshEngine();
      engine.loadLevel(ghostLevel, false, false, false);
      engine.intermissionTimer = 0;
      const dryStart = ghostLevel.dryFinishStartX!;

      // Enquanto estiver dentro da mansão, a câmera não vaza para a área externa
      engine.marioX = dryStart - 80;
      engine.camera.centerOn(engine.marioX, ghostLevel.width * 16, (engine as any).getActiveCameraBounds());
      assert.ok(engine.camera.x + GameEngine.NES_WIDTH <= dryStart);

      // Posicionar na porta e pressionar Cima aciona a transição 'door' para fora da mansão
      engine.marioX = exitWarp!.from.x;
      engine.marioY = exitWarp!.from.y + 16;
      engine.marioGrounded = true;
      engine.controls.up = true;
      engine.controls.down = false;
      engine.update(0.016);
      assert.equal(engine.marioState, 'pipe_entering');
      assert.equal((engine as any).warpDir, 'door');

      engine.controls.up = false;
      for (let i = 0; i < 30 && engine.marioState === 'pipe_entering'; i++) {
        engine.update(0.016);
      }

      assert.notEqual(engine.marioState, 'pipe_entering');
      assert.equal(engine.level.id, ghostLevel.id);
      assert.ok(engine.marioX >= dryStart);
      assert.ok(engine.camera.x >= dryStart);
      assert.ok(engine.warpScreenFadeTimer > 0);
    }

    // 3. Editor: colocar Porta Fora da Mansão (Fim) e Porta Para Outro Mapa, importar/exportar e transição real entre mapas customizados
    const customGhost = createBlankCustomLevel('MANSAO EDITOR', 'ghost_house', 90);
    customGhost.id = 'custom-ghost-src';
    assert.equal(placeGhostDoorInLevel(customGhost, 45, 12, { mode: 'outside_exit' }), true);
    assert.equal(customGhost.tiles[11][45]?.type, 'ghost_door_top');
    assert.equal(customGhost.tiles[12][45]?.type, 'ghost_door_bottom');
    assert.ok(customGhost.dryFinishStartX !== undefined && customGhost.dryFinishStartX > 45 * 16);
    assert.ok(customGhost.flagX > customGhost.dryFinishStartX! && customGhost.flagX < 999999);
    assert.equal(customGhost.pipeWarps?.length, 1);
    assert.equal(customGhost.pipeWarps?.[0].type, 'door');
    assert.equal(customGhost.pipeWarps?.[0].toLevel, customGhost.id);

    // Exportação/importação JSON remapeia ID e mantém auto-warp funcional
    const reimportedGhost = parseImportedLevelFile(serializeLevelToFileJson(customGhost));
    assert.notEqual(reimportedGhost.id, customGhost.id);
    assert.equal(reimportedGhost.pipeWarps?.length, 1);
    assert.equal(reimportedGhost.pipeWarps?.[0].type, 'door');
    assert.equal(reimportedGhost.pipeWarps?.[0].toLevel, reimportedGhost.id);

    // Apagar a porta remove o warp órfão automaticamente
    reimportedGhost.tiles[11][45] = null;
    pruneGhostDoorWarps(reimportedGhost);
    assert.equal(reimportedGhost.pipeWarps, undefined);

    // Porta para acessar outro mapa customizado registrado
    const targetCustomMap = createBlankCustomLevel('MAPA DESTINO', 'overworld', 60);
    targetCustomMap.id = 'custom-target-map';
    const customGhostToMap = createBlankCustomLevel('MANSAO WARP', 'ghost_house', 70);
    customGhostToMap.id = 'custom-ghost-warp';
    assert.equal(placeGhostDoorInLevel(customGhostToMap, 18, 12, { mode: 'map', toLevel: targetCustomMap.id }), true);
    assert.equal(customGhostToMap.pipeWarps?.[0].type, 'door');
    assert.equal(customGhostToMap.pipeWarps?.[0].toLevel, targetCustomMap.id);

    const mapSwapEngine = createFreshEngine();
    mapSwapEngine.registerCustomLevels([customGhostToMap, targetCustomMap]);
    mapSwapEngine.loadLevel(customGhostToMap, false, false, false);
    mapSwapEngine.intermissionTimer = 0;
    mapSwapEngine.marioX = 18 * 16;
    mapSwapEngine.marioY = 12 * 16;
    mapSwapEngine.marioGrounded = true;
    mapSwapEngine.controls.up = true;
    mapSwapEngine.update(0.016);
    assert.equal(mapSwapEngine.marioState, 'pipe_entering');
    mapSwapEngine.controls.up = false;
    for (let i = 0; i < 30 && mapSwapEngine.marioState === 'pipe_entering'; i++) {
      mapSwapEngine.update(0.016);
    }
    assert.notEqual(mapSwapEngine.marioState, 'pipe_entering');
    assert.equal(mapSwapEngine.level.id, targetCustomMap.id);

    // 4. Editor e UpdatesModal contêm os pincéis exclusivos e a nota R1.19.1BM.7
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    assert.ok(editorSrc.includes("id: 'ghost_door_outside'"));
    assert.ok(editorSrc.includes("id: 'ghost_door_map'"));
    assert.ok(editorSrc.includes("requiresTheme: 'ghost_house'"));
    assert.ok(editorSrc.includes('Só Mansão'));
    assert.ok(GAME_UPDATES.some(u => u.version === 'R1.19.1BM.7' || u.uid === 'R1.19.1BM.7'));
  });

  await test('R1.19.1BM.7: Editor de Fases Lunar Magic (Warp Pipes ↓/→, Moedas W, Midway Gate, Colunas +Col/-Col, Presets, Header e Ferramentas)', () => {
    // 1. Canos Warp genéricos (↓ e →) conectam mapas customizados e chegam com segurança em solo ou boca de cano
    const destLevel = createBlankCustomLevel('DESTINO LM', 'underground', 60);
    destLevel.id = 'lm-dest-map';
    const srcLevel = createBlankCustomLevel('ORIGEM LM', 'overworld', 80);
    srcLevel.id = 'lm-src-map';
    srcLevel.musicTrack = 'bonus';
    srcLevel.useBonusBackdrop = true;
    srcLevel.bgColor = '#0c1438';
    srcLevel.enemySpeedMultiplier = 1.4;
    srcLevel.timeLimit = 420;

    assert.equal(
      placeWarpPipeInLevel(srcLevel, 16, 12, { dir: 'down', height: 2, toLevel: destLevel.id, toPos: { x: 48, y: 192 } }),
      true
    );
    assert.equal(srcLevel.tiles[11][16]?.type, 'pipe_warp_top_left');
    assert.equal(srcLevel.tiles[11][17]?.type, 'pipe_warp_top_right');
    assert.equal(
      placeWarpPipeInLevel(srcLevel, 24, 12, { dir: 'right', height: 2, toLevel: 'secret-vault', toPos: { x: 32, y: 176 } }),
      true
    );
    assert.equal(srcLevel.tiles[11][24]?.type, 'pipe_horiz_top');
    assert.equal(srcLevel.tiles[12][24]?.type, 'pipe_horiz_bottom');
    assert.equal(srcLevel.pipeWarps?.length, 2);

    // Transição real no GameEngine pelo Cano Warp ↓ para outro mapa sem boca de cano no destino -> pouso limpo sem ficar preso em pipe_exiting
    const lmEngine = createFreshEngine();
    lmEngine.registerCustomLevels([srcLevel, destLevel]);
    lmEngine.loadLevel(srcLevel, false, false, false);
    lmEngine.intermissionTimer = 0;
    lmEngine.marioX = 16 * 16 + 4;
    lmEngine.marioY = 11 * 16 - 16;
    lmEngine.marioGrounded = true;
    lmEngine.controls.down = true;
    lmEngine.update(0.016);
    assert.equal(lmEngine.marioState, 'pipe_entering');
    lmEngine.controls.down = false;
    for (let i = 0; i < 45 && lmEngine.marioState === 'pipe_entering'; i++) {
      lmEngine.update(0.016);
    }
    assert.equal(lmEngine.level.id, destLevel.id);
    assert.notEqual(lmEngine.marioState, 'pipe_exiting');
    assert.ok(lmEngine.warpScreenFadeTimer > 0);

    // Remover os tiles do cano genérico poda o warp órfão automaticamente
    srcLevel.tiles[11][16] = null;
    srcLevel.tiles[11][24] = null;
    pruneKeyCavePipeWarps(srcLevel);
    assert.equal(srcLevel.pipeWarps, undefined);

    // 2. Moedas W (máximo 4 por fase) e Midway Checkpoint (visible: true + ativação in-game)
    assert.equal(placeWCoinInLevel(srcLevel, 10, 8), true);
    assert.equal(placeWCoinInLevel(srcLevel, 20, 8), true);
    assert.equal(placeWCoinInLevel(srcLevel, 30, 8), true);
    assert.equal(placeWCoinInLevel(srcLevel, 40, 8), true);
    assert.equal(placeWCoinInLevel(srcLevel, 50, 8), false, 'Não deve exceder 4 Moedas W na mesma fase');
    assert.equal(srcLevel.wCoins?.length, 4);

    assert.equal(placeMidwayCheckpointInLevel(srcLevel, 35, 12), true);
    assert.equal(srcLevel.checkpoints?.length, 1);
    assert.equal(srcLevel.checkpoints?.[0].visible, true);

    const cpEngine = createFreshEngine();
    cpEngine.loadLevel(srcLevel, false, false, false);
    cpEngine.intermissionTimer = 0;
    cpEngine.marioX = srcLevel.checkpoints![0].x + 2;
    cpEngine.marioY = srcLevel.checkpoints![0].respawnPos.y;
    cpEngine.update(0.016);
    assert.equal(cpEngine.activatedCheckpointIndices.has(0), true);

    // 3. Round-trip JSON preserva música, Layer 2 bonus backdrop, bgColor, enemySpeedMultiplier, wCoins e checkpoints visíveis
    const exportedJson = serializeLevelToFileJson(srcLevel);
    const reimported = parseImportedLevelFile(exportedJson);
    assert.equal(reimported.musicTrack, 'bonus');
    assert.equal(reimported.useBonusBackdrop, true);
    assert.equal(reimported.bgColor, '#0c1438');
    assert.equal(reimported.enemySpeedMultiplier, 1.4);
    assert.equal(reimported.timeLimit, 420);
    assert.equal(reimported.wCoins?.length, 4);
    assert.equal(reimported.checkpoints?.[0]?.visible, true);

    // 4. Inserção e remoção de colunas (+Col / -Col) deslocam tiles, moedas, flagX e checkpoints
    const widthBefore = reimported.width;
    const flagBefore = reimported.flagX;
    const cpXBefore = reimported.checkpoints![0].x;
    insertLevelColumnAt(reimported, 15);
    assert.equal(reimported.width, widthBefore + 1);
    assert.equal(reimported.flagX, flagBefore + 16);
    assert.equal(reimported.checkpoints![0].x, cpXBefore + 16);
    deleteLevelColumnAt(reimported, 15);
    assert.equal(reimported.width, widthBefore);
    assert.equal(reimported.flagX, flagBefore);
    assert.equal(reimported.checkpoints![0].x, cpXBefore);

    // 5. Presets de terreno aplicam blocos e estruturas características corretamente
    const presetLevel = createBlankCustomLevel('PRESET', 'castle', 60);
    applyTerrainPresetToLevel(presetLevel, 'castle_lava');
    assert.ok(presetLevel.tiles.some(r => r.some(t => t?.type === 'lava')));
    assert.ok(presetLevel.tiles.some(r => r.some(t => t?.type === 'axe')));
    applyTerrainPresetToLevel(presetLevel, 'hills_pits');
    assert.ok(presetLevel.tiles.some(r => r.some(t => t?.type === 'question')));

    // 6. Verificação estrutural das ferramentas Lunar Magic na UI do LevelEditorModal e nota no UpdatesModal
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    for (const token of [
      'applyRectBrush',
      'applyFloodFillAtCell',
      'pickBrushAtCell',
      'copyRegionToClipboard',
      'pasteClipboardAtCell',
      'showScreenGuides',
      'showSpritesLayer',
      'showExitsOverlay',
      'showHeaderPanel',
      'showExitsPanel',
      'minimapCanvasRef',
      'insertLevelColumnAt',
      'deleteLevelColumnAt',
      'applyTerrainPresetToLevel',
      "id: 'pipe_warp_map'",
      "id: 'pipe_warp_horiz'",
      "id: 'w_coin'",
      "id: 'midway_checkpoint'",
      "id: 'tile_bonus_block'",
      "id: 'tile_castle_crenel'",
      "id: 'tile_castle_window'",
      "id: 'switch_yellow'",
      "id: 'switch_blue'",
    ]) {
      assert.ok(editorSrc.includes(token), `Token Lunar Magic ausente em LevelEditorModal: ${token}`);
    }
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.1BM.7-lunar-magic'));
  });

  await test('R1.19.5RT.7: Lista Hexadecimal, Multi-Mapa JSON, Canos Laterais/Verticais, Entrada Normal/Cano e Fallback Overworld', () => {
    // 1. Conversores hexadecimais e coordenadas
    assert.equal(normalizeHexLevelCode('0105'), '0105');
    assert.equal(normalizeHexLevelCode('0x00d0'), '00D0');
    assert.equal(normalizeHexLevelCode('$d2.json'), '00D2');
    assert.equal(normalizeHexLevelCode('ZZZZ'), null);
    assert.equal(formatHexCoord(20), '14');
    assert.equal(parseHexCoord('0x14', 240), 20);
    assert.equal(parseHexCoord('FF', 14), null);

    // 2. Catálogo hexadecimal + arquivo multi-mapa world-hex-maps.json + arquivo standalone 00D2.json
    assert.ok(HEX_LEVEL_LIST.length >= 14, 'Catálogo Hex deve conter fases World e mapas 00D0..00D2');
    assert.ok(WORLD_STAGE_JSON_REGISTRY.every(e => Boolean(e.hexId)));

    const res00D0 = resolveHexLevelTarget('00D0');
    assert.equal(res00D0.valid, true);
    assert.equal(res00D0.redirectedToOverworld, false);
    assert.equal(res00D0.isEmbeddedMultiMap, true);
    assert.equal(res00D0.sourceFile, 'world-hex-maps.json');
    assert.equal(res00D0.level.hexId, '00D0');
    assert.equal(res00D0.level.entryType, 'pipe');
    assert.equal(res00D0.level.entryPipeDir, 'right');

    const res00D1 = resolveHexLevelTarget('00D1');
    assert.equal(res00D1.valid, true);
    assert.equal(res00D1.sourceFile, 'world-hex-maps.json');
    assert.equal(res00D1.level.entryType, 'pipe');
    assert.equal(res00D1.level.entryPipeDir, 'down');

    const res00D2 = resolveHexLevelTarget('00D2');
    assert.equal(res00D2.valid, true);
    assert.equal(res00D2.sourceFile, '00D2.json');
    assert.equal(res00D2.level.theme, 'ghost_house');
    assert.equal(getWorldStageFilename(res00D2.level), '00D2.json');

    // Hex inválido ou inexistente -> redireciona automaticamente para Overworld W-1 (0105)
    const badInspect = inspectHexLevelTarget('ZZZZ');
    assert.equal(badInspect.valid, false);
    assert.equal(badInspect.redirectedToOverworld, true);
    const badResolve = resolveHexLevelTarget('0999');
    assert.equal(badResolve.valid, false);
    assert.equal(badResolve.redirectedToOverworld, true);
    assert.equal(badResolve.level.id, 'smw-wiki-1');
    assert.equal(badResolve.level.hexId, '0105');

    // 3. Entrada na fase: normal vs entrando por cano (entryType + entryPipeDir)
    const pipeEntryEngine = createFreshEngine();
    pipeEntryEngine.loadLevel(res00D0.level, false, false, false);
    assert.equal(pipeEntryEngine.marioState, 'pipe_exiting');
    assert.equal(pipeEntryEngine.pipeExitDir, 'right');

    const normalEntryEngine = createFreshEngine();
    normalEntryEngine.loadLevel(res00D2.level, false, false, false);
    assert.notEqual(normalEntryEngine.marioState, 'pipe_exiting');

    // 4. Canos laterais esquerda/direita (← e →) e warp por Hex JSON no GameEngine
    const lateralSrc = createBlankCustomLevel('LATERAL HEX', 'overworld', 60);
    lateralSrc.id = 'lateral-src';
    lateralSrc.hexId = '00A1';
    assert.equal(
      placeWarpPipeInLevel(lateralSrc, 14, 12, {
        dir: 'right',
        toLevel: 'hex:00D0',
        targetHex: '00D0',
        toPos: { x: 3 * 16, y: 11 * 16 },
        entryMode: 'pipe',
        destPipeDir: 'right',
      }),
      true
    );
    assert.equal(lateralSrc.tiles[11][14]?.type, 'pipe_horiz_top');
    assert.equal(lateralSrc.tiles[12][14]?.type, 'pipe_horiz_bottom');

    assert.equal(
      placeWarpPipeInLevel(lateralSrc, 24, 12, {
        dir: 'left',
        toLevel: 'hex:9999',
        targetHex: '9999',
        toPos: { x: 48, y: 192 },
        entryMode: 'normal',
      }),
      true
    );
    assert.equal(lateralSrc.tiles[11][24]?.type, 'pipe_horiz_right_top');
    assert.equal(lateralSrc.tiles[12][24]?.type, 'pipe_horiz_right_bottom');
    assert.equal(lateralSrc.pipeWarps?.length, 2);

    // Entra no cano lateral → para chegar em 00D0 saindo horizontalmente por cano
    const hexEngine = createFreshEngine();
    hexEngine.loadLevel(lateralSrc, false, false, false);
    hexEngine.intermissionTimer = 0;
    hexEngine.marioX = 13 * 16 + 4;
    hexEngine.marioY = 12 * 16;
    hexEngine.marioGrounded = true;
    hexEngine.controls.right = true;
    hexEngine.update(0.016);
    assert.equal(hexEngine.marioState, 'pipe_entering');
    assert.equal(hexEngine.warpDir, 'right');
    hexEngine.controls.right = false;
    for (let i = 0; i < 60 && hexEngine.marioState === 'pipe_entering'; i++) {
      hexEngine.update(0.016);
    }
    assert.equal(hexEngine.level.hexId, '00D0');
    assert.equal(hexEngine.marioState, 'pipe_exiting');
    assert.equal(hexEngine.pipeExitDir, 'right');

    // Entra no cano lateral ← com Hex inválido '9999' -> redireciona para W-1 Overworld ('0105') em modo normal
    const fallbackEngine = createFreshEngine();
    fallbackEngine.loadLevel(lateralSrc, false, false, false);
    fallbackEngine.intermissionTimer = 0;
    fallbackEngine.marioX = 25 * 16;
    fallbackEngine.marioY = 12 * 16;
    fallbackEngine.marioGrounded = true;
    fallbackEngine.controls.left = true;
    fallbackEngine.update(0.016);
    assert.equal(fallbackEngine.marioState, 'pipe_entering');
    assert.equal(fallbackEngine.warpDir, 'left');
    fallbackEngine.controls.left = false;
    for (let i = 0; i < 60 && fallbackEngine.marioState === 'pipe_entering'; i++) {
      fallbackEngine.update(0.016);
    }
    assert.equal(fallbackEngine.level.id, 'smw-wiki-1');
    assert.equal(fallbackEngine.level.hexId, '0105');
    assert.notEqual(fallbackEngine.marioState, 'pipe_exiting');

    // 5. Round-trip JSON preserva hexId, entryType, entryPipeDir, targetHex, entryMode, destPipeDir e cano lateral 'left'
    lateralSrc.entryType = 'pipe';
    lateralSrc.entryPipeDir = 'left';
    const reimported = parseImportedLevelFile(serializeLevelToFileJson(lateralSrc));
    assert.equal(reimported.hexId, '00A1');
    assert.equal(reimported.entryType, 'pipe');
    assert.equal(reimported.entryPipeDir, 'left');
    assert.equal(reimported.pipeWarps?.[0].targetHex, '00D0');
    assert.equal(reimported.pipeWarps?.[0].entryMode, 'pipe');
    assert.equal(reimported.pipeWarps?.[0].destPipeDir, 'right');
    assert.equal(reimported.pipeWarps?.[1].type, 'left');
    assert.equal(reimported.pipeWarps?.[1].entryMode, 'normal');

    // 6. Verificação estrutural do Editor e UpdatesModal
    const editorSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LevelEditorModal.tsx'), 'utf8');
    for (const token of [
      'HEX_LEVEL_LIST',
      'inspectHexLevelTarget',
      'resolveHexLevelTarget',
      'handleLoadHexLevelIntoEditor',
      "id: 'pipe_warp_horiz_left'",
      "id: 'tile_pipe_horiz_right_top'",
      'entryPipeDir',
    ]) {
      assert.ok(editorSrc.includes(token), `Token R1.19.5RT.7 ausente em LevelEditorModal: ${token}`);
    }
    assert.ok(GAME_UPDATES.some(u => u.uid === 'R1.19.5RT.7'));
  });

  await test('Catálogo Hex: 255 arquivos JSON mapa exemplos (0200..02FE) válidos para Editor e Modo World', () => {
    const exampleItems = HEX_LEVEL_LIST.filter(item => item.isExampleMap);
    assert.equal(exampleItems.length, 255, 'Deve conter exatamente 255 mapas exemplo hexadecimais (0200..02FE)');
    assert.ok(HEX_LEVEL_LIST.length >= 269, 'Catálogo Hex total deve incluir as 14 fases base + 255 mapas exemplo');

    const seenHex = new Set<string>();
    for (let i = 0; i < 255; i++) {
      const expectedHex = (0x0200 + i).toString(16).toUpperCase().padStart(4, '0');
      const res = resolveHexLevelTarget(expectedHex);
      assert.equal(res.valid, true, `Mapa exemplo ${expectedHex} deve ser válido`);
      assert.equal(res.redirectedToOverworld, false);
      assert.equal(res.sourceFile, `${expectedHex}.json`);
      assert.equal(res.level.hexId, expectedHex);
      assert.equal(res.level.tiles.length, 15, `Altura da grade de ${expectedHex} deve ser 15`);
      assert.equal(res.level.tiles[0].length, res.level.width, `Largura da grade de ${expectedHex} deve bater`);
      seenHex.add(expectedHex);

      // Amostragem de carregamento no motor + verificação R1.16.PX.4 em todos
      for (const row of res.level.tiles) {
        for (const tile of row) {
          if (tile && (tile.type === 'question' || tile.type === 'brick')) {
            assert.ok(
              tile.content === 'none' || tile.content === 'coin',
              `Bloco ${tile.type} em ${expectedHex} não deve conter power-up`
            );
          }
        }
      }
      for (const pw of res.level.pipeWarps || []) {
        if (pw.targetHex) {
          const targetInfo = inspectHexLevelTarget(pw.targetHex);
          assert.equal(targetInfo.valid, true, `Destino warp ${pw.targetHex} em ${expectedHex} deve existir`);
        }
      }
      if (i % 51 === 0) {
        const sampleEngine = createFreshEngine();
        sampleEngine.loadLevel(res.level, false, false, false);
        assert.equal(sampleEngine.level.hexId, expectedHex);
      }
    }
    assert.equal(seenHex.size, 255);
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

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[FAIL] Erro na suíte de regressão:', err);
    process.exit(1);
  });
