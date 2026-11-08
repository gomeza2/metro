export type Point = { x: number; y: number };
/** Uniform world-to-CSS transform, independent of the backing-store DPR. */
export class MapViewport {
  zoom = 1;
  x = 600;
  y = 380;
  constructor(public width = 1200, public height = 760) {}
  get scale(): number { return Math.min(this.width / 1200, this.height / 760) * this.zoom; }
  world(point: Point): Point {
    return { x: (point.x - this.width / 2) / this.scale + this.x, y: (point.y - this.height / 2) / this.scale + this.y };
  }
  screen(point: Point): Point {
    return { x: (point.x - this.x) * this.scale + this.width / 2, y: (point.y - this.y) * this.scale + this.height / 2 };
  }
  zoomAt(factor: number, point: Point = { x: this.width / 2, y: this.height / 2 }): void {
    const before = this.world(point);
    this.zoom = Math.max(1, Math.min(3, this.zoom * factor));
    const after = this.world(point);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }
  pan(dx: number, dy: number): void { this.x -= dx / this.scale; this.y -= dy / this.scale; this.clamp(); }
  reset(): void { this.zoom = 1; this.x = 600; this.y = 380; }
  private clamp(): void {
    const halfW = Math.min(600, this.width / (2 * this.scale));
    const halfH = Math.min(380, this.height / (2 * this.scale));
    this.x = Math.max(halfW, Math.min(1200 - halfW, this.x));
    this.y = Math.max(halfH, Math.min(760 - halfH, this.y));
  }
}
