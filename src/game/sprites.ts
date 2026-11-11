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

  // Helper to obtain the correct sprite for any character (Mario or WazzimaGiygg)
  public getCharacterSprite(
    character: 'mario' | 'wazzima',
    power: 'small' | 'super' | 'fire' | 'tanooki',
    state: string,
    animFrame: number,
    options: {
      isStatue?: boolean;
      tailWhipTimer?: number;
      isFluttering?: boolean;
      marioVx?: number;
    } = {}
  ): HTMLCanvasElement {
    const isW = character === 'wazzima';
    const isStatue = !!options.isStatue;
    const tailWhipTimer = options.tailWhipTimer || 0;
    const isFluttering = !!options.isFluttering;
    const marioVx = options.marioVx || 0;

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
  
  public piranha1!: HTMLCanvasElement;
  public piranha2!: HTMLCanvasElement;

  // Tiles (16x16)
  public tileGround!: HTMLCanvasElement;
  public tileGroundUnderground!: HTMLCanvasElement;
  public tileBrick!: HTMLCanvasElement;
  public tileBrickUnderground!: HTMLCanvasElement;
  public tileQuestionFrames: HTMLCanvasElement[] = [];
  public tileQuestionEmpty!: HTMLCanvasElement;
  public tileHardBlock!: HTMLCanvasElement;
  
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
  
  // Castle & Scenery
  public castleBrick!: HTMLCanvasElement;
  public castleCrenel!: HTMLCanvasElement;
  public castleDoor!: HTMLCanvasElement;
  public castleWindow!: HTMLCanvasElement;
  public flagPoleTop!: HTMLCanvasElement;
  public flagPoleBody!: HTMLCanvasElement;
  public flagTriangle!: HTMLCanvasElement;

  // Particles & Projectiles
  public fireballFrames: HTMLCanvasElement[] = [];
  public brickDebris!: HTMLCanvasElement;
  public smokePuff!: HTMLCanvasElement;

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

    // Flagpole Ball Top (16x16)
    const [cBall, ctxBall] = createOffscreen(16, 16);
    ctxBall.fillStyle = '#00a800';
    ctxBall.beginPath();
    ctxBall.arc(8, 8, 6, 0, Math.PI * 2);
    ctxBall.fill();
    ctxBall.fillStyle = '#80d010';
    ctxBall.beginPath();
    ctxBall.arc(6, 6, 2, 0, Math.PI * 2);
    ctxBall.fill();
    this.flagPoleTop = cBall;

    // Flagpole Body (16x16)
    const [cPole, ctxPole] = createOffscreen(16, 16);
    ctxPole.fillStyle = '#00a800';
    ctxPole.fillRect(7, 0, 2, 16);
    this.flagPoleBody = cPole;

    // Flag (16x16 triangle green flag)
    const [cFlag, ctxFlag] = createOffscreen(16, 16);
    ctxFlag.fillStyle = '#00a800';
    ctxFlag.beginPath();
    ctxFlag.moveTo(16, 0);
    ctxFlag.lineTo(0, 8);
    ctxFlag.lineTo(16, 16);
    ctxFlag.closePath();
    ctxFlag.fill();
    ctxFlag.fillStyle = '#80d010';
    ctxFlag.fillRect(10, 5, 4, 6);
    this.flagTriangle = cFlag;
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
