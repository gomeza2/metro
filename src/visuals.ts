type Point = { x: number; y: number };

function road(ctx: CanvasRenderingContext2D, points: Point[], width: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]!;
    ctx.lineTo(point.x, point.y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#d5dbd2';
  ctx.lineWidth = width + 5;
  ctx.stroke();
  ctx.strokeStyle = '#f8f8f1';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([2, 10]);
  ctx.strokeStyle = '#e2e6de';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  ctx.fillStyle = 'rgba(53,79,62,.12)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8eae91';
  ctx.beginPath();
  ctx.arc(x, y, 5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b2c9a8';
  ctx.beginPath();
  ctx.arc(x - 1.5 * scale, y - 1.5 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function building(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: string): void {
  ctx.fillStyle = 'rgba(53,69,57,.09)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, w, h, 4);
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(151,165,148,.34)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(248,249,239,.58)';
  const cols = Math.max(1, Math.floor((w - 10) / 12));
  const rows = Math.max(1, Math.floor((h - 9) / 11));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      ctx.fillRect(x + 5 + col * 12, y + 5 + row * 11, 4, 4);
    }
  }
}

export function drawCityOverlay(ctx: CanvasRenderingContext2D, time: number): void {
  // Roads create a coherent street plan under the transit network.
  const arterial: Point[][] = [
    [{x:35,y:385},{x:250,y:385},{x:405,y:365},{x:615,y:405},{x:825,y:390},{x:1010,y:420}],
    [{x:180,y:105},{x:300,y:175},{x:455,y:210},{x:610,y:230},{x:780,y:265},{x:990,y:280}],
    [{x:320,y:520},{x:460,y:515},{x:625,y:535},{x:790,y:535},{x:960,y:555}],
    [{x:720,y:75},{x:710,y:205},{x:735,y:340},{x:720,y:490},{x:760,y:685}],
    [{x:90,y:270},{x:225,y:320},{x:350,y:455},{x:410,y:600}],
  ];
  for (const path of arterial) road(ctx, path, 12);

  // The river gets a few quiet moving glints and a bridge crossing.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const y = 70 + i * 112;
    const offset = (time * 5 + i * 29) % 58;
    ctx.beginPath();
    ctx.moveTo(1110 + offset * 0.2, y);
    ctx.quadraticCurveTo(1136 + offset * 0.2, y + 7, 1160, y + 1);
    ctx.stroke();
  }
  ctx.fillStyle = '#c5d4cc';
  ctx.fillRect(1069, 393, 112, 12);
  ctx.fillStyle = '#f6f5ed';
  ctx.fillRect(1069, 389, 112, 4);
  ctx.fillRect(1069, 405, 112, 4);
  for (let x = 1080; x < 1180; x += 20) {
    ctx.fillStyle = '#b9c4b9';
    ctx.fillRect(x, 390, 3, 13);
  }
  ctx.restore();

  // Parks: paths, planting beds, and repeated tree groups.
  ctx.fillStyle = 'rgba(107,151,113,.12)';
  ctx.beginPath();
  ctx.roundRect(224, 264, 176, 76, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(249,249,239,.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(235, 326);
  ctx.quadraticCurveTo(305, 280, 390, 273);
  ctx.stroke();
  [[235,277],[260,326],[286,278],[312,333],[340,276],[370,322],[388,294],[930,568],[967,598],[1008,569],[1025,608],[946,620]].forEach(([x,y]) => tree(ctx,x!,y!,0.9));
  tree(ctx, 220, 375, 0.75); tree(ctx, 430, 335, 0.8);

  // Distinct city landmarks help players read the map at a glance.
  // Stadium: oval arena with a running track.
  ctx.save();
  ctx.translate(1040, 235);
  ctx.fillStyle = '#d5ded2';
  ctx.beginPath(); ctx.ellipse(0, 0, 64, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f7f7ef'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, 53, 31, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#9bb397'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 44, 24, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#b8ceb0';
  ctx.beginPath(); ctx.ellipse(0, 0, 25, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Museum / cultural quarter.
  building(ctx, 482, 241, 28, 18, '#d8d8c8');
  building(ctx, 552, 238, 35, 22, '#d2d8ce');
  building(ctx, 565, 315, 26, 20, '#ddd8c9');
  ctx.fillStyle = '#a9b89f';
  ctx.fillRect(518, 250, 5, 44);
  ctx.fillRect(524, 250, 5, 44);
  ctx.fillRect(530, 250, 5, 44);
  ctx.fillRect(536, 250, 5, 44);

  // Market blocks and harbor piers.
  building(ctx, 318, 477, 39, 25, '#d8d9ca');
  building(ctx, 365, 486, 34, 22, '#d1d9ce');
  building(ctx, 416, 470, 34, 28, '#ded7c7');
  ctx.strokeStyle = '#aab7a9';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(72, 359); ctx.lineTo(132, 359); ctx.lineTo(132, 392); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(82, 405); ctx.lineTo(145, 405); ctx.stroke();

  // University court.
  ctx.fillStyle = '#d6ddcf';
  ctx.beginPath(); ctx.roundRect(742, 125, 112, 58, 8); ctx.fill();
  ctx.strokeStyle = '#f7f7ef'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(753, 136); ctx.lineTo(843, 136); ctx.lineTo(843, 171); ctx.lineTo(753, 171); ctx.closePath(); ctx.stroke();
  building(ctx, 752, 146, 22, 17, '#d0d4c4');
  building(ctx, 820, 146, 18, 17, '#d0d4c4');

  // Residential texture: low-rise blocks with warm rooftops.
  building(ctx, 334, 74, 36, 22, '#ded9ca');
  building(ctx, 374, 70, 28, 26, '#d4d9cd');
  building(ctx, 820, 80, 43, 25, '#ded8c9');
  building(ctx, 875, 85, 30, 20, '#d0d9ce');
  building(ctx, 914, 470, 37, 22, '#ddd6c7');
  building(ctx, 966, 464, 33, 25, '#d1dacf');

  // Runway at the far side of town.
  ctx.fillStyle = '#d2d8cf';
  ctx.beginPath(); ctx.roundRect(1010, 54, 157, 34, 5); ctx.fill();
  ctx.fillStyle = '#f4f5ed';
  ctx.fillRect(1020, 69, 135, 2);
  for (let x = 1030; x < 1150; x += 23) ctx.fillRect(x, 64, 8, 1);

  // Small district names and visual landmarks.
  ctx.fillStyle = 'rgba(108,128,113,.75)';
  ctx.font = '700 8px "DM Mono", monospace';
  ctx.letterSpacing = '1.2px';
  ctx.fillText('GRAND ARENA', 1000, 184);
  ctx.fillText('CULTURE QUARTER', 477, 220);
  ctx.fillText('CAMPUS', 765, 117);
  ctx.fillText('HARBOR FRONT', 58, 439);
  ctx.fillText('AIRFIELD', 1084, 47);
  ctx.letterSpacing = '0px';
}
