/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// NES Color Palette constants
export const NES_COLORS = {
  TRANSPARENT: 'transparent',
  BLACK: '#000000',
  WHITE: '#ffffff',
  
  // Mario Palette (Classic SMB1 NES)
  MARIO_RED: '#b83400',       // Cap and overalls
  MARIO_BROWN: '#6a4600',     // Hair, shirt, boots
  MARIO_SKIN: '#fc9838',      // Face and hands
  
  // Fire Mario
  FIRE_WHITE: '#fcfcfc',
  FIRE_RED: '#b83400',
  
  // Luigi (Bonus/alt)
  LUIGI_GREEN: '#00a800',
  LUIGI_WHITE: '#ffffff',
  
  // Enemies
  GOOMBA_DARK: '#682000',
  GOOMBA_LIGHT: '#a84400',
  GOOMBA_FOOT: '#000000',
  
  KOOPA_GREEN: '#00a800',
  KOOPA_LIGHT_GREEN: '#58d838',
  KOOPA_BELLY: '#f8d878',
  KOOPA_DARK: '#005000',
  
  PIRANHA_RED: '#d82800',
  PIRANHA_LIPS: '#ffffff',
  PIRANHA_STEM: '#00a800',
  
  // Environment
  SKY_BLUE: '#5c94fc',
  UNDERGROUND_BG: '#000000',
  
  GROUND_ORANGE: '#e45c10',
  GROUND_DARK: '#682400',
  GROUND_LIGHT: '#fcb478',
  
  BRICK_RED: '#b83400',
  BRICK_MORTAR: '#000000',
  BRICK_HIGHLIGHT: '#f89440',
  
  QUESTION_BG: '#fc9838',
  QUESTION_DARK: '#883800',
  QUESTION_MARK: '#682000',
  QUESTION_EMPTY: '#8c5020',
  
  HARD_BLOCK_LIGHT: '#fcb478',
  HARD_BLOCK_DARK: '#000000',
  
  PIPE_GREEN: '#00a800',
  PIPE_LIGHT: '#80d010',
  PIPE_DARK: '#005000',
  
  CASTLE_BRICK: '#d8d8d8',
  CASTLE_SHADOW: '#707070',
  CASTLE_BLACK: '#000000',
  
  COIN_GOLD: '#f8b800',
  COIN_LIGHT: '#fce078',
  COIN_DARK: '#884400',
  
  CLOUD_WHITE: '#ffffff',
  CLOUD_BORDER: '#000000',
  CLOUD_BLUE: '#a8c8fc',
  
  HILL_GREEN: '#00a800',
  HILL_BORDER: '#000000',
  HILL_SPOTS: '#006800',
};

// Helper to create an offscreen canvas of given size
function createOffscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

// Draw a pixel grid where each character in pattern maps to a color
function drawPixelGrid(
  ctx: CanvasRenderingContext2D, 
  pattern: string[], 
  colorMap: Record<string, string>,
  offsetX = 0,
  offsetY = 0,
  scale = 1
) {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      const color = colorMap[char];
      if (color && color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }
  }
}

// Cache of rendered sprites
export class SpriteAtlas {
  private static instance: SpriteAtlas;
  
  // Small Mario (16x16)
  public marioSmallIdle!: HTMLCanvasElement;
  public marioSmallRun1!: HTMLCanvasElement;
  public marioSmallRun2!: HTMLCanvasElement;
  public marioSmallRun3!: HTMLCanvasElement;
  public marioSmallJump!: HTMLCanvasElement;
  public marioSmallSkid!: HTMLCanvasElement;
  public marioSmallSlide!: HTMLCanvasElement;
  public marioSmallDead!: HTMLCanvasElement;

  // Super Mario (16x32)
  public marioSuperIdle!: HTMLCanvasElement;
  public marioSuperRun1!: HTMLCanvasElement;
  public marioSuperRun2!: HTMLCanvasElement;
  public marioSuperRun3!: HTMLCanvasElement;
  public marioSuperJump!: HTMLCanvasElement;
  public marioSuperSkid!: HTMLCanvasElement;
  public marioSuperCrouch!: HTMLCanvasElement;
  public marioSuperSlide!: HTMLCanvasElement;

  // Fire Mario (16x32)
  public marioFireIdle!: HTMLCanvasElement;
  public marioFireRun1!: HTMLCanvasElement;
  public marioFireRun2!: HTMLCanvasElement;
  public marioFireRun3!: HTMLCanvasElement;
  public marioFireJump!: HTMLCanvasElement;
  public marioFireSkid!: HTMLCanvasElement;
  public marioFireCrouch!: HTMLCanvasElement;
  public marioFireSlide!: HTMLCanvasElement;

  // Tanooki Mario (16x32 and Tail Spin 24x32)
  public marioTanookiIdle!: HTMLCanvasElement;
  public marioTanookiRun1!: HTMLCanvasElement;
  public marioTanookiRun2!: HTMLCanvasElement;
  public marioTanookiRun3!: HTMLCanvasElement;
  public marioTanookiJump!: HTMLCanvasElement;
  public marioTanookiSkid!: HTMLCanvasElement;
  public marioTanookiCrouch!: HTMLCanvasElement;
  public marioTanookiSlide!: HTMLCanvasElement;
  public marioTanookiTailSpin1!: HTMLCanvasElement;
  public marioTanookiTailSpin2!: HTMLCanvasElement;
  public marioTanookiTailSpin3!: HTMLCanvasElement;
  public marioTanookiTailSpin4!: HTMLCanvasElement;
  public marioTanookiFlutter1!: HTMLCanvasElement;
  public marioTanookiFlutter2!: HTMLCanvasElement;
  public marioTanookiStatue!: HTMLCanvasElement;

  // WazzimaGiygg ("Mario Verde") Sprites
  public wazzimaSmallIdle!: HTMLCanvasElement;
  public wazzimaSmallRun1!: HTMLCanvasElement;
  public wazzimaSmallRun2!: HTMLCanvasElement;
  public wazzimaSmallRun3!: HTMLCanvasElement;
  public wazzimaSmallJump!: HTMLCanvasElement;
  public wazzimaSmallSkid!: HTMLCanvasElement;
  public wazzimaSmallSlide!: HTMLCanvasElement;
  public wazzimaSmallDead!: HTMLCanvasElement;

  public wazzimaSuperIdle!: HTMLCanvasElement;
  public wazzimaSuperRun1!: HTMLCanvasElement;
  public wazzimaSuperRun2!: HTMLCanvasElement;
  public wazzimaSuperRun3!: HTMLCanvasElement;
  public wazzimaSuperJump!: HTMLCanvasElement;
  public wazzimaSuperSkid!: HTMLCanvasElement;
  public wazzimaSuperCrouch!: HTMLCanvasElement;
  public wazzimaSuperSlide!: HTMLCanvasElement;

  public wazzimaFireIdle!: HTMLCanvasElement;
  public wazzimaFireRun1!: HTMLCanvasElement;
  public wazzimaFireRun2!: HTMLCanvasElement;
  public wazzimaFireRun3!: HTMLCanvasElement;
  public wazzimaFireJump!: HTMLCanvasElement;
  public wazzimaFireSkid!: HTMLCanvasElement;
  public wazzimaFireCrouch!: HTMLCanvasElement;
  public wazzimaFireSlide!: HTMLCanvasElement;

  public wazzimaTanookiIdle!: HTMLCanvasElement;
  public wazzimaTanookiRun1!: HTMLCanvasElement;
  public wazzimaTanookiRun2!: HTMLCanvasElement;
  public wazzimaTanookiRun3!: HTMLCanvasElement;
  public wazzimaTanookiJump!: HTMLCanvasElement;
  public wazzimaTanookiSkid!: HTMLCanvasElement;
  public wazzimaTanookiCrouch!: HTMLCanvasElement;
  public wazzimaTanookiSlide!: HTMLCanvasElement;
  public wazzimaTanookiTailSpin1!: HTMLCanvasElement;
  public wazzimaTanookiTailSpin2!: HTMLCanvasElement;
  public wazzimaTanookiTailSpin3!: HTMLCanvasElement;
  public wazzimaTanookiTailSpin4!: HTMLCanvasElement;
  public wazzimaTanookiFlutter1!: HTMLCanvasElement;
  public wazzimaTanookiFlutter2!: HTMLCanvasElement;
  public wazzimaTanookiStatue!: HTMLCanvasElement;

  // Femboy Mario (16x32 - 2x Jump Height)
  public marioFemboyIdle!: HTMLCanvasElement;
  public marioFemboyRun1!: HTMLCanvasElement;
  public marioFemboyRun2!: HTMLCanvasElement;
  public marioFemboyRun3!: HTMLCanvasElement;
  public marioFemboyJump!: HTMLCanvasElement;
  public marioFemboySkid!: HTMLCanvasElement;
  public marioFemboyCrouch!: HTMLCanvasElement;
  public marioFemboySlide!: HTMLCanvasElement;

  public wazzimaFemboyIdle!: HTMLCanvasElement;
  public wazzimaFemboyRun1!: HTMLCanvasElement;
  public wazzimaFemboyRun2!: HTMLCanvasElement;
  public wazzimaFemboyRun3!: HTMLCanvasElement;
  public wazzimaFemboyJump!: HTMLCanvasElement;
  public wazzimaFemboySkid!: HTMLCanvasElement;
  public wazzimaFemboyCrouch!: HTMLCanvasElement;
  public wazzimaFemboySlide!: HTMLCanvasElement;

  // Cape Mario / Cape WazzimaGiygg (16x32 - Golden Cape Feather)
  public marioCapeIdle!: HTMLCanvasElement;
  public marioCapeRun1!: HTMLCanvasElement;
  public marioCapeRun2!: HTMLCanvasElement;
  public marioCapeRun3!: HTMLCanvasElement;
  public marioCapeJump!: HTMLCanvasElement;
  public marioCapeGlide1!: HTMLCanvasElement;
  public marioCapeGlide2!: HTMLCanvasElement;
  public marioCapeSpin1!: HTMLCanvasElement;
  public marioCapeSpin2!: HTMLCanvasElement;
  public marioCapeSkid!: HTMLCanvasElement;
  public marioCapeCrouch!: HTMLCanvasElement;
  public marioCapeSlide!: HTMLCanvasElement;

  public wazzimaCapeIdle!: HTMLCanvasElement;
  public wazzimaCapeRun1!: HTMLCanvasElement;
  public wazzimaCapeRun2!: HTMLCanvasElement;
  public wazzimaCapeRun3!: HTMLCanvasElement;
  public wazzimaCapeJump!: HTMLCanvasElement;
  public wazzimaCapeGlide1!: HTMLCanvasElement;
  public wazzimaCapeGlide2!: HTMLCanvasElement;
  public wazzimaCapeSpin1!: HTMLCanvasElement;
  public wazzimaCapeSpin2!: HTMLCanvasElement;
  public wazzimaCapeSkid!: HTMLCanvasElement;
  public wazzimaCapeCrouch!: HTMLCanvasElement;
  public wazzimaCapeSlide!: HTMLCanvasElement;

  // Helper to obtain the correct sprite for any character (Mario or WazzimaGiygg)
  public getCharacterSprite(
    character: 'mario' | 'wazzima',
    power: 'small' | 'super' | 'fire' | 'tanooki' | 'femboy' | 'cape',
    state: string,
    animFrame: number,
    options: {
      isStatue?: boolean;
      tailWhipTimer?: number;
      isFluttering?: boolean;
      marioVx?: number;
      isSpinning?: boolean;
      spinTimer?: number;
    } = {}
  ): HTMLCanvasElement {
    const isW = character === 'wazzima';
    const isStatue = !!options.isStatue;
    const tailWhipTimer = options.tailWhipTimer || 0;
    const isFluttering = !!options.isFluttering;
    const marioVx = options.marioVx || 0;
    const isSpinning = !!options.isSpinning;
    const spinTimer = options.spinTimer || 0;

    if (state === 'dead') {
      return isW ? this.wazzimaSmallDead : this.marioSmallDead;
    }

    if (power === 'tanooki') {
      if (isStatue) return isW ? this.wazzimaTanookiStatue : this.marioTanookiStatue;
      if (tailWhipTimer > 0) {
        const spinStep = Math.min(3, Math.floor((18 - tailWhipTimer) / 4.5));
        const spins = isW
          ? [this.wazzimaTanookiTailSpin1, this.wazzimaTanookiTailSpin2, this.wazzimaTanookiTailSpin3, this.wazzimaTanookiTailSpin4]
          : [this.marioTanookiTailSpin1, this.marioTanookiTailSpin2, this.marioTanookiTailSpin3, this.marioTanookiTailSpin4];
        return spins[spinStep];
      }
      if (isSpinning) {
        const spinStep = Math.floor(spinTimer / 3) % 4;
        const spins = isW
          ? [this.wazzimaTanookiTailSpin1, this.wazzimaTanookiTailSpin2, this.wazzimaTanookiTailSpin3, this.wazzimaTanookiTailSpin4]
          : [this.marioTanookiTailSpin1, this.marioTanookiTailSpin2, this.marioTanookiTailSpin3, this.marioTanookiTailSpin4];
        return spins[spinStep];
      }
      if (isFluttering) {
        const flutter = Math.floor((Date.now() / 90) % 2) === 0;
        if (isW) return flutter ? this.wazzimaTanookiFlutter1 : this.wazzimaTanookiFlutter2;
        return flutter ? this.marioTanookiFlutter1 : this.marioTanookiFlutter2;
      }
      if (state === 'crouching') return isW ? this.wazzimaTanookiCrouch : this.marioTanookiCrouch;
      if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaTanookiJump : this.marioTanookiJump;
      if (state === 'skidding') return isW ? this.wazzimaTanookiSkid : this.marioTanookiSkid;
      if (state === 'pole_slide') return isW ? this.wazzimaTanookiSlide : this.marioTanookiSlide;
      if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
        const frames = isW
          ? [this.wazzimaTanookiRun1, this.wazzimaTanookiRun2, this.wazzimaTanookiRun3]
          : [this.marioTanookiRun1, this.marioTanookiRun2, this.marioTanookiRun3];
        return frames[animFrame % 3];
      }
      return isW ? this.wazzimaTanookiIdle : this.marioTanookiIdle;
    }

