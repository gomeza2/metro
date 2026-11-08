type Point = { x: number; y: number };

function trace(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index]!.x, points[index]!.y);
  }
}

function road(ctx: CanvasRenderingContext2D, points: Point[], width: number, major = false): void {
  ctx.save();
  trace(ctx, points);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = major ? '#d5ddd5' : '#dfe5dc';
  ctx.lineWidth = width + 3;
  ctx.stroke();
  trace(ctx, points);
  ctx.strokeStyle = major ? '#fffefa' : '#f8faf4';
  ctx.lineWidth = width;
  ctx.stroke();
  if (major) {
    trace(ctx, points);
    ctx.strokeStyle = 'rgba(193,205,193,.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function park(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.save();
  ctx.fillStyle = '#dce9d8';
  ctx.strokeStyle = '#cbdcc9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 22);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,248,.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + height * .72);
  ctx.bezierCurveTo(x + width * .25, y + height * .18, x + width * .65, y + height * .92, x + width - 15, y + height * .25);
  ctx.stroke();
  for (let index = 0; index < 5; index += 1) {
    const tx = x + 23 + index * ((width - 48) / 4);
    const ty = y + 20 + ((index % 2) * (height - 42));
    ctx.fillStyle = '#b4cdaF';
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8dcbf';
    ctx.beginPath();
    ctx.arc(tx - 2, ty - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, tone = '#e0dfd1'): void {
  ctx.save();
  ctx.fillStyle = 'rgba(67,84,69,.08)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, width, height, 5);
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.strokeStyle = '#d0d9ce';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,247,.76)';
  const columns = Math.max(1, Math.floor((width - 14) / 13));
  const rows = Math.max(1, Math.floor((height - 12) / 12));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      ctx.fillRect(x + 7 + column * 13, y + 6 + row * 12, 5, 4);
    }
  }
  ctx.restore();
}

function districtLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(85,111,91,.72)';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawCoast(ctx: CanvasRenderingContext2D): void {
  const shoreline: Point[] = [
    { x: 1105, y: -15 }, { x: 1082, y: 95 }, { x: 1104, y: 185 },
    { x: 1072, y: 280 }, { x: 1110, y: 382 }, { x: 1080, y: 495 },
    { x: 1118, y: 605 }, { x: 1094, y: 775 },
  ];
  ctx.save();
  const water = ctx.createLinearGradient(1070, 0, 1200, 0);
  water.addColorStop(0, '#c9e0df');
  water.addColorStop(1, '#b8d4d6');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(1200, 0);
  ctx.lineTo(1200, 760);
  ctx.lineTo(1089, 760);
  for (let index = shoreline.length - 1; index >= 0; index -= 1) {
    ctx.lineTo(shoreline[index]!.x, shoreline[index]!.y);
  }
  ctx.closePath();
  ctx.fill();
  trace(ctx, shoreline);
  ctx.strokeStyle = 'rgba(255,255,250,.92)';
  ctx.lineWidth = 5;
  ctx.stroke();
  trace(ctx, shoreline);
  ctx.strokeStyle = '#9fc3c5';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawStaticCity(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#edf1e8';
  ctx.fillRect(0, 0, 1200, 760);

  // A restrained cartographic grid gives the map scale without competing with routes.
  ctx.save();
  ctx.strokeStyle = 'rgba(124,148,127,.10)';
  ctx.lineWidth = 1;
  for (let x = 40; x < 1080; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 760);
    ctx.stroke();
  }
  for (let y = 40; y < 760; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1100, y);
    ctx.stroke();
  }
  ctx.restore();

  drawCoast(ctx);
  park(ctx, 190, 238, 185, 120);
  park(ctx, 890, 548, 145, 100);
  park(ctx, 650, 82, 94, 66);

  // A small, consistent street network leaves clear space around station markers.
  const minorRoads: Point[][] = [
    [{x:55,y:105},{x:330,y:105},{x:510,y:145},{x:700,y:125},{x:910,y:145},{x:1060,y:125}],
    [{x:45,y:300},{x:225,y:310},{x:420,y:335},{x:610,y:320},{x:820,y:345},{x:1050,y:330}],
    [{x:65,y:515},{x:260,y:500},{x:465,y:520},{x:650,y:505},{x:855,y:520},{x:1050,y:500}],
    [{x:175,y:35},{x:185,y:190},{x:170,y:420},{x:190,y:690}],
    [{x:455,y:25},{x:445,y:205},{x:465,y:390},{x:455,y:700}],
    [{x:720,y:35},{x:710,y:220},{x:735,y:410},{x:720,y:700}],
    [{x:930,y:35},{x:920,y:225},{x:945,y:400},{x:940,y:700}],
  ];
  for (const path of minorRoads) road(ctx, path, 7);
  road(ctx, [{x:35,y:392},{x:235,y:380},{x:430,y:405},{x:640,y:390},{x:845,y:405},{x:1060,y:390}], 19, true);
  road(ctx, [{x:110,y:665},{x:320,y:650},{x:535,y:665},{x:760,y:650},{x:1005,y:670}], 15, true);
  road(ctx, [{x:300,y:30},{x:310,y:170},{x:290,y:390},{x:315,y:590},{x:305,y:730}], 13, true);
  road(ctx, [{x:835,y:28},{x:825,y:175},{x:845,y:350},{x:830,y:535},{x:850,y:720}], 13, true);

  // Compact building blocks add a sense of a city while preserving map readability.
  block(ctx, 52, 52, 70, 38, '#e3dfd1');
  block(ctx, 220, 52, 82, 35, '#dedfd3');
  block(ctx, 365, 52, 58, 42, '#e4dfd0');
  block(ctx, 510, 55, 82, 42, '#e1e1d5');
  block(ctx, 760, 42, 54, 40, '#e1dfd0');
  block(ctx, 965, 55, 70, 38, '#e2dfd2');
  block(ctx, 55, 545, 75, 44, '#e2dfd2');
  block(ctx, 355, 555, 68, 40, '#e4dfd0');
  block(ctx, 545, 555, 62, 42, '#e1e0d3');
  block(ctx, 765, 565, 75, 40, '#e2dfd2');
  block(ctx, 965, 565, 62, 40, '#e1dfd2');

  // Old Harbor piers and waterfront sheds.
  ctx.save();
  ctx.fillStyle = '#d5e2dc';
  ctx.fillRect(70, 365, 92, 16);
  ctx.fillRect(92, 388, 68, 10);
  ctx.fillStyle = '#b8c9c0';
  for (let x = 80; x < 155; x += 18) ctx.fillRect(x, 363, 3, 20);
  block(ctx, 74, 325, 44, 25, '#d9ded2');
  block(ctx, 125, 322, 32, 22, '#dedacc');
  ctx.restore();

  // Museum Mile is marked by a small civic square.
  ctx.save();
  ctx.fillStyle = '#e4e6db';
  ctx.strokeStyle = '#d1dbd0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(485, 230, 92, 80, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c8d9c7';
  ctx.beginPath();
  ctx.arc(530, 270, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fffefa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(530, 270, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // University courtyard.
  ctx.save();
  ctx.fillStyle = '#dfe7dc';
  ctx.strokeStyle = '#cbd8ca';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(738, 122, 104, 91, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#fffefa';
  ctx.lineWidth = 4;
  ctx.strokeRect(752, 136, 76, 62);
  ctx.fillStyle = '#d3dece';
  ctx.fillRect(774, 150, 32, 34);
  ctx.restore();

  // Grand Stadium.
  ctx.save();
  ctx.translate(1040, 235);
  ctx.fillStyle = '#d7e2d5';
  ctx.beginPath();
  ctx.ellipse(0, 0, 58, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fffefa';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 29, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#86a98e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#aac7a8';
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Airfield runway sits inside the eastern edge of the city, not over the coast.
  ctx.save();
  ctx.translate(1010, 95);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#d5ddd3';
  ctx.beginPath();
  ctx.roundRect(0, -18, 132, 36, 7);
  ctx.fill();
  ctx.strokeStyle = '#fffefa';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 9]);
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(120, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // District labels sit behind the playable stations and routes.
  districtLabel(ctx, 'JARDINES DEL OESTE', 205, 210);
  districtLabel(ctx, 'BARRIO NORTE', 350, 165);
  districtLabel(ctx, 'CASCO ANTIGUO', 392, 375);
  districtLabel(ctx, 'DISTRITO CÍVICO', 590, 485);
  districtLabel(ctx, 'RIBERA ESTE', 860, 315);
  districtLabel(ctx, 'MUELLE SUR', 500, 710);
  districtLabel(ctx, 'BORDE COSTERO', 1045, 710);
}

const CITY_LAYER_WIDTH = 1200;
const CITY_LAYER_HEIGHT = 760;
let cachedCityLayer: HTMLCanvasElement | null = null;
let cachedResolution = 0;

function getStaticCityLayer(resolution: number): HTMLCanvasElement | null {
  if (cachedCityLayer && cachedResolution >= resolution) return cachedCityLayer;
  const layer = document.createElement('canvas');
  layer.width = CITY_LAYER_WIDTH * resolution;
  layer.height = CITY_LAYER_HEIGHT * resolution;
  const layerContext = layer.getContext('2d');
  if (!layerContext) return null;
  layerContext.setTransform(resolution, 0, 0, resolution, 0, 0);
  drawStaticCity(layerContext);
  cachedResolution = resolution;
  cachedCityLayer = layer;
  return cachedCityLayer;
}

function drawWaterHighlights(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.48)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const y = 62 + index * 99;
    const offset = (time * 7 + index * 23) % 54;
    ctx.beginPath();
    ctx.moveTo(1120 + offset * .18, y);
    ctx.quadraticCurveTo(1144 + offset * .18, y + 7, 1172, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Paints Port Azure's static illustration once and reuses the cached layer. */
export function drawCityOverlay(ctx: CanvasRenderingContext2D, time: number): void {
  const resolution = Math.min(2, Math.max(1, Math.ceil(Math.abs(ctx.getTransform().a))));
  const layer = getStaticCityLayer(resolution);
  if (layer) ctx.drawImage(layer, 0, 0, CITY_LAYER_WIDTH, CITY_LAYER_HEIGHT);
  else drawStaticCity(ctx);
  drawWaterHighlights(ctx, time);
}
