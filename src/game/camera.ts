/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CameraConfig {
  viewportWidth: number;
  characterWidth: number;
  /** Screen X window where the character can move without pulling the camera */
  deadzoneLeft: number;
  deadzoneRight: number;
  /** Hard outer viewport boundaries (screen space) the character is kept within */
  viewportMinScreenX: number;
  viewportMaxScreenX: number;
  /** Base lerp factor per frame (0..1) */
  baseLerp: number;
  /** Maximum lerp factor at high speed or near viewport boundary (0..1) */
  maxLerp: number;
}

export class CameraSystem {
  public x: number = 0;
  public targetX: number = 0;
  /** Integer-aligned camera X used for pixel-crisp rendering without tile/sprite shimmer */
  public renderX: number = 0;

  private readonly config: CameraConfig;

  constructor(config?: Partial<CameraConfig>) {
    const viewportWidth = config?.viewportWidth ?? 256;
    const characterWidth = config?.characterWidth ?? 16;
    const centerScreenX = (viewportWidth - characterWidth) / 2; // 120 on 256px NES width

    this.config = {
      viewportWidth,
      characterWidth,
      deadzoneLeft: config?.deadzoneLeft ?? centerScreenX - 10, // 110
      deadzoneRight: config?.deadzoneRight ?? centerScreenX + 10, // 130
      viewportMinScreenX: config?.viewportMinScreenX ?? 48,
      viewportMaxScreenX: config?.viewportMaxScreenX ?? 180,
      baseLerp: config?.baseLerp ?? 0.14,
      maxLerp: config?.maxLerp ?? 0.28,
    };
  }

  /** Instantly jumps the camera to a specific world X within level/zone bounds */
  public snapTo(
    desiredX: number,
    levelWidthPx: number,
    bounds?: { minX?: number; maxX?: number }
  ) {
    const boundMin = Math.max(0, bounds?.minX ?? 0);
    const boundMax = Math.min(levelWidthPx, bounds?.maxX ?? levelWidthPx);
    const minCamX = Math.min(boundMin, Math.max(0, boundMax - this.config.viewportWidth));
    const maxCamX = Math.max(minCamX, boundMax - this.config.viewportWidth);
    const clamped = Math.max(minCamX, Math.min(maxCamX, desiredX));
    this.x = clamped;
    this.targetX = clamped;
    this.renderX = Math.round(clamped);
  }

  /** Instantly centers the camera on the character within level/zone bounds */
  public centerOn(
    characterX: number,
    levelWidthPx: number,
    bounds?: { minX?: number; maxX?: number }
  ) {
    const centerOffset = (this.config.viewportWidth - this.config.characterWidth) / 2;
    this.snapTo(characterX - centerOffset, levelWidthPx, bounds);
  }

  /**
   * Smoothly follows Mario using velocity-adaptive lerping, a centered deadzone window,
   * and outer viewport boundary clamping to prevent jittering at high speeds.
   */
  public follow(
    marioX: number,
    marioVx: number,
    levelWidthPx: number,
    bounds?: { minX?: number; maxX?: number }
  ) {
    const boundMin = Math.max(0, bounds?.minX ?? 0);
    const boundMax = Math.min(levelWidthPx, bounds?.maxX ?? levelWidthPx);
    const minCamX = Math.min(boundMin, Math.max(0, boundMax - this.config.viewportWidth));
    const maxCamX = Math.max(minCamX, boundMax - this.config.viewportWidth);
    const {
      deadzoneLeft,
      deadzoneRight,
      viewportMinScreenX,
      viewportMaxScreenX,
      baseLerp,
      maxLerp,
    } = this.config;

    // 1. Update desired camera target only when Mario steps outside the centered deadzone
    const relativeScreenX = marioX - this.targetX;
    if (relativeScreenX > deadzoneRight) {
      this.targetX = marioX - deadzoneRight;
    } else if (relativeScreenX < deadzoneLeft) {
      this.targetX = marioX - deadzoneLeft;
    }

    this.targetX = Math.max(minCamX, Math.min(maxCamX, this.targetX));

    // 2. Scale lerp stiffness smoothly with speed and proximity to outer viewport bounds
    const speedFactor = Math.min(1, Math.abs(marioVx) / 3.8);
    const currentScreenX = marioX - this.x;
    let boundaryUrgency = 0;

    if (currentScreenX > deadzoneRight) {
      boundaryUrgency = Math.min(
        1,
        (currentScreenX - deadzoneRight) / Math.max(1, viewportMaxScreenX - deadzoneRight)
      );
    } else if (currentScreenX < deadzoneLeft) {
      boundaryUrgency = Math.min(
        1,
        (deadzoneLeft - currentScreenX) / Math.max(1, deadzoneLeft - viewportMinScreenX)
      );
    }

    const adaptiveLerp =
      baseLerp + (maxLerp - baseLerp) * Math.max(speedFactor * 0.85, boundaryUrgency);

    // 3. Smooth exponential interpolation toward targetX (snap cleanly when settled)
    const delta = this.targetX - this.x;
    if (Math.abs(delta) < 0.04 && Math.abs(marioVx) < 0.05) {
      this.x = this.targetX;
    } else {
      this.x += delta * adaptiveLerp;
    }

    // 4. Hard outer viewport boundary safety clamp (prevents Mario from ever nearing screen edges)
    const minCamForBounds = marioX - viewportMaxScreenX;
    const maxCamForBounds = marioX - viewportMinScreenX;
    if (this.x < minCamForBounds) {
      this.x = minCamForBounds;
    } else if (this.x > maxCamForBounds) {
      this.x = maxCamForBounds;
    }

    // 5. Final zone bounds clamp + integer pixel alignment for shimmer-free rendering
    this.x = Math.max(minCamX, Math.min(maxCamX, this.x));
    this.renderX = Math.round(this.x);
  }
}