    if (power === 'small') {
      if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaSmallJump : this.marioSmallJump;
      if (state === 'skidding') return isW ? this.wazzimaSmallSkid : this.marioSmallSkid;
      if (state === 'pole_slide') return isW ? this.wazzimaSmallSlide : this.marioSmallSlide;
      if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
        const frames = isW
          ? [this.wazzimaSmallRun1, this.wazzimaSmallRun2, this.wazzimaSmallRun3]
          : [this.marioSmallRun1, this.marioSmallRun2, this.marioSmallRun3];
        return frames[animFrame % 3];
      }
      return isW ? this.wazzimaSmallIdle : this.marioSmallIdle;
    }

    if (power === 'super') {
      if (state === 'crouching') return isW ? this.wazzimaSuperCrouch : this.marioSuperCrouch;
      if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaSuperJump : this.marioSuperJump;
      if (state === 'skidding') return isW ? this.wazzimaSuperSkid : this.marioSuperSkid;
      if (state === 'pole_slide') return isW ? this.wazzimaSuperSlide : this.marioSuperSlide;
      if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
        const frames = isW
          ? [this.wazzimaSuperRun1, this.wazzimaSuperRun2, this.wazzimaSuperRun3]
          : [this.marioSuperRun1, this.marioSuperRun2, this.marioSuperRun3];
        return frames[animFrame % 3];
      }
      return isW ? this.wazzimaSuperIdle : this.marioSuperIdle;
    }

    if (power === 'femboy') {
      if (state === 'crouching') return isW ? this.wazzimaFemboyCrouch : this.marioFemboyCrouch;
      if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaFemboyJump : this.marioFemboyJump;
      if (state === 'skidding') return isW ? this.wazzimaFemboySkid : this.marioFemboySkid;
      if (state === 'pole_slide') return isW ? this.wazzimaFemboySlide : this.marioFemboySlide;
      if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
        const frames = isW
          ? [this.wazzimaFemboyRun1, this.wazzimaFemboyRun2, this.wazzimaFemboyRun3]
          : [this.marioFemboyRun1, this.marioFemboyRun2, this.marioFemboyRun3];
        return frames[animFrame % 3];
      }
      return isW ? this.wazzimaFemboyIdle : this.marioFemboyIdle;
    }

    if (power === 'cape') {
      if (tailWhipTimer > 0) {
        const spinStep = Math.floor(tailWhipTimer / 4) % 2;
        if (isW) return spinStep === 0 ? this.wazzimaCapeSpin1 : this.wazzimaCapeSpin2;
        return spinStep === 0 ? this.marioCapeSpin1 : this.marioCapeSpin2;
      }
      if (isSpinning) {
        const spinStep = Math.floor(spinTimer / 3) % 2;
        if (isW) return spinStep === 0 ? this.wazzimaCapeSpin1 : this.wazzimaCapeSpin2;
        return spinStep === 0 ? this.marioCapeSpin1 : this.marioCapeSpin2;
      }
      if (isFluttering) {
        const billow = Math.floor((Date.now() / 85) % 2) === 0;
        if (isW) return billow ? this.wazzimaCapeGlide1 : this.wazzimaCapeGlide2;
        return billow ? this.marioCapeGlide1 : this.marioCapeGlide2;
      }
      if (state === 'crouching') return isW ? this.wazzimaCapeCrouch : this.marioCapeCrouch;
      if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaCapeJump : this.marioCapeJump;
      if (state === 'skidding') return isW ? this.wazzimaCapeSkid : this.marioCapeSkid;
      if (state === 'pole_slide') return isW ? this.wazzimaCapeSlide : this.marioCapeSlide;
      if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
        const frames = isW
          ? [this.wazzimaCapeRun1, this.wazzimaCapeRun2, this.wazzimaCapeRun3]
          : [this.marioCapeRun1, this.marioCapeRun2, this.marioCapeRun3];
        return frames[animFrame % 3];
      }
      return isW ? this.wazzimaCapeIdle : this.marioCapeIdle;
    }

    // Fire power
    if (state === 'crouching') return isW ? this.wazzimaFireCrouch : this.marioFireCrouch;
    if (state === 'jumping' || state === 'falling') return isW ? this.wazzimaFireJump : this.marioFireJump;
    if (state === 'skidding') return isW ? this.wazzimaFireSkid : this.marioFireSkid;
    if (state === 'pole_slide') return isW ? this.wazzimaFireSlide : this.marioFireSlide;
    if (Math.abs(marioVx) > 0.1 || state === 'castle_walk') {
      const frames = isW
        ? [this.wazzimaFireRun1, this.wazzimaFireRun2, this.wazzimaFireRun3]
        : [this.marioFireRun1, this.marioFireRun2, this.marioFireRun3];
      return frames[animFrame % 3];
    }
    return isW ? this.wazzimaFireIdle : this.marioFireIdle;
  }

  // Enemies
  public goombaWalk1!: HTMLCanvasElement;
  public goombaWalk2!: HTMLCanvasElement;
  public goombaSquashed!: HTMLCanvasElement;
  
  public koopaWalk1!: HTMLCanvasElement;
  public koopaWalk2!: HTMLCanvasElement;
  public koopaShell!: HTMLCanvasElement;

  public redKoopaWalk1!: HTMLCanvasElement;
  public redKoopaWalk2!: HTMLCanvasElement;
  public redKoopaShell!: HTMLCanvasElement;

  public paratroopa1!: HTMLCanvasElement;
  public paratroopa2!: HTMLCanvasElement;

  public hammerBroWalk1!: HTMLCanvasElement;
  public hammerBroWalk2!: HTMLCanvasElement;
  public hammerBroThrow!: HTMLCanvasElement;
  public hammerFrames: HTMLCanvasElement[] = [];
  
  public piranha1!: HTMLCanvasElement;
  public piranha2!: HTMLCanvasElement;

  public blooper1!: HTMLCanvasElement;
  public blooper2!: HTMLCanvasElement;
  public cheepCheep1!: HTMLCanvasElement;
  public cheepCheep2!: HTMLCanvasElement;
  public fastCheep1!: HTMLCanvasElement;
  public fastCheep2!: HTMLCanvasElement;
  public bulletBill!: HTMLCanvasElement;
  public bowser1!: HTMLCanvasElement;
  public bowser2!: HTMLCanvasElement;
  public lavaBubble1!: HTMLCanvasElement;
  public lavaBubble2!: HTMLCanvasElement;

  public booChase!: HTMLCanvasElement;
  public booShy!: HTMLCanvasElement;
  public dryBonesWalk1!: HTMLCanvasElement;
  public dryBonesWalk2!: HTMLCanvasElement;
  public dryBonesCrumbled!: HTMLCanvasElement;

  // Tiles (16x16)
  public tileGround!: HTMLCanvasElement;
  public tileGroundUnderground!: HTMLCanvasElement;
  public tileBrick!: HTMLCanvasElement;
  public tileBrickUnderground!: HTMLCanvasElement;
  public tileCoral!: HTMLCanvasElement;
  public tileSeaGround!: HTMLCanvasElement;
  public tileGhostFloor!: HTMLCanvasElement;
  public tileGhostBrick!: HTMLCanvasElement;
  public tileLavaFrames: HTMLCanvasElement[] = [];
  public tileBridge!: HTMLCanvasElement;
  public tileAxeFrames: HTMLCanvasElement[] = [];
  public tileQuestionFrames: HTMLCanvasElement[] = [];
  public tileQuestionEmpty!: HTMLCanvasElement;
  public tileHardBlock!: HTMLCanvasElement;
  public tileExclamYellowLocked!: HTMLCanvasElement;
  public tileExclamYellowActive!: HTMLCanvasElement;
  public tileYellowSwitch!: HTMLCanvasElement;
  public tileYellowSwitchPressed!: HTMLCanvasElement;
  public tileExclamGreenLocked!: HTMLCanvasElement;
  public tileExclamGreenActive!: HTMLCanvasElement;
  public tileGreenSwitch!: HTMLCanvasElement;
  public tileGreenSwitchPressed!: HTMLCanvasElement;
  public tileExclamRedLocked!: HTMLCanvasElement;
  public tileExclamRedActive!: HTMLCanvasElement;
  public tileRedSwitch!: HTMLCanvasElement;
  public tileRedSwitchPressed!: HTMLCanvasElement;
  public tileExclamPinkLocked!: HTMLCanvasElement;
  public tileExclamPinkActive!: HTMLCanvasElement;
  public tilePinkSwitch!: HTMLCanvasElement;
  public tilePinkSwitchPressed!: HTMLCanvasElement;
  public tileExclamBlueLocked!: HTMLCanvasElement;
  public tileExclamBlueActive!: HTMLCanvasElement;
  public tileBlueSwitch!: HTMLCanvasElement;
  public tileBlueSwitchPressed!: HTMLCanvasElement;
  
  // Pipes
  public pipeTopLeft!: HTMLCanvasElement;
  public pipeTopRight!: HTMLCanvasElement;
  public pipeBodyLeft!: HTMLCanvasElement;
  public pipeBodyRight!: HTMLCanvasElement;

  // Items
  public itemMushroomSuper!: HTMLCanvasElement;
  public itemMushroom1Up!: HTMLCanvasElement;
  public itemFireFlowerFrames: HTMLCanvasElement[] = [];
  public itemStarFrames: HTMLCanvasElement[] = [];
  public itemCoinFrames: HTMLCanvasElement[] = [];
  public itemSuperLeaf!: HTMLCanvasElement;
  public itemFeather!: HTMLCanvasElement;
  public itemFemboy!: HTMLCanvasElement;
  public itemKey!: HTMLCanvasElement;
  public itemKeyhole!: HTMLCanvasElement;
  public itemPSwitchBlue!: HTMLCanvasElement;
  public itemPSwitchBluePressed!: HTMLCanvasElement;
  public itemPSwitchCyan!: HTMLCanvasElement;
  public itemPSwitchCyanPressed!: HTMLCanvasElement;
  
  // Castle & Scenery
  public castleBrick!: HTMLCanvasElement;
  public castleCrenel!: HTMLCanvasElement;
  public castleDoor!: HTMLCanvasElement;
  public castleWindow!: HTMLCanvasElement;
  public flagPoleTop!: HTMLCanvasElement;
  public flagPoleBody!: HTMLCanvasElement;
  public flagTriangle!: HTMLCanvasElement;
  public toodleSprite!: HTMLCanvasElement;
  public toodleHappySprite!: HTMLCanvasElement;
  public princessFemboySprite!: HTMLCanvasElement;
  public princessFemboyHappySprite!: HTMLCanvasElement;

  // Yoshi Mount Sprites (20x20 facing right)
  public yoshiIdle!: HTMLCanvasElement;
  public yoshiWalk!: HTMLCanvasElement;
  public yoshiTongue!: HTMLCanvasElement;

  // Particles & Projectiles
  public fireballFrames: HTMLCanvasElement[] = [];
  public whiteFireballFrames: HTMLCanvasElement[] = [];
  public bowserFireFrames: HTMLCanvasElement[] = [];
  public brickDebris!: HTMLCanvasElement;
  public smokePuff!: HTMLCanvasElement;

  private starmanSpriteCache: WeakMap<HTMLCanvasElement, HTMLCanvasElement[]> = new WeakMap();

  public getStarmanSprite(baseSprite: HTMLCanvasElement, phase: number): HTMLCanvasElement {
    let variants = this.starmanSpriteCache.get(baseSprite);
    if (!variants) {
      // 4 authentic NES palette-shifted variants for Starman invincibility & Fire Flower flash
      const palettes: { primary: [number, number, number]; accent: [number, number, number]; glow: [number, number, number] }[] = [
        // 0: Golden Star
        { primary: [252, 224, 120], accent: [248, 160, 24], glow: [255, 255, 255] },
        // 1: Electric Cyan
        { primary: [88, 248, 248], accent: [32, 128, 248], glow: [255, 255, 255] },
        // 2: Emerald Flash
        { primary: [120, 248, 88], accent: [0, 168, 0], glow: [252, 224, 120] },
        // 3: Hot Crimson / Magenta
        { primary: [255, 92, 184], accent: [216, 40, 0], glow: [255, 232, 240] },
      ];

      const w = baseSprite.width;
      const h = baseSprite.height;
      const baseCtx = baseSprite.getContext('2d');
      const baseData = baseCtx ? baseCtx.getImageData(0, 0, w, h) : null;

      variants = palettes.map(pal => {
        const [canvas, ctx] = createOffscreen(w, h);
        if (!baseData) {
          ctx.drawImage(baseSprite, 0, 0);
          return canvas;
        }
        const out = ctx.createImageData(w, h);
        const src = baseData.data;
        const dst = out.data;
        for (let i = 0; i < src.length; i += 4) {
          const a = src[i + 3];
          if (a === 0) continue;
          const r = src[i];
          const g = src[i + 1];
          const b = src[i + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          // Keep black outlines / eyes crisp
          if (maxC < 32) {
            dst[i] = r;
            dst[i + 1] = g;
            dst[i + 2] = b;
            dst[i + 3] = a;
          } else if (lum > 205 && maxC - minC < 40) {
            // Bright white highlights
            dst[i] = pal.glow[0];
            dst[i + 1] = pal.glow[1];
            dst[i + 2] = pal.glow[2];
            dst[i + 3] = a;
          } else if (lum > 135) {
            // Skin / light outfit tones
            dst[i] = pal.primary[0];
            dst[i + 1] = pal.primary[1];
            dst[i + 2] = pal.primary[2];
            dst[i + 3] = a;
          } else {
            // Darker shirt / hair / boots
            dst[i] = pal.accent[0];
            dst[i + 1] = pal.accent[1];
            dst[i + 2] = pal.accent[2];
            dst[i + 3] = a;
          }
        }
        ctx.putImageData(out, 0, 0);
        return canvas;
      });

      this.starmanSpriteCache.set(baseSprite, variants);
    }

    const idx = ((phase % variants.length) + variants.length) % variants.length;
    return variants[idx];
  }

  private constructor() {
    this.generateAllSprites();
  }

  public static get(): SpriteAtlas {
    if (!SpriteAtlas.instance) {
      SpriteAtlas.instance = new SpriteAtlas();
    }
    return SpriteAtlas.instance;
  }

  private generateAllSprites() {
    this.generateMarioSprites();
    this.generateEnemies();
    this.generateTiles();
    this.generateItems();
    this.generateCastle();
    this.generateParticles();
  }

  private generateMarioSprites() {
    // NES Mario Color Palette mappings
    const smallMarioPalette = {
      '.': 'transparent',
      'R': NES_COLORS.MARIO_RED,
      'B': NES_COLORS.MARIO_BROWN,
      'S': NES_COLORS.MARIO_SKIN,
    };

    const fireSmallPalette = {
      '.': 'transparent',
      'R': NES_COLORS.FIRE_WHITE,
      'B': NES_COLORS.FIRE_RED,
      'S': NES_COLORS.MARIO_SKIN,
    };

    // Small Mario Idle (16x16)
    const smallIdle = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRRRRRR.....',
      '...RRRRBRRR.....',
      '..RRRRRRBRRR....',
      '..SSRRBBRRRSS...',
      '..SSSRRRRRSSS...',
      '...SSBBBBBSS....',
      '....BBBBBBB.....',
      '...BBB...BBB....',
      '..BBBB...BBBB...',
    ];

    // Small Mario Run 1
    const smallRun1 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRBRRRR.....',
      '...RRRRBBRRR....',
      '..SSRRBBBRRRSS..',
      '..SSSSBBBRRRSSS.',
      '...SSBBBBBRR....',
      '....BBBBBBBB....',
      '...BBBB..BBBB...',
      '..BBBB....BBBB..',
      '................',
    ];

    // Small Mario Run 2
    const smallRun2 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRRRRRR.....',
      '...RRRRBRRR.....',
      '..RRRRRRBRRR....',
      '..SSRRBBRRRSS...',
      '..SSSRRRRRSSS...',
      '...SSBBBBBSS....',
      '....BBBBBBB.....',
      '....BBBBB.......',
      '...BBBBBB.......',
    ];

    // Small Mario Run 3
    const smallRun3 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRBRRRR.....',
      '...RRRRBBRRR....',
      '..SSRRBBBRRRSS..',
      '..SSSSBBBRRRSSS.',
      '...SSBBBBBRR....',
      '....BBBBBBBB....',
      '.....BBBBBBBB...',
      '......BBBBBBB...',
      '................',
    ];

    // Small Mario Jump
    const smallJump = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '..SSRRBRRRRSS...',
      '..SSRRRBBRRRSS..',
      '..SSRRRRRRRRSS..',
      '...SSRRRRRRSS...',
      '....BBBBBBBB....',
      '...BBBBBBBBBB...',
      '..BBBB....BBBB..',
      '..BBB......BBB..',
      '................',
    ];

    // Small Mario Skid
    const smallSkid = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRBRRR......',
      '...RRRRBBR......',
      '..SSRRBBBRSS....',
      '..SSSSBBBRSSS...',
      '...SSBBBBBSS....',
      '....BBBBBBB.....',
      '..BBBB...BBBB...',
      '.BBBB.....BBBB..',
      '................',
    ];

    // Small Mario Dead
    const smallDead = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRRRRRR.....',
      '..SSRRBRRRRSS...',
      '.SSSRRRBBRRRSSS.',
      '.SSSRRRRRRRRSSS.',
      '..SSRRRRRRRRSS..',
      '....BBBBBBBB....',
      '...BBBB..BBBB...',
      '..BBBB....BBBB..',
      '..BBB......BBB..',
    ];

    const makeSprite = (pattern: string[], palette: Record<string, string>, w = 16, h = 16) => {
      const [canvas, ctx] = createOffscreen(w, h);
      drawPixelGrid(ctx, pattern, palette);
      return canvas;
    };

    this.marioSmallIdle = makeSprite(smallIdle, smallMarioPalette);
    this.marioSmallRun1 = makeSprite(smallRun1, smallMarioPalette);
    this.marioSmallRun2 = makeSprite(smallRun2, smallMarioPalette);
    this.marioSmallRun3 = makeSprite(smallRun3, smallMarioPalette);
    this.marioSmallJump = makeSprite(smallJump, smallMarioPalette);
    this.marioSmallSkid = makeSprite(smallSkid, smallMarioPalette);
    this.marioSmallSlide = makeSprite(smallRun1, smallMarioPalette);
    this.marioSmallDead = makeSprite(smallDead, smallMarioPalette);

    // WazzimaGiygg ("Mario Verde") Small Sprites
    const wazzimaSmallPalette = {
      '.': 'transparent',
      'R': '#00a800', // Emerald Green Cap & Shirt
      'B': '#0038b8', // Classic Cobalt Navy Overalls
      'S': NES_COLORS.MARIO_SKIN,
    };
    this.wazzimaSmallIdle = makeSprite(smallIdle, wazzimaSmallPalette);
    this.wazzimaSmallRun1 = makeSprite(smallRun1, wazzimaSmallPalette);
    this.wazzimaSmallRun2 = makeSprite(smallRun2, wazzimaSmallPalette);
    this.wazzimaSmallRun3 = makeSprite(smallRun3, wazzimaSmallPalette);
    this.wazzimaSmallJump = makeSprite(smallJump, wazzimaSmallPalette);
    this.wazzimaSmallSkid = makeSprite(smallSkid, wazzimaSmallPalette);
    this.wazzimaSmallSlide = makeSprite(smallRun1, wazzimaSmallPalette);
    this.wazzimaSmallDead = makeSprite(smallDead, wazzimaSmallPalette);

    // Super Mario (16x32)
    const superPalette = {
      '.': 'transparent',
      'R': NES_COLORS.MARIO_RED,
      'B': NES_COLORS.MARIO_BROWN,
      'S': NES_COLORS.MARIO_SKIN,
    };

    const superFirePalette = {
      '.': 'transparent',
      'R': NES_COLORS.FIRE_WHITE,
      'B': NES_COLORS.FIRE_RED,
      'S': NES_COLORS.MARIO_SKIN,
    };

    const superIdle = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '.....SSSSSSS....',
      '....RRRRBRRR....',
      '...RRRRRBRRRR...',
      '..RRRRRRBRRRRR..',
      '..RRRRRRRRRRRR..',
      '..SSRRRRRRRRSS..',
      '..SSSRRRRRRSSS..',
      '..SSSRRRRRRSSS..',
      '...SSBBBBBSS....',
      '...SSBBBBBSS....',
      '....BBBBBBB.....',
      '....BBBBBBB.....',
      '....BBBBBBB.....',
      '...BBBB.BBBB....',
      '...BBBB.BBBB....',
      '...BBBB.BBBB....',
      '..BBBB...BBBB...',
      '..BBBB...BBBB...',
      '..BBBB...BBBB...',
      '..BBBB...BBBB...',
      '..BBBB...BBBB...',
      '.BBBBB...BBBBB..',
      '.BBBBB...BBBBB..',
    ];

    const superRun1 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '.....SSSSSSS....',
      '....RRBRRRRR....',
      '...RRRRBBRRRR...',
      '..RRRRRBBBRRRR..',
      '..SSRRBBBBRRSS..',
      '..SSSSBBBBRRSS..',
      '...SSSBBBBRSS...',
      '...SSBBBBBBRR...',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '...BBBBBBBBBB...',
      '...BBBB..BBBB...',
      '..BBBB....BBBB..',
      '..BBBB....BBBB..',
      '..BBBB.....BBB..',
      '..BBBB.....BBB..',
      '.BBBBB.....BBB..',
      '.BBBBB.....BBB..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];

    const superRun2 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '.....SSSSSSS....',
      '....RRRRBRRR....',
      '...RRRRRBRRRR...',
      '..RRRRRRBRRRRR..',
      '..RRRRRRRRRRRR..',
      '..SSRRRRRRRRSS..',
      '..SSSRRRRRRSSS..',
      '..SSSRRRRRRSSS..',
      '...SSBBBBBSS....',
      '....BBBBBBB.....',
      '....BBBBBBB.....',
      '....BBBBBBB.....',
      '....BBBBBBB.....',
      '...BBBBBB.......',
      '...BBBBBB.......',
      '..BBBBBBB.......',
      '..BBBBBBB.......',
      '..BBBBBB........',
      '..BBBBBB........',
      '................',
      '................',
      '................',
      '................',
    ];

    const superRun3 = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '.....SSSSSSS....',
      '....RRBRRRRR....',
      '...RRRRBBRRRR...',
      '..RRRRRBBBRRRR..',
      '..SSRRBBBBRRSS..',
      '..SSSSBBBBRRSS..',
      '...SSSBBBBRSS...',
      '...SSBBBBBBRR...',
      '....BBBBBBBB....',
      '.....BBBBBBBB...',
      '.....BBBBBBBB...',
      '......BBBBBBB...',
      '......BBBBBBB...',
      '.......BBBBBB...',
      '.......BBBBBB...',
      '........BBBBB...',
      '........BBBBB...',
      '........BBBB....',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];

    const superJump = [
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '..SSRRBRRRRSS...',
      '..SSRRRBBRRRSS..',
      '..SSRRRRRRRRSS..',
      '..SSSRRRRRRSSS..',
      '...SSRRRRRRSS...',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '...BBBBBBBBBB...',
      '..BBBBBBBBBBBB..',
      '..BBBB....BBBB..',
      '..BBBB....BBBB..',
      '..BBB......BBB..',
      '..BBB......BBB..',
      '.BBBB......BBBB.',
      '.BBBB......BBBB.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];

    const superCrouch = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....RRRRR......',
      '....RRRRRRRRR...',
      '....RRRRRRRRR...',
      '....BBBSSBS.....',
      '...BBSBSSSBS....',
      '...BBSBBSSBSS...',
      '...BBBSSSSBBBB..',
      '.....SSSSSSS....',
      '....RRRRRRRR....',
      '...RRRRRRRRRR...',
      '..SSRRRRRRRRSS..',
      '..SSSRRRRRRSSS..',
      '...SSBBBBBBSS...',
      '....BBBBBBBB....',
      '...BBBBBBBBBB...',
      '..BBBBBBBBBBBB..',
      '.BBBBBBBBBBBBBB.',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      '................',
      '................',
      '................',
      '................',
    ];

    this.marioSuperIdle = makeSprite(superIdle, superPalette, 16, 32);
    this.marioSuperRun1 = makeSprite(superRun1, superPalette, 16, 32);
    this.marioSuperRun2 = makeSprite(superRun2, superPalette, 16, 32);
    this.marioSuperRun3 = makeSprite(superRun3, superPalette, 16, 32);
    this.marioSuperJump = makeSprite(superJump, superPalette, 16, 32);
    this.marioSuperSkid = makeSprite(superRun1, superPalette, 16, 32);
    this.marioSuperCrouch = makeSprite(superCrouch, superPalette, 16, 32);
    this.marioSuperSlide = makeSprite(superRun1, superPalette, 16, 32);

    // Fire Mario uses Fire Palette
    this.marioFireIdle = makeSprite(superIdle, superFirePalette, 16, 32);
    this.marioFireRun1 = makeSprite(superRun1, superFirePalette, 16, 32);
    this.marioFireRun2 = makeSprite(superRun2, superFirePalette, 16, 32);
    this.marioFireRun3 = makeSprite(superRun3, superFirePalette, 16, 32);
    this.marioFireJump = makeSprite(superJump, superFirePalette, 16, 32);
    this.marioFireSkid = makeSprite(superRun1, superFirePalette, 16, 32);
    this.marioFireCrouch = makeSprite(superCrouch, superFirePalette, 16, 32);
    this.marioFireSlide = makeSprite(superRun1, superFirePalette, 16, 32);

    // WazzimaGiygg ("Mario Verde") Super and Fire Sprites
    const wazzimaSuperPalette = {
      '.': 'transparent',
      'R': '#00a800',
      'B': '#0038b8',
      'S': NES_COLORS.MARIO_SKIN,
    };
    const wazzimaFirePalette = {
      '.': 'transparent',
      'R': NES_COLORS.FIRE_WHITE,
      'B': '#00a800',
      'S': NES_COLORS.MARIO_SKIN,
    };
    this.wazzimaSuperIdle = makeSprite(superIdle, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperRun1 = makeSprite(superRun1, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperRun2 = makeSprite(superRun2, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperRun3 = makeSprite(superRun3, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperJump = makeSprite(superJump, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperSkid = makeSprite(superRun1, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperCrouch = makeSprite(superCrouch, wazzimaSuperPalette, 16, 32);
    this.wazzimaSuperSlide = makeSprite(superRun1, wazzimaSuperPalette, 16, 32);

    this.wazzimaFireIdle = makeSprite(superIdle, wazzimaFirePalette, 16, 32);
    this.wazzimaFireRun1 = makeSprite(superRun1, wazzimaFirePalette, 16, 32);
    this.wazzimaFireRun2 = makeSprite(superRun2, wazzimaFirePalette, 16, 32);
    this.wazzimaFireRun3 = makeSprite(superRun3, wazzimaFirePalette, 16, 32);
    this.wazzimaFireJump = makeSprite(superJump, wazzimaFirePalette, 16, 32);
    this.wazzimaFireSkid = makeSprite(superRun1, wazzimaFirePalette, 16, 32);
    this.wazzimaFireCrouch = makeSprite(superCrouch, wazzimaFirePalette, 16, 32);
    this.wazzimaFireSlide = makeSprite(superRun1, wazzimaFirePalette, 16, 32);

    // Femboy Power-up Sprites (Pastel pink & white outfit + cute hair ribbon bow)
    const makeFemboySprite = (pattern: string[], palette: Record<string, string>, isCrouch = false) => {
      const canvas = makeSprite(pattern, palette, 16, 32);
      const c = canvas.getContext('2d')!;
      const bowY = isCrouch ? 8 : 0;
      // Cute pink & white bow on cap
      c.fillStyle = '#ff1f96';
      c.fillRect(3, bowY, 2, 2);
      c.fillRect(7, bowY, 2, 2);
      c.fillStyle = '#ffffff';
      c.fillRect(5, bowY, 2, 2);
      // Striped thigh-high highlight
      if (!isCrouch) {
        c.fillStyle = '#ff66b8';
        c.fillRect(3, 25, 3, 1);
        c.fillRect(9, 25, 3, 1);
      }
      return canvas;
    };

    const femboyMarioPalette = {
      '.': 'transparent',
      'R': '#ff66b8', // Pastel hot-pink cap & top
      'B': '#ffd6ee', // Soft blush white-pink skirt & thigh-highs
      'S': NES_COLORS.MARIO_SKIN,
    };

    const femboyWazzimaPalette = {
      '.': 'transparent',
      'R': '#ff74c4', // Pastel pink bow & top
      'B': '#b8ffd6', // Mint pastel skirt & thigh-highs
      'S': NES_COLORS.MARIO_SKIN,
    };

    this.marioFemboyIdle = makeFemboySprite(superIdle, femboyMarioPalette);
    this.marioFemboyRun1 = makeFemboySprite(superRun1, femboyMarioPalette);
    this.marioFemboyRun2 = makeFemboySprite(superRun2, femboyMarioPalette);
    this.marioFemboyRun3 = makeFemboySprite(superRun3, femboyMarioPalette);
    this.marioFemboyJump = makeFemboySprite(superJump, femboyMarioPalette);
    this.marioFemboySkid = makeFemboySprite(superRun1, femboyMarioPalette);
    this.marioFemboyCrouch = makeFemboySprite(superCrouch, femboyMarioPalette, true);
    this.marioFemboySlide = makeFemboySprite(superRun1, femboyMarioPalette);

    this.wazzimaFemboyIdle = makeFemboySprite(superIdle, femboyWazzimaPalette);
    this.wazzimaFemboyRun1 = makeFemboySprite(superRun1, femboyWazzimaPalette);
    this.wazzimaFemboyRun2 = makeFemboySprite(superRun2, femboyWazzimaPalette);
    this.wazzimaFemboyRun3 = makeFemboySprite(superRun3, femboyWazzimaPalette);
    this.wazzimaFemboyJump = makeFemboySprite(superJump, femboyWazzimaPalette);
    this.wazzimaFemboySkid = makeFemboySprite(superRun1, femboyWazzimaPalette);
    this.wazzimaFemboyCrouch = makeFemboySprite(superCrouch, femboyWazzimaPalette, true);
    this.wazzimaFemboySlide = makeFemboySprite(superRun1, femboyWazzimaPalette);

    // Cape Power-Up Sprites (Flowing golden cape behind Mario / WazzimaGiygg)
    const makeCapeSprite = (
      pattern: string[],
      palette: Record<string, string>,
      mode: 'idle' | 'run' | 'jump' | 'glide1' | 'glide2' | 'spin1' | 'spin2' | 'crouch' = 'idle'
    ) => {
      const canvas = makeSprite(pattern, palette, 16, 32);
      const c = canvas.getContext('2d')!;
      const capeGold = '#f8d800';
      const capeHighlight = '#fff8a0';
      const capeShade = '#d87800';
      const capeBorder = '#402000';

      if (mode === 'crouch') {
        c.fillStyle = capeBorder;
        c.fillRect(0, 17, 4, 10);
        c.fillStyle = capeGold;
        c.fillRect(1, 18, 3, 8);
        c.fillStyle = capeShade;
        c.fillRect(1, 23, 3, 3);
        return canvas;
      }

      if (mode === 'spin1' || mode === 'spin2') {
        const spreadY = mode === 'spin1' ? 14 : 16;
        c.fillStyle = capeBorder;
        c.fillRect(0, spreadY - 1, 16, 9);
        c.fillStyle = capeGold;
        c.fillRect(0, spreadY, 16, 7);
        c.fillStyle = capeHighlight;
        c.fillRect(2, spreadY + 1, 12, 2);
        c.fillStyle = capeShade;
        c.fillRect(0, spreadY + 5, 16, 2);
        return canvas;
      }

      if (mode === 'glide1' || mode === 'glide2') {
        const lift = mode === 'glide1' ? -2 : 0;
        c.fillStyle = capeBorder;
        c.fillRect(0, 11 + lift, 6, 13);
        c.fillStyle = capeGold;
        c.fillRect(0, 12 + lift, 5, 11);
        c.fillStyle = capeHighlight;
        c.fillRect(1, 12 + lift, 3, 4);
        c.fillStyle = capeShade;
        c.fillRect(0, 20 + lift, 5, 3);
        return canvas;
      }

      if (mode === 'jump' || mode === 'run') {
        c.fillStyle = capeBorder;
        c.fillRect(0, 13, 5, 13);
        c.fillStyle = capeGold;
        c.fillRect(0, 14, 4, 11);
        c.fillStyle = capeHighlight;
        c.fillRect(1, 15, 2, 4);
        c.fillStyle = capeShade;
        c.fillRect(0, 22, 4, 3);
        return canvas;
      }

      // Idle draped cape
      c.fillStyle = capeBorder;
      c.fillRect(1, 14, 4, 13);
      c.fillStyle = capeGold;
      c.fillRect(2, 15, 3, 11);
      c.fillStyle = capeShade;
      c.fillRect(2, 23, 3, 3);
      return canvas;
    };

    this.marioCapeIdle = makeCapeSprite(superIdle, superPalette, 'idle');
    this.marioCapeRun1 = makeCapeSprite(superRun1, superPalette, 'run');
    this.marioCapeRun2 = makeCapeSprite(superRun2, superPalette, 'run');
    this.marioCapeRun3 = makeCapeSprite(superRun3, superPalette, 'run');
    this.marioCapeJump = makeCapeSprite(superJump, superPalette, 'jump');
    this.marioCapeGlide1 = makeCapeSprite(superJump, superPalette, 'glide1');
    this.marioCapeGlide2 = makeCapeSprite(superJump, superPalette, 'glide2');
    this.marioCapeSpin1 = makeCapeSprite(superRun2, superPalette, 'spin1');
    this.marioCapeSpin2 = makeCapeSprite(superRun3, superPalette, 'spin2');
    this.marioCapeSkid = makeCapeSprite(superRun1, superPalette, 'run');
    this.marioCapeCrouch = makeCapeSprite(superCrouch, superPalette, 'crouch');
    this.marioCapeSlide = makeCapeSprite(superRun1, superPalette, 'idle');

    this.wazzimaCapeIdle = makeCapeSprite(superIdle, wazzimaSuperPalette, 'idle');
    this.wazzimaCapeRun1 = makeCapeSprite(superRun1, wazzimaSuperPalette, 'run');
    this.wazzimaCapeRun2 = makeCapeSprite(superRun2, wazzimaSuperPalette, 'run');
    this.wazzimaCapeRun3 = makeCapeSprite(superRun3, wazzimaSuperPalette, 'run');
    this.wazzimaCapeJump = makeCapeSprite(superJump, wazzimaSuperPalette, 'jump');
    this.wazzimaCapeGlide1 = makeCapeSprite(superJump, wazzimaSuperPalette, 'glide1');
    this.wazzimaCapeGlide2 = makeCapeSprite(superJump, wazzimaSuperPalette, 'glide2');
    this.wazzimaCapeSpin1 = makeCapeSprite(superRun2, wazzimaSuperPalette, 'spin1');
    this.wazzimaCapeSpin2 = makeCapeSprite(superRun3, wazzimaSuperPalette, 'spin2');
    this.wazzimaCapeSkid = makeCapeSprite(superRun1, wazzimaSuperPalette, 'run');
    this.wazzimaCapeCrouch = makeCapeSprite(superCrouch, wazzimaSuperPalette, 'crouch');
    this.wazzimaCapeSlide = makeCapeSprite(superRun1, wazzimaSuperPalette, 'idle');

    // Tanooki Mario Palette
    const tanookiPalette: Record<string, string> = {
      '.': 'transparent',
      'T': '#944400', // Tanooki chestnut brown fur & cap
      'D': '#4c2000', // Dark brown / outline / tail stripes
      'C': '#fcd8a4', // Warm cream belly patch
      'S': NES_COLORS.MARIO_SKIN, // Face & hands
      'B': '#000000', // Eyes / boots
      'W': '#ffffff', // Eye glint / tail highlight
      'E': '#6c3008', // Inner ear shadow
      'R': '#d82800', // Red collar
    };

    const statuePalette: Record<string, string> = {
      '.': 'transparent',
      'T': '#808080',
      'D': '#404040',
      'C': '#b0b0b0',
      'S': '#989898',
      'B': '#202020',
      'W': '#d8d8d8',
      'E': '#585858',
      'R': '#a0a0a0',
    };

    const tanookiIdle = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTTTRTTT....',
      '...TTTTTRTTTT...',
      '..TTCCCCDCCCCT..',
      '..TTCCCCCCCTTT..',
      '..SSTCCCCCCTTS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '...DTTTTTTTTD...',
      '..DDTTTTTTTTDD..',
      '..DD.TT..TT.DD..',
      '..DD.TT..TT.DD..',
      '..DD.TT..TT.DD..',
      '..DD.TT..TT.DD..',
      '.....TT..TT.....',
      '....BBBB.BBBB...',
      '....BBBB.BBBB...',
      '...BBBBB.BBBBB..',
      '..BBBBBB.BBBBBB.',
      '..BBBBBB.BBBBBB.',
    ];

    const tanookiRun1 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTRTTTTT....',
      '...TTTRRTTTTT...',
      '..TTTRRRTTTTTT..',
      '..SSTTTTTTTTTS..',
      '..SSSTTTTTTTSS..',
      '...SSTTTTTTSS...',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '.....TTTTTTTT...',
      '.....TTTTTTTTD..',
      '......TTTTTTTDD.',
      '......TTTTTTTDD.',
      '.......TTTTTT.DD',
      '.......TTTTTT...',
      '........TTTTT...',
      '........TTTTT...',
      '........BBBB....',
      '.......BBBBB....',
      '......BBBBBB....',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
    ];

    const tanookiRun2 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTTTRTTT....',
      '...TTTTTRTTTT...',
      '..TTCCCCDCCCCT..',
      '..TTCCCCCCCTTT..',
      '..SSTCCCCCCTTS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...BBBB..TTTD...',
      '...BBBB..TTTDD..',
      '..BBBBB...TTDD..',
      '..BBBBB...TT.DD.',
      '..BBBBB....BBBB.',
      '.BBBBBB...BBBBBB',
      '..........BBBBBB',
      '..........BBBBBB',
      '...........BBBBB',
      '...........BBBBB',
    ];

    const tanookiRun3 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTRTTTTT....',
      '...TTTRRTTTTT...',
      '..TTTRRRTTTTTT..',
      '..SSTTTTTTTTTS..',
      '..SSSSRRRRTTSS..',
      '...SSSRRRRTSS...',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '.....TTTTTTTT...',
      '.....TTTTTTTT...',
      '......TTTTTTT...',
      '......TTTTTTT...',
      '.......TTTTTTD..',
      '.......TTTTTTDD.',
      '........TTTTT.DD',
      '........TTTTT...',
      '........BBBB....',
      '.......BBBBB....',
      '......BBBBBB....',
      '.....BBBBBBB....',
      '....BBBBBBBB....',
    ];

    const tanookiJump = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '..SSTTRTTTTTSS..',
      '..SSTTTRRTTTSS..',
      '..SSTTTTTTTTSS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '..TTTT.DD.TTTT..',
      '..TTTT.DD.TTTT..',
      '..TTT..DD..TTT..',
      '..TTT..DD..TTT..',
      '.BBBB..DD..BBBB.',
      '.BBBB..DD..BBBB.',
      '.......DD.......',
      '......DDDD......',
      '.....DCDDCD.....',
      '.....DCDDCD.....',
      '......DDDD......',
      '.......DD.......',
    ];

    const tanookiTailSpin1 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTTTRTTT....',
      '...TTTTTRTTTT...',
      '..TTCCCCDCCCCT..',
      '..TTCCCCCCCTTT..',
      '..SSTCCCCCCTTS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '...DTTTTTTTTD...',
      '..DDTTTTTTTTDD..',
      '..DD.TT..TT.DD..',
      '..DD.TT..TT.DD..',
      '.....TT..TT.DDD.',
      '....BBBB.BBBDCDD',
      '....BBBB.BBBDCDD',
      '...BBBBB.BBBDDD.',
      '..BBBBBB.BBBB...',
      '..BBBBBB.BBBB...',
      '................',
      '................',
      '................',
    ];

    const tanookiTailSpin2 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '..TTTTTTTTTTTT..',
      '..TTTTTTTTTTTT..',
      '..TTTTTTTTTTTT..',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '..TTTTTTTTTTTT..',
      '..SSTTTTTTTTTS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '....TTDDDDTT....',
      '...TTDDDCDDTT...',
      '..TTTDDDCDDTTT..',
      '..TTTTDDDDTTTT..',
      '..TTTT....TTTT..',
      '..TTTT....TTTT..',
      '..TTTT....TTTT..',
      '..TTTT....TTTT..',
      '....BBBB.BBBB...',
      '....BBBB.BBBB...',
      '...BBBBB.BBBBB..',
      '..BBBBBB.BBBBBB.',
      '..BBBBBB.BBBBBB.',
      '................',
    ];

    const tanookiTailSpin3 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DBSSBDD......',
      '..DBSBSSBSDD....',
      '..DSSBSSBSSD....',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTTTRTTT....',
      '...TTTTTRTTTT...',
      '..TTCCCCDCCCCT..',
      '..TTCCCCCCCTTT..',
      '..SSTCCCCCCTTS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '...DTTTTTTTTD...',
      '..DDTTTTTTTTDD..',
      '..DD.TT..TT.DD..',
      '.DDD.TT..TT.DD..',
      'DDCD.TT..TT.....',
      'DDCD.BBBB.BBBB..',
      '.DDD.BBBB.BBBB..',
      '....BBBBB.BBBBB.',
      '...BBBBBB.BBBBBB',
      '...BBBBBB.BBBBBB',
      '................',
      '................',
      '................',
    ];

    const tanookiFlutter1 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '..SSTTRTTTTTSS..',
      '..SSTTTRRTTTSS..',
      '..SSTTTTTTTTSS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '..TTTT....TTTT..',
      '..TTTT....TTTT..',
      '..TTT......TTT..',
      '.BBBB......BBBB.',
      '.BBBB......BBBB.',
      '......DDDD......',
      '.....DCDDCD.....',
      '.....DCDDCD.....',
      '......DDDD......',
      '.......DD.......',
      '................',
      '................',
    ];

    const tanookiFlutter2 = [
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSSD...',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '..SSTTRTTTTTSS..',
      '..SSTTTRRTTTSS..',
      '..SSTTTTTTTTSS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '..TTTT.DD.TTTT..',
      '..TTTTDCDDTTTT..',
      '..TTTDCDD..TTT..',
      '.BBBB.DD...BBBB.',
      '.BBBB......BBBB.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];

    const tanookiCrouch = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..EE......EE....',
      '.ETTE....ETTE...',
      '..TTT....TTT....',
      '....TTTTTT......',
      '...TTTTTTTTTT...',
      '...DDBSSBD......',
      '..DDSBSSBSBD....',
      '..DDSBBSSBSS....',
      '..DDDSSSSDDDD...',
      '....SSSSSSSS....',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..SSTTTTTTTTSS..',
      '..SSSTTTTTTSSS..',
      '...SSTTTTTTSS...',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..TTTTTTTTTTTT..',
      '.TTTTTTTTTTTTTT.',
      'TTTTTTTTTTTTTTDD',
      'TTTTTTTTTTTTTDD.',
      'BBBBBBBBBBBB.DD.',
      'BBBBBBBBBBBB....',
      '................',
      '................',
    ];

    this.marioTanookiIdle = makeSprite(tanookiIdle, tanookiPalette, 16, 32);
    this.marioTanookiRun1 = makeSprite(tanookiRun1, tanookiPalette, 16, 32);
    this.marioTanookiRun2 = makeSprite(tanookiRun2, tanookiPalette, 16, 32);
    this.marioTanookiRun3 = makeSprite(tanookiRun3, tanookiPalette, 16, 32);
    this.marioTanookiJump = makeSprite(tanookiJump, tanookiPalette, 16, 32);
    this.marioTanookiSkid = makeSprite(tanookiRun1, tanookiPalette, 16, 32);
    this.marioTanookiCrouch = makeSprite(tanookiCrouch, tanookiPalette, 16, 32);
    this.marioTanookiSlide = makeSprite(tanookiRun1, tanookiPalette, 16, 32);
    this.marioTanookiTailSpin1 = makeSprite(tanookiTailSpin1, tanookiPalette, 16, 32);
    this.marioTanookiTailSpin2 = makeSprite(tanookiTailSpin2, tanookiPalette, 16, 32);
    this.marioTanookiTailSpin3 = makeSprite(tanookiTailSpin3, tanookiPalette, 16, 32);
    this.marioTanookiTailSpin4 = makeSprite(tanookiTailSpin1, tanookiPalette, 16, 32);
    this.marioTanookiFlutter1 = makeSprite(tanookiFlutter1, tanookiPalette, 16, 32);
    this.marioTanookiFlutter2 = makeSprite(tanookiFlutter2, tanookiPalette, 16, 32);
    this.marioTanookiStatue = makeSprite(tanookiCrouch, statuePalette, 16, 32);

    // WazzimaGiygg ("Mario Verde") Tanooki Sprites
    const wazzimaTanookiPalette: Record<string, string> = {
      '.': 'transparent',
      'T': '#1b7029', // Forest green raccoon fur
      'D': '#0b3d14', // Dark moss green outline/stripes
      'C': '#c8f0b0', // Pale mint belly patch
      'S': NES_COLORS.MARIO_SKIN,
      'B': '#000000',
      'W': '#ffffff',
      'E': '#105018',
      'R': '#00a800',
    };
    this.wazzimaTanookiIdle = makeSprite(tanookiIdle, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiRun1 = makeSprite(tanookiRun1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiRun2 = makeSprite(tanookiRun2, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiRun3 = makeSprite(tanookiRun3, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiJump = makeSprite(tanookiJump, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiSkid = makeSprite(tanookiRun1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiCrouch = makeSprite(tanookiCrouch, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiSlide = makeSprite(tanookiRun1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiTailSpin1 = makeSprite(tanookiTailSpin1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiTailSpin2 = makeSprite(tanookiTailSpin2, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiTailSpin3 = makeSprite(tanookiTailSpin3, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiTailSpin4 = makeSprite(tanookiTailSpin1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiFlutter1 = makeSprite(tanookiFlutter1, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiFlutter2 = makeSprite(tanookiFlutter2, wazzimaTanookiPalette, 16, 32);
    this.wazzimaTanookiStatue = makeSprite(tanookiCrouch, statuePalette, 16, 32);
  }

  private generateEnemies() {
    const goombaPalette = {
      '.': 'transparent',
      'D': NES_COLORS.GOOMBA_DARK,
      'L': NES_COLORS.GOOMBA_LIGHT,
      'F': NES_COLORS.GOOMBA_FOOT,
      'W': NES_COLORS.WHITE,
    };

    const goomba1 = [
      '......DDDD......',
      '.....DDDDDD.....',
      '....DDDDDDDD....',
      '...DDDDDDDDDD...',
      '..LLLLLLLLLLLL..',
      '..LLWLLLLLLWLL..',
      '..LWDDLLLLDWLL..',
      '..LWDDLLLLDWLL..',
      '..LLWLLLLLLWLL..',
      '...LLLLLLLLLL...',
      '....LLLLLLLL....',
      '....LLDDDDLL....',
      '...DDDDDDDDDD...',
      '..FFFFF..FFFFF..',
      '.FFFFF....FFFFF.',
      '..FFF......FFF..',
    ];

    const goomba2 = [
      '......DDDD......',
      '.....DDDDDD.....',
      '....DDDDDDDD....',
      '...DDDDDDDDDD...',
      '..LLLLLLLLLLLL..',
      '..LLWLLLLLLWLL..',
      '..LWDDLLLLDWLL..',
      '..LWDDLLLLDWLL..',
      '..LLWLLLLLLWLL..',
      '...LLLLLLLLLL...',
      '....LLLLLLLL....',
      '....LLDDDDLL....',
      '...DDDDDDDDDD...',
      '.FFFFF....FFFFF.',
      '..FFFFF..FFFFF..',
      '...FFF....FFF...',
    ];

    const goombaFlat = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....DDDDDDDD....',
      '..LLLWLLLLWLLL..',
      '.LLLLWDDDDWLLLL.',
      'DDDDDDDDDDDDDDDD',
      'FFFFFFFFFFFFFFFF',
      '.FFFFFFFFFFFFFF.',
    ];

    const [g1, ctxG1] = createOffscreen(16, 16);
    drawPixelGrid(ctxG1, goomba1, goombaPalette);
    this.goombaWalk1 = g1;

    const [g2, ctxG2] = createOffscreen(16, 16);
    drawPixelGrid(ctxG2, goomba2, goombaPalette);
    this.goombaWalk2 = g2;

    const [gf, ctxGf] = createOffscreen(16, 16);
    drawPixelGrid(ctxGf, goombaFlat, goombaPalette);
    this.goombaSquashed = gf;

    // Koopa Troopa (16x24 / scaled)
    const koopaPalette = {
      '.': 'transparent',
      'G': NES_COLORS.KOOPA_GREEN,
      'L': NES_COLORS.KOOPA_LIGHT_GREEN,
      'B': NES_COLORS.KOOPA_BELLY,
      'D': NES_COLORS.KOOPA_DARK,
      'W': NES_COLORS.WHITE,
      'K': NES_COLORS.BLACK,
      'S': NES_COLORS.MARIO_SKIN,
    };

    const koopa1 = [
      '......GGGG......',
      '.....GGLLGG.....',
      '....GLLLLLLG....',
      '...GLLKWLLLLG...',
      '...GLLKWLLLLG...',
      '...GLLLLLLLLG...',
      '....GLLSSLLG....',
      '.....GSSSG......',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '..GLLLLLLLLLLG..',
      '..GLLLLLLLLLLG..',
      '..GBBBBBBBBBBG..',
      '..GBBBBBBBBBBG..',
      '...GBBBBBBBBG...',
      '...GGGGGGGGGG...',
      '....G......G....',
      '...SSS....SSS...',
      '..SSSS....SSSS..',
      '..SSSS....SSSS..',
      '................',
      '................',
      '................',
      '................',
    ];

    const koopa2 = [
      '......GGGG......',
      '.....GGLLGG.....',
      '....GLLLLLLG....',
      '...GLLKWLLLLG...',
      '...GLLKWLLLLG...',
      '...GLLLLLLLLG...',
      '....GLLSSLLG....',
      '.....GSSSG......',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '..GLLLLLLLLLLG..',
      '..GLLLLLLLLLLG..',
      '..GBBBBBBBBBBG..',
      '..GBBBBBBBBBBG..',
      '...GBBBBBBBBG...',
      '...GGGGGGGGGG...',
      '.....G....G.....',
      '....SSS..SSS....',
      '...SSSS..SSSS...',
      '...SSSS..SSSS...',
      '................',
      '................',
      '................',
      '................',
    ];

    const koopaShellPattern = [
      '................',
      '................',
      '................',
      '................',
      '.....GGGGGG.....',
      '...GGLLLLLLGG...',
      '..GLLLLLLLLLLG..',
      '.GLLDGGLLGGDLLG.',
      '.GLLGWWLLWWGLLG.',
      'GBBBBBBBBBBBBBBG',
      'GBBBBBBBBBBBBBBG',
      '.GBBBBBBBBBBBBG.',
      '..GGGGGGGGGGGG..',
      '....GGGGGGGG....',
      '................',
      '................',
    ];

    const [k1, ctxK1] = createOffscreen(16, 24);
    drawPixelGrid(ctxK1, koopa1, koopaPalette);
    this.koopaWalk1 = k1;

    const [k2, ctxK2] = createOffscreen(16, 24);
    drawPixelGrid(ctxK2, koopa2, koopaPalette);
    this.koopaWalk2 = k2;

    const [ks, ctxKs] = createOffscreen(16, 16);
    drawPixelGrid(ctxKs, koopaShellPattern, koopaPalette);
    this.koopaShell = ks;

    // Red Koopa (Fast patrolling Koopa with crimson shell)
    const redKoopaPalette = {
      '.': 'transparent',
      'G': '#b81c00',
      'L': '#fc5838',
      'B': '#fce078',
      'D': '#600800',
      'W': NES_COLORS.WHITE,
      'K': NES_COLORS.BLACK,
      'S': NES_COLORS.MARIO_SKIN,
    };

    const [rk1, ctxRk1] = createOffscreen(16, 24);
    drawPixelGrid(ctxRk1, koopa1, redKoopaPalette);
    this.redKoopaWalk1 = rk1;

    const [rk2, ctxRk2] = createOffscreen(16, 24);
    drawPixelGrid(ctxRk2, koopa2, redKoopaPalette);
    this.redKoopaWalk2 = rk2;

    const [rks, ctxRks] = createOffscreen(16, 16);
    drawPixelGrid(ctxRks, koopaShellPattern, redKoopaPalette);
    this.redKoopaShell = rks;

    // Winged Red Paratroopa (16x24, flapping white wings)
    const paratroopa1Pattern = [
      '......GGGG......',
      '.....GGLLGG.....',
      '....GLLLLLLG....',
      '...GLLKWLLLLG...',
      '...GLLKWLLLLG...',
      '...GLLLLLLLLG.WW',
      '....GLLSSLLG.WWW',
      '.....GSSSG..WWKW',
      '....GGGGGGGGWWWK',
      '...GGGGGGGGGGWWK',
      '..GLLLLLLLLLLGW.',
      '..GLLLLLLLLLLG..',
      '..GBBBBBBBBBBG..',
      '..GBBBBBBBBBBG..',
      '...GBBBBBBBBG...',
      '...GGGGGGGGGG...',
      '....G......G....',
      '...SSS....SSS...',
      '..SSSS....SSSS..',
      '..SSSS....SSSS..',
      '................',
      '................',
      '................',
      '................',
    ];

    const paratroopa2Pattern = [
      '......GGGG......',
      '.....GGLLGG.....',
      '....GLLLLLLG....',
      '...GLLKWLLLLG...',
      '...GLLKWLLLLG...',
      '...GLLLLLLLLG...',
      '....GLLSSLLG....',
      '.....GSSSG......',
      '....GGGGGGGG....',
      '...GGGGGGGGGGWW.',
      '..GLLLLLLLLLLWWW',
      '..GLLLLLLLLLLGWK',
      '..GBBBBBBBBBBGWK',
      '..GBBBBBBBBBBGWW',
      '...GBBBBBBBBG..K',
      '...GGGGGGGGGG...',
      '.....G....G.....',
      '....SSS..SSS....',
      '...SSSS..SSSS...',
      '...SSSS..SSSS...',
      '................',
      '................',
      '................',
      '................',
    ];

    const [pt1, ctxPt1] = createOffscreen(16, 24);
    drawPixelGrid(ctxPt1, paratroopa1Pattern, redKoopaPalette);
    this.paratroopa1 = pt1;

    const [pt2, ctxPt2] = createOffscreen(16, 24);
    drawPixelGrid(ctxPt2, paratroopa2Pattern, redKoopaPalette);
    this.paratroopa2 = pt2;

    // Hammer Brother (16x24 green-helmeted Koopa warrior facing left)
    const hammerBroPalette = {
      '.': 'transparent',
      'K': '#000000',
      'G': '#00a800',
      'L': '#58d838',
      'W': '#ffffff',
      'S': NES_COLORS.MARIO_SKIN,
      'B': '#fce078',
      'M': '#883800',
      'H': '#606878',
    };

    const hammerBroWalk1Pattern = [
      '.....KKKKKK.....',
      '....KGGGGGGK....',
      '...KGGGLLGGGK...',
      '...KGWWWWWWGK...',
      '..KGGWKKWWKKGK..',
      '..KGGSSKKSSKK...',
      '...KSSSSSSSSK...',
      '....KSSSSSSK....',
      '...KKGGGGGGKK...',
      '..KGGLLLLLLGGK..',
      '.KGGLLLLLLLLGGK.',
      '.KGGGBBBBBBBGGK.',
      '..KMMBBBBBBBGGK.',
      '.KHHMBBBBBBBGGK.',
      '.KHHKGGGGGGGGK..',
      '..KKKGGGGGGGK...',
      '....KGG..GGK....',
      '...KSSK..KSSK...',
      '..KSSSK..KSSSK..',
      '..KKKK....KKKK..',
      '................',
      '................',
      '................',
      '................',
    ];

    const hammerBroWalk2Pattern = [
      '.....KKKKKK.....',
      '....KGGGGGGK....',
      '...KGGGLLGGGK...',
      '...KGWWWWWWGK...',
      '..KGGWKKWWKKGK..',
      '..KGGSSKKSSKK...',
      '...KSSSSSSSSK...',
      '....KSSSSSSK....',
      '...KKGGGGGGKK...',
      '..KGGLLLLLLGGK..',
      '.KGGLLLLLLLLGGK.',
      '.KGGGBBBBBBBGGK.',
      '..KGGMBBBBBBBGK.',
      '..KHHMBBBBBBBGK.',
      '..KHHKGGGGGGGK..',
      '...KKKGGGGGGK...',
      '.....KG..GGK....',
      '....KSSKKSSK....',
      '...KSSSKKSSSK...',
      '...KKKK..KKKK...',
      '................',
      '................',
      '................',
      '................',
    ];

    const hammerBroThrowPattern = [
      '..KHHK..........',
      '.KHHMK..........',
      '..KMMKKKKKK.....',
      '...KGGGGGGGGK...',
      '...KGGGLLGGGK...',
      '...KGWWWWWWGK...',
      '..KGGWKKWWKKGK..',
      '..KGGSSKKSSKK...',
      '...KSSSSSSSSK...',
      '..KKSSSSSSSSK...',
      '.KSSKGGGGGGKK...',
      '..KKGGLLLLLLGK..',
      '..KGGLLLLLLLGGK.',
      '..KGGGBBBBBBBGK.',
      '..KGGGBBBBBBBGK.',
      '...KKGGGGGGGGK..',
      '....KGG..GGK....',
      '...KSSK..KSSK...',
      '..KSSSK..KSSSK..',
      '..KKKK....KKKK..',
      '................',
      '................',
      '................',
      '................',
    ];

    const [hb1, ctxHb1] = createOffscreen(16, 24);
    drawPixelGrid(ctxHb1, hammerBroWalk1Pattern, hammerBroPalette);
    this.hammerBroWalk1 = hb1;

    const [hb2, ctxHb2] = createOffscreen(16, 24);
    drawPixelGrid(ctxHb2, hammerBroWalk2Pattern, hammerBroPalette);
    this.hammerBroWalk2 = hb2;

    const [hbT, ctxHbT] = createOffscreen(16, 24);
    drawPixelGrid(ctxHbT, hammerBroThrowPattern, hammerBroPalette);
    this.hammerBroThrow = hbT;

    // Rotating Hammer Projectile (12x12, 4 spin orientations)
    const hammerSpinPatterns: string[][] = [
      [
        '..KKKKKK....',
        '.KHHHHHHK...',
        '.KHWWHHHK...',
        '.KHHHHHHK...',
        '..KKKKKK....',
        '....KMK.....',
        '....KMK.....',
        '....KMK.....',
        '....KMK.....',
        '....KMK.....',
        '....KKK.....',
        '............',
      ],
      [
        '.....KKKK...',
        '....KHHHHK..',
        '....KHWWKHK.',
        '..KKKHHHHHK.',
        '.KMMKKKKKK..',
        'KMMK........',
        'KMK.........',
        '.K..........',
        '............',
        '............',
        '............',
        '............',
      ],
      [
        '............',
        '....KKK.....',
        '....KMK.....',
        '....KMK.....',
        '....KMK.....',
        '....KMK.....',
        '..KKKKKK....',
        '.KHHHHHHK...',
        '.KHHHWWHK...',
        '.KHHHHHHK...',
        '..KKKKKK....',
        '............',
      ],
      [
        '............',
        '............',
        '.........K..',
        '........KMK.',
        '.......KMMK.',
        '..KKKKKKMMK.',
        '.KHHHHHKMK..',
        '.KHWWKHHK...',
        '..KHHHHK....',
        '...KKKK.....',
        '............',
        '............',
      ],
    ];
    this.hammerFrames = hammerSpinPatterns.map(pat => {
      const [cH, ctxH] = createOffscreen(12, 12);
      drawPixelGrid(ctxH, pat, hammerBroPalette);
      return cH;
    });

    // Piranha Plant
    const piranhaPalette = {
      '.': 'transparent',
      'R': NES_COLORS.PIRANHA_RED,
      'W': NES_COLORS.WHITE,
      'G': NES_COLORS.PIRANHA_STEM,
    };

    const piranhaPattern1 = [
      '.....RRRRRR.....',
      '...RRWWWWWWWR...',
      '..RRWWRRRRRWRR..',
      '..RWWRRRRRRRWR..',
      '..RWRRRWWWRRWR..',
      '..RWRRWWWWWRWR..',
      '..RRWWRWWWRWRR..',
      '...RRWWWWWWWR...',
      '.....RRRRRR.....',
      '......GGGG......',
      '....GGGGGGGG....',
      '....GGGGGGGG....',
      '......GGGG......',
      '......GGGG......',
      '......GGGG......',
      '......GGGG......',
    ];

    const piranhaPattern2 = [
      '.....RRRRRR.....',
      '...RRWWWWWWWR...',
      '..RRWWRRRRRWRR..',
      '..RWWRRRRRRRWR..',
      '..RWRRRRRRRRWR..',
      '..RWRRRRRRRRWR..',
      '..RRWWRRRRRWRR..',
      '...RRWWWWWWWR...',
      '.....RRRRRR.....',
      '......GGGG......',
      '....GGGGGGGG....',
      '....GGGGGGGG....',
      '......GGGG......',
      '......GGGG......',
      '......GGGG......',
      '......GGGG......',
    ];

    const [p1, ctxP1] = createOffscreen(16, 16);
    drawPixelGrid(ctxP1, piranhaPattern1, piranhaPalette);
    this.piranha1 = p1;

    const [p2, ctxP2] = createOffscreen(16, 16);
    drawPixelGrid(ctxP2, piranhaPattern2, piranhaPalette);
    this.piranha2 = p2;

    // Blooper (Underwater Squid 16x16)
    const blooperPalette = {
      '.': 'transparent',
      'W': '#ffffff',
      'S': '#c8e0fc',
      'K': '#000000',
      'P': '#fca0c8',
    };

    const blooperPattern1 = [
      '......WWWW......',
      '....WWWWWWWW....',
      '...WWWWWWWWWW...',
      '..WWWWWWWWWWWW..',
      '..WWKKWWWWKKWW..',
      '.WWWKKWWWWKKWWW.',
      '.WWWKWKKKKWKWWW.',
      '.WWWWWWWWWWWWWW.',
      '..WWPPPPPPPPWW..',
      '...WWWWWWWWWW...',
      '..WW.WW..WW.WW..',
      '.WW..WW..WW..WW.',
      '.W...W....W...W.',
      '................',
      '................',
      '................',
    ];

    const blooperPattern2 = [
      '.......WW.......',
      '.....WWWWWW.....',
      '....WWWWWWWW....',
      '...WWWWWWWWWW...',
      '...WWKKWWKKWW...',
      '..WWWKKWWKKWWW..',
      '..WWWSKKKKWSWW..',
      '..WWWWWWWWWWWW..',
      '...WWPPPPPPWW...',
      '....WWWWWWWW....',
      '....WWWWWWWW....',
      '....WW.WW.WW....',
      '....W..WW..W....',
      '.......WW.......',
      '................',
      '................',
    ];

    const [b1, ctxB1] = createOffscreen(16, 16);
    drawPixelGrid(ctxB1, blooperPattern1, blooperPalette);
    this.blooper1 = b1;

    const [b2, ctxB2] = createOffscreen(16, 16);
    drawPixelGrid(ctxB2, blooperPattern2, blooperPalette);
    this.blooper2 = b2;

    // Cheep-Cheep (Underwater Fish 16x16 facing left)
    const cheepPalette = {
      '.': 'transparent',
      'R': '#e82800',
      'O': '#fc7438',
      'Y': '#fce078',
      'W': '#ffffff',
      'K': '#000000',
    };

    const cheepPattern1 = [
      '......RRRR......',
      '....RRRRRRRR....',
      '...RROOOOOORR...',
      '..RWWKRRRRRRYR..',
      '.RWWWKRRRRYYYYR.',
      '.RWWKKRRRRYYRRR.',
      'KRRRRRRRRYYRRRRR',
      'KRRRRRRRYYYRRRRR',
      '.RRRRROOYYRRRROR',
      '.RWWWWWWWWWRROOR',
      '..WWWWWWWWWW.RRR',
      '...WWWWWWWW....R',
      '....YYYYYY......',
      '.....YYYY.......',
      '................',
      '................',
    ];

    const cheepPattern2 = [
      '......RRRR......',
      '....RRRRRRRR....',
      '...RROOOOOORR...',
      '..RWWKRRRRRRRR..',
      '.RWWWKRRRRRRRRYR',
      '.RWWKKRRRRRRYYYY',
      'KRRRRRRRRRRRRRRR',
      'KRRRRRRRYRRRRRRR',
      '.RRRRROOYYRRRRO.',
      '.RWWWWWWYYYRROR.',
      '..WWWWWWYYWW.RR.',
      '...WWWWWWWW.....',
      '....YYYYYY......',
      '................',
      '................',
      '................',
    ];

    const [cc1, ctxCc1] = createOffscreen(16, 16);
    drawPixelGrid(ctxCc1, cheepPattern1, cheepPalette);
    this.cheepCheep1 = cc1;

    const [cc2, ctxCc2] = createOffscreen(16, 16);
    drawPixelGrid(ctxCc2, cheepPattern2, cheepPalette);
    this.cheepCheep2 = cc2;

    // Fast Turbo Cheep-Cheep (Golden/Magenta darting fish 16x16)
    const fastCheepPalette = {
      '.': 'transparent',
      'R': '#d81888',
      'O': '#fc74b4',
      'Y': '#fce030',
      'W': '#ffffff',
      'K': '#000000',
    };

    const [fc1, ctxFc1] = createOffscreen(16, 16);
    drawPixelGrid(ctxFc1, cheepPattern1, fastCheepPalette);
    this.fastCheep1 = fc1;

    const [fc2, ctxFc2] = createOffscreen(16, 16);
    drawPixelGrid(ctxFc2, cheepPattern2, fastCheepPalette);
    this.fastCheep2 = fc2;

    // Bullet Bill (16x16 facing left)
    const bulletPalette = {
      '.': 'transparent',
      'K': '#101018',
      'G': '#404858',
      'S': '#a8b0c0',
      'W': '#ffffff',
    };

    const bulletPattern = [
      '................',
      '.....KKKKKKKKKK.',
      '...KKSSSSSSSSKK.',
      '..KKGGGGGGGGGGKK',
      '.KKWWKKKKKKKKKKK',
      '.KWWWSKKKKKKKKGG',
      'KKWWKKKKKKKKKKGG',
      'KKKKKKKKKKKKKKGG',
      'KKKKWWKKKKKKKKGG',
      'KKKWWWWKKKKKKKGG',
      'KKKKWWKKKKKKKKKK',
      '.KKKKKKKKKKKKKKK',
      '.KKGGGGGGGGGGGKK',
      '..KKKKKKKKKKKKK.',
      '....KKKKKKKKKK..',
      '................',
    ];

    const [bb, ctxBb] = createOffscreen(16, 16);
    drawPixelGrid(ctxBb, bulletPattern, bulletPalette);
    this.bulletBill = bb;

    // Bowser (Castle Boss 24x24 facing left)
    const bowserPalette = {
      '.': 'transparent',
      'K': '#000000',
      'G': '#00a800',
      'L': '#80d010',
      'R': '#d82800',
      'O': '#fc9838',
      'Y': '#fce078',
      'W': '#ffffff',
    };

    const bowserPattern1 = [
      '.....KK.................',
      '....KWWK...KK...........',
      '...KWWWK..KRRK..........',
      '..KGGGGKKKRRRK..........',
      '.KGGGLLLLGGGGKKK........',
      '.KGGKWWKGGGGKWWK........',
      'KGGGKWKKGGGGGKWK.KK.....',
      'KGGGGGGGGGGGGGGKKWWK....',
      'KYYYGGGGGGGGGGGKWWWK....',
      'KWWKYGGGGGGGGGGKGGGK....',
      '.KK.KRRRRRRGGGGKGGGK.KK.',
      '...KYYYYYYKGGGGGGGGKKWWK',
      '..KYYYYYYYKGGGGGGGGKWWWK',
      '..KYYYYYYYKGGGGGGGGKGGGK',
      '..KYYYYYYKGGGGGGGGGGKGGK',
      '...KYYYYKGGGGGGGGGGKWWWK',
      '....KYYYKGGGGGGGGGGKGGGK',
      '....KGGGGGGGGGGGGGGKGGK.',
      '....KGGGGGGKKGGGGGGKK...',
      '...KGGGGGGK..KGGGGGK....',
      '...KGGGGGKK..KGGGGGKK...',
      '..KWWKWWKK....KWWKWWKK..',
      '..KKKKKKK.....KKKKKKKK..',
      '........................',
    ];

    const bowserPattern2 = [
      '.....KK.................',
      '....KWWK...KK...........',
      '...KWWWK..KRRK..........',
      '..KGGGGKKKRRRK..........',
      '.KGGGLLLLGGGGKKK........',
      '.KGGKWWKGGGGKWWK........',
      'KGGGKWKKGGGGGKWK.KK.....',
      'KGGGGGGGGGGGGGGKKWWK....',
      'KYYYGGGGGGGGGGGKWWWK....',
      'KWWKKGGGGGGGGGGKGGGK....',
      'KOOOKRRRRRRGGGGKGGGK.KK.',
      'KWWKYGGGGGGGGGGGGGGKKWWK',
      '.KKKYYYYYYKGGGGGGGGKWWWK',
      '..KYYYYYYYKGGGGGGGGKGGGK',
      '..KYYYYYYKGGGGGGGGGGKGGK',
      '...KYYYYKGGGGGGGGGGKWWWK',
      '....KYYYKGGGGGGGGGGKGGGK',
      '....KGGGGGGGGGGGGGGKGGK.',
      '....KGGGGGGKKGGGGGGKK...',
      '....KGGGGGK..KGGGGGGK...',
      '....KGGGGKK..KGGGGGGKK..',
      '...KWWKWWKK...KWWKWWKK..',
      '...KKKKKKK....KKKKKKKK..',
      '........................',
    ];

    const [bw1, ctxBw1] = createOffscreen(24, 24);
    drawPixelGrid(ctxBw1, bowserPattern1, bowserPalette);
    this.bowser1 = bw1;

    const [bw2, ctxBw2] = createOffscreen(24, 24);
    drawPixelGrid(ctxBw2, bowserPattern2, bowserPalette);
    this.bowser2 = bw2;

    // Lava Bubble / Podoboo (16x16)
    const bubblePalette = {
      '.': 'transparent',
      'R': '#d82800',
      'O': '#fc7438',
      'Y': '#fce078',
      'W': '#ffffff',
    };
    const bubblePattern1 = [
      '.......RR.......',
      '......RRRR......',
      '.....ROOOOR.....',
      '....ROYYYYOR....',
      '...ROYYWWYYOR...',
      '...ROYWWWWYOR...',
      '..ROYYWWWWYYOR..',
      '..ROYYYYYYYYOR..',
      '..ROOOYYYYOOOR..',
      '...RROOOOOORR...',
      '...R.RROORR.R...',
      '.....R.RR.R.....',
      '....R..RR..R....',
      '.......R........',
      '................',
      '................',
    ];
    const bubblePattern2 = [
      '.......RR.......',
      '......ROOR......',
      '.....ROYYOR.....',
      '....ROYYYYOR....',
      '....ROYWWYOR....',
      '...ROYWWWWYOR...',
      '...ROYYYYYYOR...',
      '...ROOYYYYOOR...',
      '....RROOOORR....',
      '....R.RRRR.R....',
      '......RRRR......',
      '.....R.RR.R.....',
      '.......RR.......',
      '................',
      '................',
      '................',
    ];
    const [lb1, ctxLb1] = createOffscreen(16, 16);
    drawPixelGrid(ctxLb1, bubblePattern1, bubblePalette);
    this.lavaBubble1 = lb1;

    const [lb2, ctxLb2] = createOffscreen(16, 16);
    drawPixelGrid(ctxLb2, bubblePattern2, bubblePalette);
    this.lavaBubble2 = lb2;

    // Boo (Ghost House Phantom 16x16 facing left)
    const booPalette = {
      '.': 'transparent',
      'K': '#180c28',
      'W': '#ffffff',
      'S': '#c8d0ec',
      'P': '#f888b8',
      'R': '#d82058',
    };
    const booChasePattern = [
      '.....KKKKKK.....',
      '...KKWWWWWWKK...',
      '..KWWWWWWWWWWK..',
      '.KWWWKKWWKKWWWK.',
      '.KWWWSKWWKSWWWK.',
      'KWWWWKKWWKKWWWWK',
      'KWWWWWWWWWWWWWWK',
      'KWWKRRRRRRRRKWWK',
      'KKWRKWWRRRWKRRWK',
      'KWWKRRRRRRRRKWWK',
      'KWWWSKWWWWKSWWWK',
      '.KWWWSKKKKWWWWK.',
      '.KWWSSWWWWSSWWK.',
      '..KSSWWWWWWSSK..',
      '...KKSSSSSSKK...',
      '.....KKKKKK.....',
    ];
    const booShyPattern = [
      '.....KKKKKK.....',
      '...KKWWWWWWKK...',
      '..KWWWWWWWWWWK..',
      '.KWWWWWWWWWWWWK.',
      '.KWWKKKKKKKKWWK.',
      'KWWKWWWWWWWWKWWK',
      'KWWKWKKKKKKWKWWK',
      'KPPKWWKWWKWWKPPK',
      'KPPKWWKWWKWWKPPK',
      'KWWKKKKKKKKKKWWK',
      'KWWWWWWWWWWWWWWK',
      '.KWWWWWWWWWWWWK.',
      '.KWWSSWWWWSSWWK.',
      '..KSSWWWWWWSSK..',
      '...KKSSSSSSKK...',
      '.....KKKKKK.....',
    ];
    const [bChase, ctxBChase] = createOffscreen(16, 16);
    drawPixelGrid(ctxBChase, booChasePattern, booPalette);
    this.booChase = bChase;

    const [bShy, ctxBShy] = createOffscreen(16, 16);
    drawPixelGrid(ctxBShy, booShyPattern, booPalette);
    this.booShy = bShy;

    // Dry Bones (Skeletal Koopa 16x24 facing left)
    const dryBonesPalette = {
      '.': 'transparent',
      'K': '#141024',
      'W': '#fcfcfc',
      'S': '#b8c0d8',
      'G': '#687090',
      'R': '#e83838',
    };
    const dryBonesWalkPattern1 = [
      '....KKKKKK......',
      '...KWWWWWWKK....',
      '..KWWWWWWWWWK...',
      '.KWWKKWWWWWWK...',
      '.KWKRKWWWWWWWK..',
      '.KWWKKWWWSWWWK..',
      '.KWWWWWWSSSWK...',
      '..KWWWWWWWWK....',
      '..KKWKKKKWWK....',
      '...KKSSSSWWKK...',
      '..KKWWWWWWWWKK..',
      '.KWWSSKWWKSSWWK.',
      '.KWWWSKKKKWWWWK.',
      'KWWSSWWWWWWSSWWK',
      'KWWKWWWWWWWWKWWK',
      '.KKKSSWWWWSSKKK.',
      '..KWWWWWWWWWKK..',
      '..KKSSGGGGSSK...',
      '...KKKKKKWWKK...',
      '...KWWK..KWWK...',
      '..KWWWK..KWWK...',
      '..KKKKK..KWWWK..',
      '.........KKKKK..',
      '................',
    ];
    const dryBonesWalkPattern2 = [
      '....KKKKKK......',
      '...KWWWWWWKK....',
      '..KWWWWWWWWWK...',
      '.KWWKKWWWWWWK...',
      '.KWKRKWWWWWWWK..',
      '.KWWKKWWWSWWWK..',
      '.KWWWWWWSSSWK...',
      '..KWWWWWWWWK....',
      '..KKWKKKKWWK....',
      '...KKSSSSWWKK...',
      '..KKWWWWWWWWKK..',
      '.KWWSSKWWKSSWWK.',
      '.KWWWSKKKKWWWWK.',
      'KWWSSWWWWWWSSWWK',
      'KWWKWWWWWWWWKWWK',
      '.KKKSSWWWWSSKKK.',
      '..KWWWWWWWWWKK..',
      '..KKSSGGGGSSK...',
      '...KKKKWWKKKK...',
      '....KWWKKWWK....',
      '....KWWKKWWWK...',
      '....KKKK.KKKK...',
      '................',
      '................',
    ];
    const dryBonesCrumbledPattern = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......KKKKK.....',
      '.....KWWWWWK....',
      '....KWWKKWWWK...',
      '.KK.KWKRKWWWK...',
      'KWWKKWWKKWWK.KK.',
      'KWWWWSSSSWWKKWWK',
      '.KKKKKKKKWWKWWWK',
      '..KWWWWWWWWSSWK.',
      '.KWWSSSSSSKKKK..',
      '.KKKKKKKKKK.....',
    ];

    const [db1, ctxDb1] = createOffscreen(16, 24);
    drawPixelGrid(ctxDb1, dryBonesWalkPattern1, dryBonesPalette);
    this.dryBonesWalk1 = db1;

    const [db2, ctxDb2] = createOffscreen(16, 24);
    drawPixelGrid(ctxDb2, dryBonesWalkPattern2, dryBonesPalette);
    this.dryBonesWalk2 = db2;

    const [dbC, ctxDbC] = createOffscreen(16, 16);
    drawPixelGrid(ctxDbC, dryBonesCrumbledPattern, dryBonesPalette);
    this.dryBonesCrumbled = dbC;

    // Yoshi (SMW Green Dinosaur Mount 20x20 facing right)
    const yoshiPalette = {
      '.': 'transparent',
      'K': '#141020',
      'G': '#28c838',
      'D': '#108820',
      'L': '#70f870',
      'W': '#fcfcfc',
      'R': '#d82800',
      'O': '#f87818',
      'Y': '#fce078',
      'P': '#ff5a96',
    };
    const yoshiIdlePattern = [
      '.........KKKK.......',
      '........KWWWWK......',
      '.......KWWKWWWK.....',
      '......KGGWKWWGKKKK..',
      '......KGGGGLLGGGGGK.',
      '....KRKGGGGGGGGGGWWK',
      '....KKKGGWWWWWWGGGGK',
      '.....KRKWWWWWWGGGGKK',
      '......KKGGWWWWKKKK..',
      '....KKRRRRGGGKK.....',
      '..KKGGRRRRWWWGK.....',
      '.KGGGGKKKKWWWGK.....',
      'KKDGGGGGGGWWGGK.....',
      'KGGGGGGGGWWWWGK.....',
      '.KKKKGGGGGGDDKK.....',
      '....KGGDDGGGGK......',
      '....KGGK..KGGK......',
      '....KOOK..KOOK......',
      '...KOOOYK.KOOOYK....',
      '...KKKKKK.KKKKKK....',
    ];
    const yoshiWalkPattern = [
      '.........KKKK.......',
      '........KWWWWK......',
      '.......KWWKWWWK.....',
      '......KGGWKWWGKKKK..',
      '......KGGGGLLGGGGGK.',
      '....KRKGGGGGGGGGGWWK',
      '....KKKGGWWWWWWGGGGK',
      '.....KRKWWWWWWGGGGKK',
      '......KKGGWWWWKKKK..',
      '....KKRRRRGGGKK.....',
      '..KKGGRRRRWWWGK.....',
      '.KGGGGKKKKWWWGK.....',
      'KKDGGGGGGGWWGGK.....',
      'KGGGGGGGGWWWWGK.....',
      '.KKKKGGGGGGDDKK.....',
      '....KGGDDGGGGK......',
      '.....KGGK.KGGK......',
      '.....KOOK..KOOK.....',
      '....KOOOYK.KOOOYK...',
      '....KKKKKK.KKKKKK...',
    ];
    const yoshiTonguePattern = [
      '.........KKKK.......',
      '........KWWWWK......',
      '.......KWWKWWWK.....',
      '......KGGWKWWGKKKK..',
      '......KGGGGLLGGGGGK.',
      '....KRKGGGGGGGGGGWWK',
      '....KKKGGWWWWWWPPPPK',
      '.....KRKWWWWWWPPPPKK',
      '......KKGGWWWWKKKK..',
      '....KKRRRRGGGKK.....',
      '..KKGGRRRRWWWGK.....',
      '.KGGGGKKKKWWWGK.....',
      'KKDGGGGGGGWWGGK.....',
      'KGGGGGGGGWWWWGK.....',
      '.KKKKGGGGGGDDKK.....',
      '....KGGDDGGGGK......',
      '....KGGK..KGGK......',
      '....KOOK..KOOK......',
      '...KOOOYK.KOOOYK....',
      '...KKKKKK.KKKKKK....',
    ];

    const [cYoshiIdle, ctxYoshiIdle] = createOffscreen(20, 20);
    drawPixelGrid(ctxYoshiIdle, yoshiIdlePattern, yoshiPalette);
    this.yoshiIdle = cYoshiIdle;

    const [cYoshiWalk, ctxYoshiWalk] = createOffscreen(20, 20);
    drawPixelGrid(ctxYoshiWalk, yoshiWalkPattern, yoshiPalette);
    this.yoshiWalk = cYoshiWalk;

    const [cYoshiTongue, ctxYoshiTongue] = createOffscreen(20, 20);
    drawPixelGrid(ctxYoshiTongue, yoshiTonguePattern, yoshiPalette);
    this.yoshiTongue = cYoshiTongue;
  }

  private generateTiles() {
    // 1. Ground Overworld Tile (16x16)
    const [cGround, ctxGround] = createOffscreen(16, 16);
    ctxGround.fillStyle = NES_COLORS.GROUND_ORANGE;
    ctxGround.fillRect(0, 0, 16, 16);
    // highlight top & left
    ctxGround.fillStyle = NES_COLORS.GROUND_LIGHT;
    ctxGround.fillRect(0, 0, 16, 2);
    ctxGround.fillRect(0, 0, 2, 16);
    // dark edges
    ctxGround.fillStyle = NES_COLORS.GROUND_DARK;
    ctxGround.fillRect(0, 14, 16, 2);
    ctxGround.fillRect(14, 0, 2, 16);
    // stone textures
    ctxGround.fillRect(4, 4, 3, 3);
    ctxGround.fillRect(10, 8, 3, 3);
    this.tileGround = cGround;

    // Underground Ground Tile (Blue/Black theme)
    const [cGroundUg, ctxGroundUg] = createOffscreen(16, 16);
    ctxGroundUg.fillStyle = '#0058b8';
    ctxGroundUg.fillRect(0, 0, 16, 16);
    ctxGroundUg.fillStyle = '#68a0fc';
    ctxGroundUg.fillRect(0, 0, 16, 2);
    ctxGroundUg.fillRect(0, 0, 2, 16);
    ctxGroundUg.fillStyle = '#000000';
    ctxGroundUg.fillRect(0, 14, 16, 2);
    ctxGroundUg.fillRect(14, 0, 2, 16);
    ctxGroundUg.fillRect(4, 4, 3, 3);
    ctxGroundUg.fillRect(10, 8, 3, 3);
    this.tileGroundUnderground = cGroundUg;

    // 2. Breakable Brick Tile (16x16)
    const [cBrick, ctxBrick] = createOffscreen(16, 16);
    ctxBrick.fillStyle = NES_COLORS.BRICK_RED;
    ctxBrick.fillRect(0, 0, 16, 16);
    // mortar lines (black)
    ctxBrick.fillStyle = NES_COLORS.BRICK_MORTAR;
    ctxBrick.fillRect(0, 0, 16, 1);
    ctxBrick.fillRect(0, 7, 16, 2);
    ctxBrick.fillRect(0, 15, 16, 1);
    ctxBrick.fillRect(7, 1, 1, 6);
    ctxBrick.fillRect(3, 9, 1, 6);
    ctxBrick.fillRect(11, 9, 1, 6);
    // brick highlights
    ctxBrick.fillStyle = NES_COLORS.BRICK_HIGHLIGHT;
    ctxBrick.fillRect(0, 1, 7, 1);
    ctxBrick.fillRect(8, 1, 8, 1);
    ctxBrick.fillRect(0, 9, 3, 1);
    ctxBrick.fillRect(4, 9, 7, 1);
    ctxBrick.fillRect(12, 9, 4, 1);
    this.tileBrick = cBrick;

    // Underground Brick Tile
    const [cBrickUg, ctxBrickUg] = createOffscreen(16, 16);
    ctxBrickUg.fillStyle = '#0058b8';
    ctxBrickUg.fillRect(0, 0, 16, 16);
    ctxBrickUg.fillStyle = '#000000';
    ctxBrickUg.fillRect(0, 0, 16, 1);
    ctxBrickUg.fillRect(0, 7, 16, 2);
    ctxBrickUg.fillRect(0, 15, 16, 1);
    ctxBrickUg.fillRect(7, 1, 1, 6);
    ctxBrickUg.fillRect(3, 9, 1, 6);
    ctxBrickUg.fillRect(11, 9, 1, 6);
    ctxBrickUg.fillStyle = '#68a0fc';
    ctxBrickUg.fillRect(0, 1, 7, 1);
    ctxBrickUg.fillRect(8, 1, 8, 1);
    ctxBrickUg.fillRect(0, 9, 3, 1);
    ctxBrickUg.fillRect(4, 9, 7, 1);
    ctxBrickUg.fillRect(12, 9, 4, 1);
    this.tileBrickUnderground = cBrickUg;

    // Underwater Sea Ground Tile (Teal/Cyan Ocean Floor)
    const [cSeaGround, ctxSeaGround] = createOffscreen(16, 16);
    ctxSeaGround.fillStyle = '#007898';
    ctxSeaGround.fillRect(0, 0, 16, 16);
    ctxSeaGround.fillStyle = '#60d8f8';
    ctxSeaGround.fillRect(0, 0, 16, 2);
    ctxSeaGround.fillRect(0, 0, 2, 16);
    ctxSeaGround.fillStyle = '#003050';
    ctxSeaGround.fillRect(0, 14, 16, 2);
    ctxSeaGround.fillRect(14, 0, 2, 16);
    ctxSeaGround.fillRect(4, 5, 3, 3);
    ctxSeaGround.fillRect(10, 9, 3, 3);
    this.tileSeaGround = cSeaGround;

    // Underwater Coral Block Tile (Classic Pink/Magenta NES Coral)
    const coralPalette = {
      '.': '#d82878',
      'L': '#fc88b8',
      'W': '#ffd8ec',
      'D': '#700838',
    };
    const coralPattern = [
      'DDDDDDDDDDDDDDDD',
      'DLLLLW..LLLLW..D',
      'DL..W..DL..W..DD',
      'D..DD..D..DD..LD',
      'DLLL..DDLLL..LLD',
      'DW..LLLL..W..LWD',
      'D..DD..W..DD..DD',
      'DDDD..DD..DDDD.D',
      'DL..LLLL..L..WLD',
      'DL.W..LL.DL..L.D',
      'D..DD..D..DD...D',
      'DLLL..DLLLL..WLD',
      'DL.W..DL..W..L.D',
      'D..DD..D..DD..DD',
      'DDDDDDDDDDDDDDDD',
      'DDDDDDDDDDDDDDDD',
    ];
    const [cCoral, ctxCoral] = createOffscreen(16, 16);
    drawPixelGrid(ctxCoral, coralPattern, coralPalette);
    this.tileCoral = cCoral;

    // Ghost House Haunted Wooden Plank Floor (16x16)
    const [cGhostFloor, ctxGhostFloor] = createOffscreen(16, 16);
    ctxGhostFloor.fillStyle = '#382052';
    ctxGhostFloor.fillRect(0, 0, 16, 16);
    // Top wooden plank highlight
    ctxGhostFloor.fillStyle = '#604088';
    ctxGhostFloor.fillRect(0, 0, 16, 2);
    ctxGhostFloor.fillRect(0, 8, 16, 1);
    // Plank vertical dividers & dark shadow edges
    ctxGhostFloor.fillStyle = '#180c28';
    ctxGhostFloor.fillRect(0, 6, 16, 2);
    ctxGhostFloor.fillRect(0, 14, 16, 2);
    ctxGhostFloor.fillRect(7, 0, 1, 6);
    ctxGhostFloor.fillRect(15, 8, 1, 6);
    // Wood grain & nail dots
    ctxGhostFloor.fillStyle = '#241438';
    ctxGhostFloor.fillRect(2, 3, 3, 1);
    ctxGhostFloor.fillRect(10, 4, 4, 1);
    ctxGhostFloor.fillRect(3, 11, 4, 1);
    ctxGhostFloor.fillRect(11, 10, 2, 1);
    ctxGhostFloor.fillStyle = '#8868b0';
    ctxGhostFloor.fillRect(1, 3, 1, 1);
    ctxGhostFloor.fillRect(9, 3, 1, 1);
    ctxGhostFloor.fillRect(1, 11, 1, 1);
    ctxGhostFloor.fillRect(9, 11, 1, 1);
    this.tileGhostFloor = cGhostFloor;

    // Ghost House Gothic Mansion Brick (16x16)
    const [cGhostBrick, ctxGhostBrick] = createOffscreen(16, 16);
    ctxGhostBrick.fillStyle = '#48346c';
    ctxGhostBrick.fillRect(0, 0, 16, 16);
    // Mortar lines
    ctxGhostBrick.fillStyle = '#140822';
    ctxGhostBrick.fillRect(0, 0, 16, 1);
    ctxGhostBrick.fillRect(0, 7, 16, 2);
    ctxGhostBrick.fillRect(0, 15, 16, 1);
    ctxGhostBrick.fillRect(7, 1, 1, 6);
    ctxGhostBrick.fillRect(3, 9, 1, 6);
    ctxGhostBrick.fillRect(11, 9, 1, 6);
    // Highlights
    ctxGhostBrick.fillStyle = '#785ca8';
    ctxGhostBrick.fillRect(0, 1, 7, 1);
    ctxGhostBrick.fillRect(8, 1, 8, 1);
    ctxGhostBrick.fillRect(0, 9, 3, 1);
    ctxGhostBrick.fillRect(4, 9, 7, 1);
    ctxGhostBrick.fillRect(12, 9, 4, 1);
    // Subtle dark brick shade
    ctxGhostBrick.fillStyle = '#30204c';
    ctxGhostBrick.fillRect(1, 5, 5, 1);
    ctxGhostBrick.fillRect(9, 5, 6, 1);
    ctxGhostBrick.fillRect(5, 13, 5, 1);
    this.tileGhostBrick = cGhostBrick;

    // 3. Question Blocks (4 animation frames)
    this.tileQuestionFrames = [];
    const qPalette = {
      '.': NES_COLORS.QUESTION_BG,
      'D': NES_COLORS.QUESTION_DARK,
      'M': NES_COLORS.QUESTION_MARK,
      'L': '#fce0a8',
      'B': '#000000',
    };

    const qPattern = [
      'BBBBBBBBBBBBBBBB',
      'BLLLLLLLLLLLLLLB',
      'BL............DB',
      'BL...DDDDDD...DB',
      'BL..DD....DD..DB',
      'BL..DD....DD..DB',
      'BL........DD..DB',
      'BL......DDDD..DB',
      'BL.....DD.....DB',
      'BL.....DD.....DB',
      'BL............DB',
      'BL.....DD.....DB',
      'BL.....DD.....DB',
      'BL............DB',
      'BDDDDDDDDDDDDDDB',
      'BBBBBBBBBBBBBBBB',
    ];

    for (let f = 0; f < 4; f++) {
      const [cQ, ctxQ] = createOffscreen(16, 16);
      const bgColors = [NES_COLORS.QUESTION_BG, '#fca044', '#f89440', '#fc9838'];
      const currentPalette = { ...qPalette, '.': bgColors[f] };
      drawPixelGrid(ctxQ, qPattern, currentPalette);
      this.tileQuestionFrames.push(cQ);
    }

    // Empty Question Block (Brown)
    const [cEmpty, ctxEmpty] = createOffscreen(16, 16);
    ctxEmpty.fillStyle = NES_COLORS.QUESTION_EMPTY;
    ctxEmpty.fillRect(0, 0, 16, 16);
    ctxEmpty.fillStyle = '#482400';
    ctxEmpty.fillRect(0, 0, 16, 1);
    ctxEmpty.fillRect(0, 0, 1, 16);
    ctxEmpty.fillRect(0, 15, 16, 1);
    ctxEmpty.fillRect(15, 0, 1, 16);
    // dots in corners
    ctxEmpty.fillStyle = '#000000';
    ctxEmpty.fillRect(2, 2, 2, 2);
    ctxEmpty.fillRect(12, 2, 2, 2);
    ctxEmpty.fillRect(2, 12, 2, 2);
    ctxEmpty.fillRect(12, 12, 2, 2);
    this.tileQuestionEmpty = cEmpty;

    // 4. Hard Block (Staircase block)
    const [cHard, ctxHard] = createOffscreen(16, 16);
    ctxHard.fillStyle = NES_COLORS.HARD_BLOCK_LIGHT;
    ctxHard.fillRect(0, 0, 16, 16);
    ctxHard.fillStyle = '#000000';
    ctxHard.fillRect(0, 0, 16, 1);
    ctxHard.fillRect(0, 0, 1, 16);
    ctxHard.fillRect(1, 15, 15, 1);
    ctxHard.fillRect(15, 1, 1, 15);
    ctxHard.fillRect(2, 2, 2, 2);
    ctxHard.fillRect(12, 2, 2, 2);
    ctxHard.fillRect(2, 12, 2, 2);
    ctxHard.fillRect(12, 12, 2, 2);
    this.tileHardBlock = cHard;

    // 4a-1. Yellow [!] Block - Locked / Dotted Outline (before Switch Palace)
    const [cExclLocked, ctxExclLocked] = createOffscreen(16, 16);
    const exclLockedPattern = [
      '.YY..YY..YY..YY.',
      'Y..............Y',
      'Y..............Y',
      '.......YY.......',
      '......YYYY......',
      'Y.....YYYY.....Y',
      'Y......YY......Y',
      '.......YY.......',
      '.......YY.......',
      'Y..............Y',
      'Y..............Y',
      '.......YY.......',
      '.......YY.......',
      'Y..............Y',
      'Y..............Y',
      '.YY..YY..YY..YY.',
    ];
    drawPixelGrid(ctxExclLocked, exclLockedPattern, {
      '.': 'transparent',
      'Y': '#fde047',
    });
    this.tileExclamYellowLocked = cExclLocked;

    // 4a-2. Yellow [!] Block - Unlocked / Solid Golden Block (spawns Super Mushrooms)
    const [cExclActive, ctxExclActive] = createOffscreen(16, 16);
    const exclActivePattern = [
      'BBBBBBBBBBBBBBBB',
      'BLLLLLLLLLLLLLLB',
      'BLYYYYYYYYYYYYDB',
      'BLY..BYYYY..B.DB',
      'BLYYYYYKKYYYYYDB',
      'BLYYYYKKKKYYYYDB',
      'BLYYYYKKKKYYYYDB',
      'BLYYYYYKKYYYYYDB',
      'BLYYYYYKKYYYYYDB',
      'BLYYYYYKKYYYYYDB',
      'BLYYYYYYYYYYYYDB',
      'BLYYYYYKKYYYYYDB',
      'BLY..BYKKY..B.DB',
      'BLYYYYYYYYYYYYDB',
      'BDDDDDDDDDDDDDDB',
      'BBBBBBBBBBBBBBBB',
    ];
    drawPixelGrid(ctxExclActive, exclActivePattern, {
      'B': '#000000',
      'L': '#fef9c3',
      'Y': '#facc15',
      'D': '#ca8a04',
      'K': '#451a03',
      '.': '#eab308',
    });
    this.tileExclamYellowActive = cExclActive;

    // 4a-3. Giant Yellow Switch Palace Button (Unpressed & Pressed)
    const [cSwitch, ctxSwitch] = createOffscreen(16, 16);
    const switchPattern = [
      '...BBBBBBBBBB...',
      '..BLLLLLLLLLLB..',
      '.BLYYYYYYYYYYDB.',
      '.BLYYYKKKKYYYDB.',
      '.BLYYYKKKKYYYDB.',
      '.BLYYYYKKYYYYDB.',
      '.BLYYYYKKYYYYDB.',
      '.BLYYYYYYYYYYDB.',
      '.BLYYYYKKYYYYDB.',
      '.BLYYYYKKYYYYDB.',
      '.BDDDDDDDDDDDDB.',
      'BBBBBBBBBBBBBBBB',
      'BGGGGGGGGGGGGGGD',
      'BGGGGGGGGGGGGGGD',
      'BDDDDDDDDDDDDDDD',
      'BBBBBBBBBBBBBBBB',
    ];
    drawPixelGrid(ctxSwitch, switchPattern, {
      '.': 'transparent',
      'B': '#000000',
      'L': '#fef08a',
      'Y': '#facc15',
      'D': '#a16207',
      'K': '#451a03',
      'G': '#78716c',
    });
    this.tileYellowSwitch = cSwitch;

    const [cSwitchPressed, ctxSwitchPressed] = createOffscreen(16, 16);
    const switchPressedPattern = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..BBBBBBBBBBBB..',
      '.BLYYYYYYYYYYDB.',
      'BBBBBBBBBBBBBBBB',
      'BGGGGGGGGGGGGGGD',
      'BGGGGGGGGGGGGGGD',
      'BDDDDDDDDDDDDDDD',
      'BBBBBBBBBBBBBBBB',
    ];
    drawPixelGrid(ctxSwitchPressed, switchPressedPattern, {
      '.': 'transparent',
      'B': '#000000',
      'L': '#fef08a',
      'Y': '#eab308',
      'D': '#854d0e',
      'G': '#78716c',
    });
    this.tileYellowSwitchPressed = cSwitchPressed;

    // 4a-4. Colored SMW [!] Blocks & Switch Palace Buttons (Green, Red, Pink, Blue)
    const buildColoredSwitchSet = (pal: {
      outline: string;
      light: string;
      mid: string;
      dark: string;
      dot: string;
      ink: string;
      switchLight: string;
      switchDark: string;
      switchPressedMid: string;
      switchPressedDark: string;
    }) => {
      const [cLocked, ctxLocked] = createOffscreen(16, 16);
      drawPixelGrid(ctxLocked, exclLockedPattern, {
        '.': 'transparent',
        'Y': pal.outline,
      });

      const [cActive, ctxActive] = createOffscreen(16, 16);
      drawPixelGrid(ctxActive, exclActivePattern, {
        'B': '#000000',
        'L': pal.light,
        'Y': pal.mid,
        'D': pal.dark,
        'K': pal.ink,
        '.': pal.dot,
      });

      const [cSw, ctxSw] = createOffscreen(16, 16);
      drawPixelGrid(ctxSw, switchPattern, {
        '.': 'transparent',
        'B': '#000000',
        'L': pal.switchLight,
        'Y': pal.mid,
        'D': pal.switchDark,
        'K': pal.ink,
        'G': '#78716c',
      });

      const [cSwPressed, ctxSwPressed] = createOffscreen(16, 16);
      drawPixelGrid(ctxSwPressed, switchPressedPattern, {
        '.': 'transparent',
        'B': '#000000',
        'L': pal.switchLight,
        'Y': pal.switchPressedMid,
        'D': pal.switchPressedDark,
        'G': '#78716c',
      });

      return { cLocked, cActive, cSw, cSwPressed };
    };

    const greenSet = buildColoredSwitchSet({
      outline: '#4ade80',
      light: '#dcfce7',
      mid: '#22c55e',
      dark: '#15803d',
      dot: '#16a34a',
      ink: '#052e16',
      switchLight: '#bbf7d0',
      switchDark: '#166534',
      switchPressedMid: '#16a34a',
      switchPressedDark: '#14532d',
    });
    this.tileExclamGreenLocked = greenSet.cLocked;
    this.tileExclamGreenActive = greenSet.cActive;
    this.tileGreenSwitch = greenSet.cSw;
    this.tileGreenSwitchPressed = greenSet.cSwPressed;

    const redSet = buildColoredSwitchSet({
      outline: '#f87171',
      light: '#fee2e2',
      mid: '#ef4444',
      dark: '#b91c1c',
      dot: '#dc2626',
      ink: '#450a0a',
      switchLight: '#fecaca',
      switchDark: '#991b1b',
      switchPressedMid: '#dc2626',
      switchPressedDark: '#7f1d1d',
    });
    this.tileExclamRedLocked = redSet.cLocked;
    this.tileExclamRedActive = redSet.cActive;
    this.tileRedSwitch = redSet.cSw;
    this.tileRedSwitchPressed = redSet.cSwPressed;

    const pinkSet = buildColoredSwitchSet({
      outline: '#f472b6',
      light: '#fce7f3',
      mid: '#ec4899',
      dark: '#be185d',
      dot: '#db2777',
      ink: '#500724',
      switchLight: '#fbcfe8',
      switchDark: '#9d174d',
      switchPressedMid: '#db2777',
      switchPressedDark: '#831843',
    });
    this.tileExclamPinkLocked = pinkSet.cLocked;
    this.tileExclamPinkActive = pinkSet.cActive;
    this.tilePinkSwitch = pinkSet.cSw;
    this.tilePinkSwitchPressed = pinkSet.cSwPressed;

    const blueSet = buildColoredSwitchSet({
      outline: '#60a5fa',
      light: '#dbeafe',
      mid: '#3b82f6',
      dark: '#1d4ed8',
      dot: '#2563eb',
      ink: '#172554',
      switchLight: '#bfdbfe',
      switchDark: '#1e40af',
      switchPressedMid: '#2563eb',
      switchPressedDark: '#1e3a8a',
    });
    this.tileExclamBlueLocked = blueSet.cLocked;
    this.tileExclamBlueActive = blueSet.cActive;
    this.tileBlueSwitch = blueSet.cSw;
    this.tileBlueSwitchPressed = blueSet.cSwPressed;

    // 4b. Castle Lava (2 animated 16x16 frames)
    this.tileLavaFrames = [];
    for (let f = 0; f < 2; f++) {
      const [cLava, ctxLava] = createOffscreen(16, 16);
      ctxLava.fillStyle = '#c81c00';
      ctxLava.fillRect(0, 0, 16, 16);
      // Glowing bright molten wave crest
      ctxLava.fillStyle = '#fc7438';
      for (let wx = 0; wx < 16; wx += 4) {
        const crestY = ((wx / 4 + f) % 2 === 0) ? 1 : 3;
        ctxLava.fillRect(wx, crestY, 4, 4);
      }
      ctxLava.fillStyle = '#fce078';
      ctxLava.fillRect(f === 0 ? 2 : 8, 2, 4, 2);
      ctxLava.fillRect(f === 0 ? 10 : 0, 4, 3, 1);
      ctxLava.fillStyle = '#ff9838';
      ctxLava.fillRect(f === 0 ? 4 : 10, 9, 4, 2);
      ctxLava.fillRect(f === 0 ? 11 : 3, 12, 3, 2);
      this.tileLavaFrames.push(cLava);
    }

    // 4c. Castle Bridge (16x16)
    const [cBridge, ctxBridge] = createOffscreen(16, 16);
    ctxBridge.fillStyle = '#502800';
    ctxBridge.fillRect(0, 2, 16, 6);
    ctxBridge.fillStyle = '#c86810';
    ctxBridge.fillRect(0, 0, 16, 3);
    ctxBridge.fillStyle = '#fcb040';
    ctxBridge.fillRect(1, 0, 6, 1);
    ctxBridge.fillRect(9, 0, 6, 1);
    // Plank dividers & chain supports
    ctxBridge.fillStyle = '#000000';
    ctxBridge.fillRect(7, 0, 2, 8);
    ctxBridge.fillRect(15, 0, 1, 8);
    ctxBridge.fillStyle = '#bcbcbc';
    ctxBridge.fillRect(3, 8, 2, 4);
    ctxBridge.fillRect(11, 8, 2, 4);
    this.tileBridge = cBridge;

    // 4d. Castle Axe (2 animated 16x16 frames)
    this.tileAxeFrames = [];
    const axePalette0 = {
      '.': 'transparent',
      'K': '#000000',
      'Y': '#fce078',
      'O': '#fc9838',
      'W': '#ffffff',
      'B': '#a85800',
    };
    const axePalette1 = {
      ...axePalette0,
      'Y': '#ffffff',
      'O': '#fce078',
    };
    const axePattern = [
      '......KKKK......',
      '....KKYYYYKK....',
      '...KWWYYYYYYK...',
      '..KWWYYYYYOOOK..',
      '..KWWYYYYOOOOK..',
      '..KWWYYYYOOOBK..',
      '...KYYYYYYBBBK..',
      '....KKKKKBBBBK..',
      '.......KBBBBK...',
      '.......KBBBBK...',
      '.......KBBBBK...',
      '.......KBBBBK...',
      '.......KBBBBK...',
      '.......KBBBBK...',
      '.......KKKKKK...',
      '................',
    ];
    [axePalette0, axePalette1].forEach(pal => {
      const [cAxe, ctxAxe] = createOffscreen(16, 16);
      drawPixelGrid(ctxAxe, axePattern, pal);
      this.tileAxeFrames.push(cAxe);
    });

    // 5. Pipes (Green Overworld)
    // Top-Left (16x16)
    const [cPTL, ctxPTL] = createOffscreen(16, 16);
    ctxPTL.fillStyle = NES_COLORS.PIPE_GREEN;
    ctxPTL.fillRect(0, 0, 16, 16);
    ctxPTL.fillStyle = NES_COLORS.BLACK;
    ctxPTL.fillRect(0, 0, 16, 2); // top edge
    ctxPTL.fillRect(0, 0, 2, 16); // left lip
    ctxPTL.fillRect(0, 14, 16, 2); // bottom lip rim
    ctxPTL.fillStyle = NES_COLORS.PIPE_LIGHT;
    ctxPTL.fillRect(3, 2, 4, 12); // vertical highlight
    ctxPTL.fillStyle = NES_COLORS.PIPE_DARK;
    ctxPTL.fillRect(13, 2, 3, 12);
    this.pipeTopLeft = cPTL;

    // Top-Right (16x16)
    const [cPTR, ctxPTR] = createOffscreen(16, 16);
    ctxPTR.fillStyle = NES_COLORS.PIPE_GREEN;
    ctxPTR.fillRect(0, 0, 16, 16);
    ctxPTR.fillStyle = NES_COLORS.BLACK;
    ctxPTR.fillRect(0, 0, 16, 2);
    ctxPTR.fillRect(14, 0, 2, 16); // right lip
    ctxPTR.fillRect(0, 14, 16, 2);
    ctxPTR.fillStyle = NES_COLORS.PIPE_DARK;
    ctxPTR.fillRect(0, 2, 3, 12);
    ctxPTR.fillRect(10, 2, 4, 12);
    this.pipeTopRight = cPTR;

    // Body-Left (16x16)
    const [cPBL, ctxPBL] = createOffscreen(16, 16);
    ctxPBL.fillStyle = NES_COLORS.PIPE_GREEN;
    ctxPBL.fillRect(0, 0, 16, 16);
    ctxPBL.fillStyle = NES_COLORS.BLACK;
    ctxPBL.fillRect(2, 0, 2, 16); // body left border indented 2px
    ctxPBL.fillStyle = NES_COLORS.PIPE_LIGHT;
    ctxPBL.fillRect(5, 0, 4, 16);
    ctxPBL.fillStyle = NES_COLORS.PIPE_DARK;
    ctxPBL.fillRect(13, 0, 3, 16);
    this.pipeBodyLeft = cPBL;

    // Body-Right (16x16)
    const [cPBR, ctxPBR] = createOffscreen(16, 16);
    ctxPBR.fillStyle = NES_COLORS.PIPE_GREEN;
    ctxPBR.fillRect(0, 0, 16, 16);
    ctxPBR.fillStyle = NES_COLORS.BLACK;
    ctxPBR.fillRect(12, 0, 2, 16); // body right border indented 2px
    ctxPBR.fillStyle = NES_COLORS.PIPE_DARK;
    ctxPBR.fillRect(0, 0, 3, 16);
    ctxPBR.fillRect(9, 0, 3, 16);
    this.pipeBodyRight = cPBR;
  }

  private generateItems() {
    // 1. Super Mushroom (16x16)
    const mushroomPalette = {
      '.': 'transparent',
      'R': '#d82800',
      'W': '#ffffff',
      'S': '#fc9838',
      'B': '#000000',
    };

    const mushroomPattern = [
      '.....BBBBBB.....',
      '...BBRRRRRRBB...',
      '..BRRRWWWRRRRB..',
      '.BRRWWWWWWWRRRB.',
      '.BRWWWRRRWWWRRB.',
      'BRWWWRRRRRWWWRRB',
      'BRWWWRRRRRWWWRRB',
      'BRRWWWRRRWWWRRRB',
      'BRRRWWWWWWWRRRRB',
      '.BBRRRWWWRRRRBB.',
      '...BSSSSSSSSB...',
      '..BSSBSSSSBSSB..',
      '..BSSBSSSSBSSB..',
      '..BSSSSSSSSSSB..',
      '...BSSSSSSSSB...',
      '....BBBBBBBB....',
    ];

    const [cM, ctxM] = createOffscreen(16, 16);
    drawPixelGrid(ctxM, mushroomPattern, mushroomPalette);
    this.itemMushroomSuper = cM;

    // 1-UP Mushroom (Green)
    const oneUpPalette = {
      ...mushroomPalette,
      'R': NES_COLORS.LUIGI_GREEN,
    };
    const [c1Up, ctx1Up] = createOffscreen(16, 16);
    drawPixelGrid(ctx1Up, mushroomPattern, oneUpPalette);
    this.itemMushroom1Up = c1Up;

    // 2. Fire Flower (16x16 animated frames)
    const flowerPatterns = [
      ['#d82800', '#fc9838', '#ffffff'],
      ['#fc9838', '#ffffff', '#d82800'],
      ['#ffffff', '#d82800', '#fc9838'],
      ['#fc9838', '#ffffff', '#d82800'],
    ];

    this.itemFireFlowerFrames = [];
    for (const [cOuter, cMid, cInner] of flowerPatterns) {
      const [cF, ctxF] = createOffscreen(16, 16);
      const fPalette = {
        '.': 'transparent',
        'O': cOuter,
        'M': cMid,
        'I': cInner,
        'B': '#000000',
        'G': '#00a800',
      };
      const fPattern = [
        '.....OOOOOO.....',
        '...OOMMMMMMOO...',
        '..OOMMIIIIMMOO..',
        '.OOMIIMBBMIIMOO.',
        '.OOMIMBBBBMIMOO.',
        'OOMIIIBBBBMIIIOO',
        'OOMIIIBBBBMIIIOO',
        '.OOMIMBBBBMIMOO.',
        '.OOMIIMBBMIIMOO.',
        '..OOMMIIIIMMOO..',
        '...OOMMMMMMOO...',
        '.....OOOOOO.....',
        '......GGGG......',
        '....GGGGGGGG....',
        '...GG..GG..GG...',
        '.......GG.......',
      ];
      drawPixelGrid(ctxF, fPattern, fPalette);
      this.itemFireFlowerFrames.push(cF);
    }

    // 3. Coins (4 animated rotating frames)
    this.itemCoinFrames = [];
    const coinPatterns = [
      // Frame 1: Full
      [
        '.....BBBBBB.....',
        '...BBYYYYYYBB...',
        '..BYYWWWWWWYYB..',
        '.BYWWYYYYYYWWYB.',
        '.BYWYYBBYYYYWYB.',
        'BYWYYYBBBYYYYWYB',
        'BYWYYYBBBYYYYWYB',
        'BYWYYYBBBYYYYWYB',
        'BYWYYYBBBYYYYWYB',
        'BYWYYYBBBYYYYWYB',
        '.BYWYYBBYYYYWYB.',
        '.BYWWYYYYYYWWYB.',
        '..BYYWWWWWWYYB..',
        '...BBYYYYYYBB...',
        '.....BBBBBB.....',
        '................',
      ],
      // Frame 2: Narrow 1
      [
        '......BBBB......',
        '....BBYYYYBB....',
        '...BYYWWWWYYB...',
        '..BYWWYYYYWWYB..',
        '..BYWYBBYYWYB...',
        '..BYWYBBBYWYB...',
        '..BYWYBBBYWYB...',
        '..BYWYBBBYWYB...',
        '..BYWYBBBYWYB...',
        '..BYWYBBBYWYB...',
        '..BYWYBBYYWYB...',
        '..BYWWYYYYWWYB..',
        '...BYYWWWWYYB...',
        '....BBYYYYBB....',
        '......BBBB......',
        '................',
      ],
      // Frame 3: Thin edge
      [
        '.......BB.......',
        '.....BBYYBB.....',
        '....BYYYYYYB....',
        '...BYWWWWWWYB...',
        '...BYWWWWWWYB...',
        '...BYWBYYBWYB...',
        '...BYWBYYBWYB...',
        '...BYWBYYBWYB...',
        '...BYWBYYBWYB...',
        '...BYWBYYBWYB...',
        '...BYWWWWWWYB...',
        '...BYWWWWWWYB...',
        '....BYYYYYYB....',
        '.....BBYYBB.....',
        '.......BB.......',
        '................',
      ],
      // Frame 4: Line
      [
        '.......BB.......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '......BYYB......',
        '.......BB.......',
        '................',
      ],
    ];

    const coinPalette = {
      '.': 'transparent',
      'Y': NES_COLORS.COIN_GOLD,
      'W': NES_COLORS.COIN_LIGHT,
      'B': NES_COLORS.BLACK,
    };

    for (const p of coinPatterns) {
      const [cCoin, ctxCoin] = createOffscreen(16, 16);
      drawPixelGrid(ctxCoin, p, coinPalette);
      this.itemCoinFrames.push(cCoin);
    }

    // 4. Super Leaf (Tanooki Leaf)
    const leafPalette = {
      '.': 'transparent',
      'L': '#c86800', // Leaf chestnut orange
      'H': '#f8b800', // Leaf highlight
      'D': '#602800', // Vein and stem
      'B': '#000000', // Outline
      'E': '#883800', // Ear
    };
    const leafPattern = [
      '.....BB...BB....',
      '....BEEB.BEEB...',
      '...BEHHEBBEHHEB.',
      '..BEHHHLLLLHHHEB',
      '..BLLLLLLLLLLLLB',
      '.BHLLLLDDLLLLLLH',
      '.BLLLLLDDLLLLLLB',
      '.BLLLLLDDLLLLLLB',
      '.BHLLLLDDLLLLLH.',
      '..BLLLLDDLLLLLB.',
      '..BHLLLDDLLLLHB.',
      '...BLLLDDLLLLB..',
      '....BLLDDLLLB...',
      '.....BLDDLLB....',
      '......BDDBB.....',
      '.......DB.......',
    ];
    const [cLeaf, ctxLeaf] = createOffscreen(16, 16);
    drawPixelGrid(ctxLeaf, leafPattern, leafPalette);
    this.itemSuperLeaf = cLeaf;

    // 5. Femboy Power-Up (Cute Pink Pastel Ribbon Bow)
    const femboyItemPalette = {
      '.': 'transparent',
      'B': '#000000',
      'P': '#ff5cb8',
      'L': '#ffb8e6',
      'W': '#ffffff',
      'D': '#b0186c',
    };
    const femboyItemPattern = [
      '................',
      '..BBBB....BBBB..',
      '.BPLWWB..BWWLPB.',
      'BPPLLWWBBWWLLPPB',
      'BPLLLPWWWWPLLLPB',
      'BPPLPPWDDWPPPLPB',
      '.BPPPBDDDDPBPPB.',
      '..BBBBPDDPBBBB..',
      '....BPPBBPPB....',
      '...BPLPB.BPLPB..',
      '..BPLPB...BPLPB.',
      '..BPPB.....BPPB.',
      '...BB.......BB..',
      '................',
      '................',
      '................',
    ];
    const [cFemboy, ctxFemboy] = createOffscreen(16, 16);
    drawPixelGrid(ctxFemboy, femboyItemPattern, femboyItemPalette);
    this.itemFemboy = cFemboy;

    // 6. Cape Feather ("Pena" - Super Mario World Golden Feather)
    const featherPalette = {
      '.': 'transparent',
      'B': '#000000',
      'Y': '#f8d800',
      'W': '#ffffff',
      'O': '#e88800',
    };
    const featherPattern = [
      '..........BBBB..',
      '........BBWWWWB.',
      '.......BWWYYYYB.',
      '......BWYYYYYYB.',
      '.....BWWYYYYYOB.',
      '....BWWYYYYYOOB.',
      '...BWWYYYYYOOB..',
      '...BWYYYYYOOB...',
      '..BWWYYYYOOB....',
      '..BWYYYYOOB.....',
      '..BYYYOOB.......',
      '.BYYOOOB........',
      '.BYOOB..........',
      '.BBOB...........',
      '.BOB............',
      '..B.............',
    ];
    const [cFeather, ctxFeather] = createOffscreen(16, 16);
    drawPixelGrid(ctxFeather, featherPattern, featherPalette);
    this.itemFeather = cFeather;

    // 7. Starman (16x16 classic 5-pointed flashing invincibility star with black eyes)
    const starColorSets = [
      { outer: '#fce078', inner: '#fc9838', glint: '#ffffff' },
      { outer: '#78f858', inner: '#00a800', glint: '#ffffff' },
      { outer: '#58f8f8', inner: '#2088f8', glint: '#ffffff' },
      { outer: '#ff70b8', inner: '#d82800', glint: '#fce078' },
    ];
    const starPattern = [
      '.......BB.......',
      '......BOOB......',
      '......BOOB......',
      '.....BOOOOB.....',
      '.BBBBOOOOOOBBBB.',
      'BOOGGOOOOOOOOOB.',
      '.BOOOOBOOBOOOOB.',
      '..BOOOBOOBOOOB..',
      '...BOOOOOOOOB...',
      '...BOOOOOOOOB...',
      '..BOOOOI IOOOB..'.replace(' ', ''),
      '..BOOOBBBBOOOB..',
      '.BOOOB....BOOOB.',
      '.BOOB......BOOB.',
      '.BBB........BBB.',
      '................',
    ];
    this.itemStarFrames = [];
    for (const cs of starColorSets) {
      const [cStar, ctxStar] = createOffscreen(16, 16);
      const starPalette = {
        '.': 'transparent',
        'B': '#000000',
        'O': cs.outer,
        'I': cs.inner,
        'G': cs.glint,
      };
      drawPixelGrid(ctxStar, starPattern, starPalette);
      this.itemStarFrames.push(cStar);
    }

    // 8. SMW Golden Key (16x16 carryable key)
    const keyPalette = {
      '.': 'transparent',
      'K': '#181828',
      'G': '#f8d038',
      'L': '#fff8b8',
      'D': '#b87008',
    };
    const keyPattern = [
      '....KKKKKKKK....',
      '...KLLLLGGGGK...',
      '..KLLGGGGGGGGK..',
      '..KLLGGKKGGGGK..',
      '..KGGGGKKGGGGK..',
      '..KGGGGGGDDDDK..',
      '...KDDDDDDDDK...',
      '....KKKGGKKKK...',
      '......KGGK......',
      '......KGGKKK....',
      '......KGGLLK....',
      '......KGGK......',
      '......KGGKKKK...',
      '......KGGLLDK...',
      '......KDDKKKK...',
      '.......KK.......',
    ];
    const [cKey, ctxKey] = createOffscreen(16, 16);
    drawPixelGrid(ctxKey, keyPattern, keyPalette);
    this.itemKey = cKey;

    // 9. SMW Keyhole (16x24 golden-trimmed black keyhole emblem)
    const keyholePalette = {
      '.': 'transparent',
      'K': '#080814',
      'G': '#f8d038',
      'L': '#fff8c8',
      'D': '#985808',
    };
    const keyholePattern = [
      '.....GGGGGG.....',
      '...GGLLLLLLGG...',
      '..GLLKKKKKKLLG..',
      '.GLKKKKKKKKKKLG.',
      '.GLKKKKKKKKKKLG.',
      '.GKKKKKKKKKKKKG.',
      '.GKKKKKKKKKKKKG.',
      '.GDKKKKKKKKKKDG.',
      '..GDKKKKKKKKDG..',
      '...GDKKKKKKDG...',
      '....GDKKKKDG....',
      '....GKKKKKKG....',
      '...GKKKKKKKKG...',
      '...GKKKKKKKKG...',
      '..GKKKKKKKKKKG..',
      '..GKKKKKKKKKKG..',
      '.GKKKKKKKKKKKKG.',
      '.GKKKKKKKKKKKKG.',
      '.GKKKKKKKKKKKKG.',
      '.GDKKKKKKKKKKDG.',
      '..GDDDDDDDDDDG..',
      '...GGGGGGGGGG...',
      '................',
      '................',
    ];
    const [cKeyhole, ctxKeyhole] = createOffscreen(16, 24);
    drawPixelGrid(ctxKeyhole, keyholePattern, keyholePalette);
    this.itemKeyhole = cKeyhole;

    // 10. Portable P-Switches (Blue & Cyan, 16x16 active & pressed)
    const buildPSwitch = (capMain: string, capLight: string, capDark: string) => {
      const pPal = {
        '.': 'transparent',
        'K': '#181828',
        'M': capMain,
        'L': capLight,
        'D': capDark,
        'W': '#ffffff',
        'S': '#dce4f2',
        'G': '#647490',
      };
      const activePat = [
        '..KKKKKKKKKKKK..',
        '.KLLLLLLLLLLMMK.',
        '.KLMMMMMMMMMMDK.',
        '.KMLLWWWWMMMMDK.',
        '.KMLLWKKKWMMMDK.',
        '.KMLLWKKKWMMMDK.',
        '.KMLLWWWWMMMMDK.',
        '.KMLLWMMMMMMMDK.',
        '.KMLLWMMMMMMMDK.',
        '.KDDDDDDDDDDDDK.',
        'KKKKKKKKKKKKKKKK',
        'KSSSSSSSSSSSSGGK',
        'KSSWWWWSSSSGGGGK',
        'KSSSSSSSSGGGGGGK',
        'KGGGGGGGGGGGGGGK',
        'KKKKKKKKKKKKKKKK',
      ];
      const pressedPat = [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '..KKKKKKKKKKKK..',
        '.KLLMMMMMMMMDDK.',
        'KKKKKKKKKKKKKKKK',
        'KSSSSSSSSGGGGGGK',
        'KGGGGGGGGGGGGGGK',
        'KKKKKKKKKKKKKKKK',
      ];
      const [cAct, ctxAct] = createOffscreen(16, 16);
      drawPixelGrid(ctxAct, activePat, pPal);
      const [cPrs, ctxPrs] = createOffscreen(16, 16);
      drawPixelGrid(ctxPrs, pressedPat, pPal);
      return [cAct, cPrs] as const;
    };

    const [pBlue, pBluePrs] = buildPSwitch('#2868f0', '#70b8ff', '#1038a8');
    this.itemPSwitchBlue = pBlue;
    this.itemPSwitchBluePressed = pBluePrs;

    const [pCyan, pCyanPrs] = buildPSwitch('#10b8d8', '#78f4ff', '#087090');
    this.itemPSwitchCyan = pCyan;
    this.itemPSwitchCyanPressed = pCyanPrs;
  }

  private generateCastle() {
    // Castle stone brick
    const [cBrick, ctxBrick] = createOffscreen(16, 16);
    ctxBrick.fillStyle = NES_COLORS.CASTLE_BRICK;
    ctxBrick.fillRect(0, 0, 16, 16);
    ctxBrick.fillStyle = NES_COLORS.CASTLE_SHADOW;
    ctxBrick.fillRect(0, 0, 16, 1);
    ctxBrick.fillRect(0, 7, 16, 1);
    ctxBrick.fillRect(7, 1, 1, 6);
    ctxBrick.fillRect(3, 8, 1, 8);
    ctxBrick.fillRect(11, 8, 1, 8);
    this.castleBrick = cBrick;

    // Castle door
    const [cDoor, ctxDoor] = createOffscreen(16, 16);
    ctxDoor.fillStyle = NES_COLORS.CASTLE_BRICK;
    ctxDoor.fillRect(0, 0, 16, 16);
    ctxDoor.fillStyle = NES_COLORS.BLACK;
    ctxDoor.beginPath();
    ctxDoor.arc(8, 6, 6, Math.PI, 0);
    ctxDoor.fillRect(2, 6, 12, 10);
    this.castleDoor = cDoor;

    // SMW Goal Gate Cap Top (16x16 sleek metallic dome finial with golden collar)
    const [cBall, ctxBall] = createOffscreen(16, 16);
    // Top crown pin
    ctxBall.fillStyle = '#181828';
    ctxBall.fillRect(6, 1, 4, 3);
    ctxBall.fillStyle = '#fce078';
    ctxBall.fillRect(7, 2, 2, 2);
    // Dome outline
    ctxBall.fillStyle = '#181828';
    ctxBall.fillRect(4, 3, 8, 10);
    ctxBall.fillRect(3, 5, 10, 8);
    // Metallic dome body & cylindrical shading
    ctxBall.fillStyle = '#647490';
    ctxBall.fillRect(4, 4, 8, 8);
    ctxBall.fillStyle = '#dce4f2';
    ctxBall.fillRect(4, 4, 6, 8);
    ctxBall.fillRect(4, 5, 7, 6);
    // Specular highlight
    ctxBall.fillStyle = '#ffffff';
    ctxBall.fillRect(5, 5, 2, 4);
    ctxBall.fillRect(6, 4, 2, 1);
    // Golden collar ring at the base of the dome
    ctxBall.fillStyle = '#181828';
    ctxBall.fillRect(3, 12, 10, 4);
    ctxBall.fillStyle = '#c88010';
    ctxBall.fillRect(4, 13, 8, 2);
    ctxBall.fillStyle = '#f8d838';
    ctxBall.fillRect(4, 13, 6, 2);
    ctxBall.fillStyle = '#fff8c8';
    ctxBall.fillRect(5, 13, 2, 1);
    this.flagPoleTop = cBall;

    // SMW Goal Gate Post Body (16x16 shaded cylindrical pillar with subtle segment bands)
    const [cPole, ctxPole] = createOffscreen(16, 16);
    ctxPole.fillStyle = '#181828';
    ctxPole.fillRect(4, 0, 8, 16);
    ctxPole.fillStyle = '#a8b8d0';
    ctxPole.fillRect(5, 0, 1, 16);
    ctxPole.fillStyle = '#ffffff';
    ctxPole.fillRect(6, 0, 1, 16);
    ctxPole.fillStyle = '#dce4f2';
    ctxPole.fillRect(7, 0, 2, 16);
    ctxPole.fillStyle = '#8494b0';
    ctxPole.fillRect(9, 0, 1, 16);
    ctxPole.fillStyle = '#4e5c78';
    ctxPole.fillRect(10, 0, 1, 16);
    // Subtle SMW cylindrical ring seams every 4px
    for (let sy = 0; sy < 16; sy += 4) {
      ctxPole.fillStyle = '#9aaac4';
      ctxPole.fillRect(5, sy, 4, 1);
      ctxPole.fillStyle = '#3c4862';
      ctxPole.fillRect(9, sy, 2, 1);
    }
    this.flagPoleBody = cPole;

    // SMW Goal Gate Moving Tape / Ribbon Icon (16x16)
    const [cFlag, ctxFlag] = createOffscreen(16, 16);
    ctxFlag.fillStyle = '#181828';
    ctxFlag.fillRect(0, 4, 16, 8);
    ctxFlag.fillStyle = '#f8d038';
    ctxFlag.fillRect(1, 5, 14, 6);
    // White & gold checkered tape stripe
    for (let sx = 1; sx < 15; sx += 2) {
      ctxFlag.fillStyle = (sx >> 1) % 2 === 0 ? '#ffffff' : '#fce078';
      ctxFlag.fillRect(sx, 6, 2, 4);
    }
    // Central star/diamond clasp
    ctxFlag.fillStyle = '#181828';
    ctxFlag.fillRect(6, 5, 4, 6);
    ctxFlag.fillStyle = '#fff8c8';
    ctxFlag.fillRect(7, 6, 2, 4);
    ctxFlag.fillStyle = '#f8a820';
    ctxFlag.fillRect(7, 7, 2, 2);
    this.flagTriangle = cFlag;

    // Toodle (Toad) 16x24 NES Pixel Art Sprite (Standing & Cheering frames facing left)
    const toodlePalette = {
      '.': 'transparent',
      'K': '#000000',
      'W': '#ffffff',
      'R': '#d82800',
      'S': NES_COLORS.MARIO_SKIN,
      'B': '#2038ec',
      'G': '#fce078',
      'F': '#a04000',
    };

    const toodleIdlePattern = [
      '....KKKKKKKK....',
      '..KKWWWWWWWWKK..',
      '.KWWWRRRRRRWWWK.',
      'KWWRRRRRRRRRRWWK',
      'KWRRRRRWWWRRRRWK',
      'KWWRRRWWWWWRRWWK',
      'KWWWWWWWWWWWWWWK',
      'KRRWWWWWWWWWWWRK',
      'KRRRWWWWWWWWWRRK',
      '.KKSSSSSSSSSSKK.',
      '..KSSKKSSKKSSK..',
      '..KSSKKSSKKSSK..',
      '..KSSSSSSSSSSK..',
      '...KKSSSSSSKK...',
      '..KBBWWWWWWBBK..',
      '.KWBBWWGGWWBBWK.',
      '.KWBBWWWWWWBBWK.',
      '.KSBBWWWWWWBBSK.',
      '..KWWWWWWWWWWK..',
      '..KWWWWWWWWWWK..',
      '...KFFF..FFFK...',
      '..KFFFF..FFFFK..',
      '..KKKKK..KKKKK..',
      '................',
    ];

    const toodleHappyPattern = [
      '....KKKKKKKK....',
      '..KKWWWWWWWWKK..',
      '.KWWWRRRRRRWWWK.',
      'KWWRRRRRRRRRRWWK',
      'KWRRRRRWWWRRRRWK',
      'KWWRRRWWWWWRRWWK',
      'KWWWWWWWWWWWWWWK',
      'KRRWWWWWWWWWWWRK',
      'KRRRWWWWWWWWWRRK',
      '.KKSSSSSSSSSSKK.',
      'KSKSSKKSSKKSSKSK',
      'KWWSSKKSSKKSSWWK',
      '.KWSSSSSSSSSSWK.',
      '..KKKSSSSSSKKK..',
      '..KBBWWWWWWBBK..',
      '..KBBWWGGWWBBK..',
      '..KBBWWWWWWBBK..',
      '..KBBWWWWWWBBK..',
      '..KWWWWWWWWWWK..',
      '..KWWWWWWWWWWK..',
      '...KFFF..FFFK...',
      '..KFFFF..FFFFK..',
      '..KKKKK..KKKKK..',
      '................',
    ];

    const [cToodle1, ctxToodle1] = createOffscreen(16, 24);
    drawPixelGrid(ctxToodle1, toodleIdlePattern, toodlePalette);
    this.toodleSprite = cToodle1;

    const [cToodle2, ctxToodle2] = createOffscreen(16, 24);
    drawPixelGrid(ctxToodle2, toodleHappyPattern, toodlePalette);
    this.toodleHappySprite = cToodle2;

    // Princesa Femboy (16x28 NES Pixel Art Sprite facing left: golden crown, pink gem, pastel dress, bow & thigh-highs)
    const princessPalette = {
      '.': 'transparent',
      'K': '#000000',
      'G': '#fce078', // Royal crown gold
      'O': '#e09000', // Crown gold shadow
      'P': '#ff4da6', // Hot pastel pink bow & dress
      'L': '#ffd6ee', // Soft blush white-pink frills & stockings
      'H': '#ffe082', // Blonde-gold flowing hair
      'S': NES_COLORS.MARIO_SKIN,
      'B': '#ff7aa8', // Rosy cheeks
      'W': '#ffffff', // Highlights
      'F': '#d82878', // Shoes
    };

    const princessIdlePattern = [
      '.....KKKKKK.....',
      '....KGGPPGGK....',
      '....KGOGGOGK....',
      '...KKHHHHHHKK...',
      '..KHHHHHHHHHHK..',
      '.KHHHHWWWWHHHHK.',
      '.KHHSSSSSSSSHHK.',
      '.KHKSSKSSKSSKHK.',
      '.KHKSSKSSKSSKHK.',
      '.KHHBSSSSSSBHHK.',
      '..KHHSSSSSSHHK..',
      '..KHHKKPPKKHHK..',
      '.KHHKPPPPPPKHHK.',
      '.KHKLLPPPPPLLHK.',
      '..KKLPPPPPPPLKK.',
      '...KPPPPPPPPPK..',
      '..KPPPPWWPPPPPK.',
      '..KPPPLLLLPPPK..',
      '.KPPPLLLLLLPPPK.',
      '.KPPWLLLLLLWPPK.',
      '.KLLLLLLLLLLLLK.',
      '..KKKKKKKKKKKK..',
      '...KLLK..KLLK...',
      '...KLLK..KLLK...',
      '...KPPK..KPPK...',
      '..KFFFK..KFFFK..',
      '..KKKKK..KKKKK..',
      '................',
    ];

    const princessHappyPattern = [
      '.....KKKKKK.....',
      '....KGGPPGGK....',
      '....KGOGGOGK....',
      '...KKHHHHHHKK...',
      '..KHHHHHHHHHHK..',
      '.KHHHHWWWWHHHHK.',
      '.KHHSSSSSSSSHHK.',
      'KSKSSSKSSKSSSKSK',
      'KSKSSSKSSKSSSKSK',
      '.KHHBSSSSSSBHHK.',
      '..KHHSSSSSSHHK..',
      '..KHHKKPPKKHHK..',
      '..KHKPPPPPPKHK..',
      '..KKLLPPPPPLKK..',
      '...KLPPPPPPPLK..',
      '...KPPPPPPPPPK..',
      '..KPPPPWWPPPPPK.',
      '..KPPPLLLLPPPK..',
      '.KPPPLLLLLLPPPK.',
      '.KPPWLLLLLLWPPK.',
      '.KLLLLLLLLLLLLK.',
      '..KKKKKKKKKKKK..',
      '...KLLK..KLLK...',
      '...KLLK..KLLK...',
      '...KPPK..KPPK...',
      '..KFFFK..KFFFK..',
      '..KKKKK..KKKKK..',
      '................',
    ];

    const [cPrin1, ctxPrin1] = createOffscreen(16, 28);
    drawPixelGrid(ctxPrin1, princessIdlePattern, princessPalette);
    this.princessFemboySprite = cPrin1;

    const [cPrin2, ctxPrin2] = createOffscreen(16, 28);
    drawPixelGrid(ctxPrin2, princessHappyPattern, princessPalette);
    this.princessFemboyHappySprite = cPrin2;
  }

  private generateParticles() {
    // Fireball (8x8)
    for (let i = 0; i < 4; i++) {
      const [cFB, ctxFB] = createOffscreen(8, 8);
      ctxFB.fillStyle = '#d82800';
      ctxFB.fillRect(1, 1, 6, 6);
      ctxFB.fillStyle = '#fce078';
      ctxFB.fillRect(2, 2, 4, 4);
      ctxFB.fillStyle = '#ffffff';
      ctxFB.fillRect(3, 3, 2, 2);
      this.fireballFrames.push(cFB);

      // Pure White Ball (8x8) for Femboy landing ability
      const [cWFB, ctxWFB] = createOffscreen(8, 8);
      ctxWFB.fillStyle = '#ffffff';
      if (i % 2 === 0) {
        ctxWFB.fillRect(2, 0, 4, 8);
        ctxWFB.fillRect(1, 1, 6, 6);
        ctxWFB.fillRect(0, 2, 8, 4);
      } else {
        ctxWFB.fillRect(2, 1, 4, 6);
        ctxWFB.fillRect(1, 2, 6, 4);
        ctxWFB.fillRect(3, 0, 2, 8);
        ctxWFB.fillRect(0, 3, 8, 2);
      }
      this.whiteFireballFrames.push(cWFB);
    }

    // Bowser Horizontal Fire Breath (16x8, facing left)
    this.bowserFireFrames = [];
    for (let i = 0; i < 2; i++) {
      const [cBF, ctxBF] = createOffscreen(16, 8);
      ctxBF.fillStyle = '#d82800';
      ctxBF.fillRect(0, 2, 16, 4);
      ctxBF.fillRect(3, 1, 10, 6);
      ctxBF.fillStyle = '#fc9838';
      ctxBF.fillRect(2, 2, 11, 4);
      ctxBF.fillStyle = i === 0 ? '#fce078' : '#ffffff';
      ctxBF.fillRect(3, 3, 6, 2);
      ctxBF.fillStyle = '#ffffff';
      ctxBF.fillRect(2, 3, 2, 2);
      this.bowserFireFrames.push(cBF);
    }

    // Brick Debris (8x8)
    const [cDebris, ctxDebris] = createOffscreen(8, 8);
    ctxDebris.fillStyle = NES_COLORS.BRICK_RED;
    ctxDebris.fillRect(0, 0, 8, 8);
    ctxDebris.fillStyle = NES_COLORS.BRICK_HIGHLIGHT;
    ctxDebris.fillRect(1, 1, 3, 3);
    ctxDebris.fillStyle = '#000000';
    ctxDebris.fillRect(6, 6, 2, 2);
    this.brickDebris = cDebris;

    // Smoke puff (8x8)
    const [cSmoke, ctxSmoke] = createOffscreen(8, 8);
    ctxSmoke.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctxSmoke.beginPath();
    ctxSmoke.arc(4, 4, 3, 0, Math.PI * 2);
    ctxSmoke.fill();
    this.smokePuff = cSmoke;
  }
}
