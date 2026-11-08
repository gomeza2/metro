import test from 'node:test';
import assert from 'node:assert/strict';
import { MapViewport } from '../.test-build/mapViewport.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
test('portrait viewport preserves proportions and round-trips station coordinates',()=>{
 const view=new MapViewport(390,420);
 for(const point of [{x:145,y:355},{x:1090,y:100}]) {
  const result=view.world(view.screen(point)); near(result.x,point.x);near(result.y,point.y);
 }
 near(view.screen({x:600,y:380}).x,195);
 near(view.screen({x:600,y:380}).y,210);
 near(view.screen({x:601,y:380}).x-195,210-view.screen({x:600,y:379}).y);
});
test('zoom preserves the world point under the cursor away from boundaries',()=>{
 const view=new MapViewport(1200,760);
 const point={x:700,y:400},before=view.world(point);
 view.zoomAt(2,point);const after=view.world(point);
 near(after.x,before.x);near(after.y,before.y);
});
test('pan is bounded; zoom out and reset recover the full city',()=>{
 const view=new MapViewport(1200,760);view.zoomAt(2);view.pan(10000,10000);
 near(view.x,300);near(view.y,190);view.zoomAt(.01);near(view.zoom,1);near(view.x,600);near(view.y,380);
 view.zoomAt(100);assert.equal(view.zoom,3);view.reset();assert.equal(view.zoom,1);
});
