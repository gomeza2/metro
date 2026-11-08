import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';
import { RunState } from '../.test-build/simulation/runState.js';
import { createRoutePlanner } from '../.test-build/simulation/pathfinding.js';
import { ServiceContracts } from '../.test-build/simulation/serviceContracts.js';

test('five-phase scenario preserves passengers across transfers, delivers stadium trips and resets cleanly',()=>{
 const stations=['home','hub','museum','stadium'].map((id,i)=>({id,name:id,x:i*25,y:0,kind:i===0?'residential':'leisure',queue:[],overload:0}));
 const lines=stations.slice(0,-1).map((station,i)=>({id:i,name:`Line ${i+1}`,color:'#fff',stations:[station.id,stations[i+1].id],fleetSize:1,trains:[{id:i,lastStationId:station.id,stationIndex:0,direction:1,progress:0,dwell:.1,passengers:[]}]}));
 let planner=createRoutePlanner(stations,lines);
 const state=new RunState();
 stations[0].queue.push({id:1,origin:'home',destination:'stadium',route:[...planner.findRoute('home','stadium')]});
 state.passengerId=2;
 const simulation=new GameSimulation({stations,lines,state,getRoutePlanner:()=>planner,isRunning:()=>true,getCapacityLevel:()=>1,getExpressLevel:()=>1,getEventSeed:()=>0,onOverload:()=>assert.fail('Small, frequent services should not overload'),random:()=>0});
 const grants=new ServiceContracts();grants.accept('deliveries',{...state,stations,lines,planner});
 let grantsPaid=0;
 for(let tick=0;tick<300*60;tick++){
  simulation.step(1/60);grantsPaid+=grants.step({...state,stations,lines,planner});
  const waiting=stations.reduce((n,s)=>n+s.queue.length,0),riding=lines.reduce((n,l)=>n+l.trains[0].passengers.length,0);
  assert.equal(waiting+riding+state.score,state.passengerId-1,'No passenger may vanish during transfer or arrival');
 }
 assert.ok(state.elapsed>299);assert.ok(state.stadiumArrivalsDelivered>=1,'Original passenger traverses both interchanges to the stadium');
 assert.ok(state.score>20);assert.equal(grantsPaid,18);assert.equal(state.credits,28+state.score*2);
 for(const station of stations){station.queue=[];station.overload=0;}
 for(const line of lines){line.stations=[];line.trains=[];}
 planner=createRoutePlanner(stations,lines);state.reset();grants.reset();simulation.step(1);
 assert.equal(state.elapsed,0);assert.equal(state.score,0);assert.equal(state.passengerId,1);assert.equal(grants.completed.size,0);
});
