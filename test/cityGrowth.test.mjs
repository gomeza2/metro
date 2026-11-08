import test from 'node:test';import assert from 'node:assert/strict';
import {cityGrowthAt,tutorialStep} from '../.test-build/simulation/cityGrowth.js';
import {NetworkCommands} from '../.test-build/simulation/networkCommands.js';
import {GameSimulation} from '../.test-build/simulation/gameSimulation.js';
import {RunState} from '../.test-build/simulation/runState.js';
test('a progressive city opens three stops and one line, then grows before stadium phases',()=>{
 assert.deepEqual(cityGrowthAt(0,true).ids,['north','museum','market']);assert.equal(cityGrowthAt(0,true).lines,1);
 assert.equal(cityGrowthAt(29.99,true).ids.length,3);assert.equal(cityGrowthAt(30,true).ids.length,6);assert.equal(cityGrowthAt(30,true).lines,2);
 assert.equal(cityGrowthAt(60,true).ids.length,10);assert.ok(cityGrowthAt(60,true).ids.includes('stadium'));
 assert.equal(cityGrowthAt(150,true).ids.length,14);assert.equal(cityGrowthAt(150,true).lines,4);assert.equal(cityGrowthAt(999,true).nextAt,null);
 assert.equal(new Set(cityGrowthAt(150,true).ids).size,14);assert.equal(cityGrowthAt(0,false).ids.length,14);
});
test('tutorial advances from real actions and does not require a timed or blocking confirmation',()=>{
 const snapshot={connected:false,delivered:0,pausedOnce:false,inspected:false};assert.equal(tutorialStep(snapshot),'connect');
 snapshot.connected=true;assert.equal(tutorialStep(snapshot),'observe');snapshot.delivered=1;assert.equal(tutorialStep(snapshot),'plan');
 snapshot.pausedOnce=true;assert.equal(tutorialStep(snapshot),'inspect');snapshot.inspected=true;assert.equal(tutorialStep(snapshot),'done');
});
test('unopened stations reject route edits and cannot receive generated passenger trips',()=>{
 const stations=['A','B','C'].map((id,i)=>({id,name:id,x:i*50,y:0,kind:'residential',queue:[],overload:0,active:id!=='C'}));
 const lines=[{id:0,stations:[],trains:[],fleetSize:1}],network=new NetworkCommands(stations,lines);
 assert.equal(network.selectStation(0,'C'),'invalid');network.selectStation(0,'A');network.selectStation(0,'B');
 const state=new RunState();const engine=new GameSimulation({stations,lines,state,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>1,getExpressLevel:()=>1,random:()=>0,onOverload:()=>{}});
 for(let i=0;i<600;i++)engine.step(1/60);
 assert.ok(state.passengerId>1);assert.equal(stations[2].queue.length,0);
 for(const station of stations)for(const p of station.queue)assert.notEqual(p.destination,'C');
});
