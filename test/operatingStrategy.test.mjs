import test from 'node:test';
import assert from 'node:assert/strict';
import {trainSeats,trainSpeed,serviceEstimate} from '../.test-build/simulation/operatingPolicies.js';
import {stationQueueLimit,platformCost} from '../.test-build/simulation/stationCapacity.js';
import {NetworkCommands} from '../.test-build/simulation/networkCommands.js';
import {RunEconomy} from '../.test-build/simulation/runEconomy.js';
import {GameSimulation} from '../.test-build/simulation/gameSimulation.js';
import {RunState} from '../.test-build/simulation/runState.js';
function game(){
 const stations=['A','B'].map((id,i)=>({id,name:id,x:i*100,y:0,kind:'residential',queue:[],overload:0}));
 const lines=[{id:0,stations:[],trains:[],fleetSize:1}];const network=new NetworkCommands(stations,lines);network.selectStation(0,'A');network.selectStation(0,'B');
 const state=new RunState(),economy=new RunEconomy();
 const engine=new GameSimulation({stations,lines,state,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>economy.capacityLevel,getExpressLevel:()=>economy.expressLevel,random:()=>0,onOverload:()=>{}});
 return {stations,lines,network,state,economy,engine};
}
test('operating policies trade seats against speed and retain the original balanced tuning',()=>{
 assert.equal(trainSeats(1),6);assert.equal(trainSpeed(1),105);
 assert.equal(trainSeats(1,'local'),9);assert.equal(trainSeats(1,'rapid'),4);
 assert.ok(trainSpeed(1,'local')<trainSpeed(1));assert.ok(trainSpeed(1,'rapid')>trainSpeed(1));
 assert.equal(trainSeats(2,'local'),18);
 const estimate=serviceEstimate([{x:0,y:0},{x:105,y:0}],2,1,1,'balanced');
 assert.equal(estimate.roundTrip,2.9);assert.equal(estimate.headway,1.45);assert.equal(estimate.seats,6);
 assert.equal(serviceEstimate([],1,1,1,'balanced').roundTrip,0);
});
test('policy changes charge once on active lines, are free before service and reject bad budgets',()=>{
 const g=game();assert.equal(g.network.setPolicy(0,'local',g.state),true);assert.equal(g.state.credits,22);
 assert.equal(g.network.setPolicy(0,'local',g.state),false);assert.equal(g.state.credits,22);
 assert.equal(g.network.setPolicy(0,'rapid',{credits:5}),false);
 g.network.clear(0);assert.equal(g.network.setPolicy(0,'rapid',g.state),true);assert.equal(g.state.credits,22);
 assert.equal(g.network.setPolicy(0,'balanced',{credits:NaN}),false);
});
test('a moving train keeps its current policy until arrival and no rider is removed by a lower capacity',()=>{
 const g=game(),train=g.lines[0].trains[0];train.dwell=0;train.progress=.1;train.policy='balanced';
 train.passengers=Array.from({length:6},(_,i)=>({id:i+1,origin:'A',destination:'A',route:['A','B','A']}));
 g.network.setPolicy(0,'rapid',g.state);g.engine.step(.1);
 assert.equal(train.policy,'balanced');assert.equal(train.passengers.length,6);
 for(let i=0;i<60;i++)g.engine.step(1/60);
 assert.equal(train.policy,'rapid');assert.equal(train.passengers.length,6);assert.equal(g.state.score,0);
});
test('local service boards nine eligible riders while balanced service boards six',()=>{
 for(const [policy,seats] of [['balanced',6],['local',9],['rapid',4]]){
  const g=game();g.lines[0].policy=policy;g.lines[0].trains[0].dwell=.01;
  g.stations[0].queue=Array.from({length:10},(_,i)=>({id:i,origin:'A',destination:'B',route:['A','B']}));
  g.engine.step(.02);assert.equal(g.lines[0].trains[0].passengers.length,seats);
 }
});
test('platform investment expands a specific station, costs funds and cannot be repeated past its limit',()=>{
 const g=game();g.state.credits=100;
 assert.equal(stationQueueLimit(g.stations[0]),12);assert.equal(platformCost(g.stations[0]),16);
 assert.equal(g.economy.expandPlatform(g.stations[0],g.state).ok,true);assert.equal(g.state.credits,84);assert.equal(stationQueueLimit(g.stations[0]),18);
 assert.equal(g.economy.expandPlatform(g.stations[0],g.state).cost,34);assert.equal(g.state.credits,50);assert.equal(stationQueueLimit(g.stations[0]),24);
 assert.equal(g.economy.expandPlatform(g.stations[0],g.state).reason,'maxed');assert.equal(g.state.credits,50);assert.equal(stationQueueLimit(g.stations[1]),12);
 g.network.reset();assert.equal(stationQueueLimit(g.stations[0]),12);assert.equal(g.lines[0].policy,'balanced');
});
test('an expanded platform absorbs the same queue without adding overload pressure',()=>{
 for(const expanded of [false,true]){
  const g=game();g.lines[0].trains[0].dwell=100;
  g.stations[0].queue=Array.from({length:14},(_,i)=>({id:i,origin:'A',destination:'B',route:['A','B']}));
  if(expanded)g.economy.expandPlatform(g.stations[0],g.state);
  g.engine.step(1);assert.equal(g.stations[0].overload,expanded?0:1);
 }
});
