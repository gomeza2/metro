import test from 'node:test';
import assert from 'node:assert/strict';
import {ServiceContracts} from '../.test-build/simulation/serviceContracts.js';
import {createRoutePlanner} from '../.test-build/simulation/pathfinding.js';
function snapshot(ids = ['a','b']) {
 const stations=Array.from({length:8},(_,i)=>({id:String.fromCharCode(97+i),name:String(i),kind:'residential',x:i*10,y:0,queue:[],overload:0}));
 const lines=[{id:0,stations:ids}];return {elapsed:0,score:0,stations,lines,planner:createRoutePlanner(stations,lines)};
}
test('delivery grant counts only new deliveries, pays once and cannot be farmed',()=>{
 const board=new ServiceContracts(),s=snapshot();s.score=40;
 assert.equal(board.accept('deliveries',s),true);assert.equal(board.accept('coverage',s),false);
 s.score=49;assert.equal(board.step(s),0);s.score=50;assert.equal(board.step(s),18);
 assert.equal(board.step(s),0);assert.equal(board.accept('deliveries',s),false);assert.equal(board.completed.size,1);
});
test('deadlines expire on the exact boundary and resetting restores offers',()=>{
 const board=new ServiceContracts(),s=snapshot();board.accept('deliveries',s);
 s.elapsed=75;s.score=10;assert.equal(board.step(s),0);assert.equal(board.active,null);assert.equal(board.completed.size,0);
 assert.equal(board.accept('deliveries',s),false);board.reset();assert.equal(board.accept('deliveries',s),true);
});
test('coverage requires one connected component, not eight isolated stops',()=>{
 const board=new ServiceContracts(),s=snapshot();board.accept('coverage',s);assert.equal(board.step(s),0);
 s.lines[0].stations=s.stations.map(x=>x.id);s.planner=createRoutePlanner(s.stations,s.lines);assert.equal(board.step(s),14);
});
test('transfer hub ignores inactive one-station lines',()=>{
 const board=new ServiceContracts(),s=snapshot();s.lines.push({id:1,stations:['a']},{id:2,stations:['a']});
 board.accept('interchange',s);assert.equal(board.step(s),0);
 s.lines[1].stations.push('c');s.lines[2].stations.push('d');assert.equal(board.step(s),12);
});
