import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceChallengeStatus } from '../.test-build/simulation/serviceChallenge.js';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';
import { NetworkCommands } from '../.test-build/simulation/networkCommands.js';
import { RunState } from '../.test-build/simulation/runState.js';
import { RunEconomy } from '../.test-build/simulation/runEconomy.js';
import { ServiceContracts, connectedStationCount } from '../.test-build/simulation/serviceContracts.js';

test('certification requires all three goals together, and deadline takes precedence',()=>{
  const goals={elapsed:319.9,score:30,coverage:8,grants:2};
  assert.equal(serviceChallengeStatus(goals).outcome,'won');
  for(const key of ['score','coverage','grants']) assert.equal(serviceChallengeStatus({...goals,[key]:0}).outcome,'running');
  assert.equal(serviceChallengeStatus({...goals,elapsed:320}).outcome,'lost');
  assert.equal(serviceChallengeStatus({...goals,elapsed:999}).remaining,0);
});
test('grant progress alone does not grant certification; a new snapshot begins at zero',()=>{
  const result=serviceChallengeStatus({elapsed:0,score:0,coverage:0,grants:0});
  assert.equal(result.remaining,320);assert.equal(result.outcome,'running');assert.deepEqual(result.goals.map(g=>g.current),[0,0,0]);
});
test('a connected network can earn grants, upgrade, deliver and win certification through real ticks',()=>{
  const state=new RunState();state.reset(32);const economy=new RunEconomy(),grants=new ServiceContracts();
  const stations=Array.from({length:8},(_,i)=>({id:`S${i}`,name:`Station ${i}`,x:i*25,y:0,kind:'residential',queue:[],overload:0}));
  const lines=Array.from({length:3},(_,id)=>({id,stations:[],trains:[],fleetSize:1}));const network=new NetworkCommands(stations,lines);
  for(const station of stations) network.selectStation(0,station.id);
  network.selectStation(1,'S0');network.selectStation(1,'S1');network.selectStation(2,'S0');network.selectStation(2,'S2');
  const snapshot=()=>({...state,stations,lines,planner:network.planner});
  const engine=new GameSimulation({stations,lines,state,economy,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>economy.capacityLevel,getExpressLevel:()=>economy.expressLevel,getServicePlan:()=> 'challenge',getEventSeed:()=>0,random:()=>0,onOverload:()=>assert.fail('Certification fixture should have sufficient service')});
  grants.accept('coverage',snapshot());state.credits+=grants.step(snapshot());grants.accept('interchange',snapshot());state.credits+=grants.step(snapshot());
  economy.buy('express',state);economy.buy('capacity',state);
  let outcome='running';
  for(let i=0;i<320*60&&outcome==='running';i++) {
    engine.step(1/60);state.credits+=grants.step(snapshot());
    outcome=serviceChallengeStatus({elapsed:state.elapsed,score:state.score,coverage:connectedStationCount(stations,network.planner),grants:grants.completed.size}).outcome;
  }
  assert.equal(outcome,'won');assert.ok(state.elapsed<320);assert.ok(state.score>=30);assert.equal(grants.completed.size,2);
});
