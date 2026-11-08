import type { StationKind } from './simulation/gameTypes';
/** Original, small vector landmarks; readable without downloaded artwork. */
export function drawStationArt(ctx: CanvasRenderingContext2D, kind: StationKind, x: number, y: number, size: number, stadium = false): void {
  ctx.save();ctx.translate(x,y);ctx.scale(size/12,size/12);ctx.lineWidth=1.7;ctx.lineJoin='round';ctx.strokeStyle='#fffdf0';ctx.fillStyle='#fffdf0';
  if(stadium){ctx.beginPath();ctx.ellipse(0,0,9,6,0,0,Math.PI*2);ctx.stroke();ctx.strokeRect(-4,-3,8,6);}
  else if(kind==='residential'){ctx.beginPath();ctx.moveTo(-8,-1);ctx.lineTo(0,-8);ctx.lineTo(8,-1);ctx.stroke();ctx.strokeRect(-6,-1,12,9);ctx.fillRect(-1,2,3,6);}
  else if(kind==='culture'){ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(0,-9);ctx.lineTo(9,-4);ctx.closePath();ctx.fill();for(const x of [-6,0,6])ctx.fillRect(x-1,-2,2,9);ctx.fillRect(-9,8,18,2);}
  else if(kind==='commerce'){ctx.strokeRect(-7,-2,14,10);ctx.beginPath();ctx.moveTo(-9,-2);ctx.lineTo(-6,-8);ctx.lineTo(6,-8);ctx.lineTo(9,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#244334';ctx.fillRect(-1,-7,2,5);ctx.fillStyle='#fffdf0';ctx.fillRect(-1,3,3,5);}
  else if(kind==='civic'){ctx.fillRect(-2,-8,4,16);ctx.fillRect(-8,-2,16,4);}
  else{ctx.fillRect(-1,2,2,7);ctx.beginPath();ctx.arc(0,-3,7,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
