export class Camera {
  public x = 0;
  public y = 0;
  private shakeTimer = 0;
  private shakeMagnitude = 0;
  private shakeEnabled = true;

  public setShakeEnabled(enabled: boolean): void {
    this.shakeEnabled = enabled;
    if (!enabled) {
      this.shakeTimer = 0;
      this.shakeMagnitude = 0;
    }
  }

  public shake(magnitude: number, duration = 0.16): void {
    if (!this.shakeEnabled) return;
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  public update(
    dt: number,
    targetX: number,
    targetY: number,
    viewW: number,
    viewH: number,
    roomW: number,
    roomH: number,
    snap = false
  ): void {
    let desiredX = targetX - viewW / 2;
    let desiredY = targetY - viewH / 2;

    if (roomW <= viewW) {
      desiredX = (roomW - viewW) / 2;
    } else {
      desiredX = Math.max(-80, Math.min(roomW - viewW + 80, desiredX));
    }

    if (roomH <= viewH) {
      desiredY = (roomH - viewH) / 2;
    } else {
      desiredY = Math.max(-80, Math.min(roomH - viewH + 80, desiredY));
    }

    if (snap) {
      this.x = desiredX;
      this.y = desiredY;
    } else {
      const lerp = 1 - Math.exp(-12 * dt);
      this.x += (desiredX - this.x) * lerp;
      this.y += (desiredY - this.y) * lerp;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) {
        this.shakeMagnitude = 0;
      }
    }
  }

  public getOffset(): { ox: number; oy: number } {
    if (this.shakeTimer <= 0 || this.shakeMagnitude <= 0) {
      return { ox: -Math.round(this.x), oy: -Math.round(this.y) };
    }
    const sx = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
    const sy = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
    return {
      ox: -Math.round(this.x + sx),
      oy: -Math.round(this.y + sy),
    };
  }
}
