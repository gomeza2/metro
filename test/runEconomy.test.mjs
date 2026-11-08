import test from 'node:test';
import assert from 'node:assert/strict';
import { RunEconomy, phaseGoal } from '../.test-build/simulation/runEconomy.js';
import { RunState } from '../.test-build/simulation/runState.js';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';
import { NetworkCommands } from '../.test-build/simulation/networkCommands.js';

test('upgrade commands debit the exact escalating price, reject insufficient funds and cap at level three', () => {
  const economy = new RunEconomy(), state = new RunState();
  assert.deepEqual(economy.buy('capacity', state), { ok:true, cost:12, level:2 });
  assert.equal(state.credits,16);
  assert.deepEqual(economy.buy('capacity', state), { ok:false, reason:'funds', cost:26 });
  assert.equal(state.credits,16);assert.equal(economy.capacityLevel,2);
  state.credits=100;economy.buy('capacity',state);assert.equal(state.credits,74);
  assert.equal(economy.buy('capacity',state).reason,'maxed');assert.equal(state.credits,74);
  assert.equal(economy.buy('express',state).cost,10);assert.equal(economy.buy('express',state).cost,22);assert.equal(economy.expressLevel,3);
});
test('phase reward reads are pure and a stadium marker without active service cannot earn a reward', () => {
  const economy = new RunEconomy(), state = new RunState();state.elapsed=70;
  const lines=[{stations:['stadium']}];
  assert.equal(phaseGoal(1,state,lines).current,0);assert.equal(economy.awardPhase(state,lines),0);
  lines[0].stations.push('A');
  for(let i=0;i<100;i++) phaseGoal(1,state,lines);
  assert.equal(state.credits,28);assert.equal(economy.awardPhase(state,lines),8);assert.equal(economy.awardPhase(state,lines),0);assert.equal(state.credits,36);
});
test('all five phase rewards are paid once in the active phase and reset restores the run rules', () => {
  const economy = new RunEconomy(), state = new RunState(), lines=[{stations:['A','stadium']}];
  for(const [elapsed,score,arrivals,departures] of [[0,5,0,0],[70,5,0,0],[100,5,5,0],[160,5,5,5],[205,55,5,5]]) {
    Object.assign(state,{elapsed,score,stadiumArrivalsDelivered:arrivals,stadiumDeparturesDelivered:departures});
    assert.equal(economy.awardPhase(state,lines),8);assert.equal(economy.awardPhase(state,lines),0);
  }
  assert.equal(state.credits,68);assert.equal(economy.completedPhases.size,5);
  economy.buy('capacity',state);economy.reset();assert.equal(economy.capacityLevel,1);assert.equal(economy.expressLevel,1);assert.equal(economy.completedPhases.size,0);
});
test('the live engine awards goals without HUD rendering and never while paused', () => {
  const economy = new RunEconomy(), state = new RunState();state.score=5;
  const stations=['A','B'].map((id,i)=>({id,name:id,x:i*50,y:0,kind:'residential',queue:[],overload:0}));
  const lines=[{id:0,stations:[],trains:[],fleetSize:1}];const network=new NetworkCommands(stations,lines);network.selectStation(0,'A');network.selectStation(0,'B');
  let running=false,rewards=0;
  const engine=new GameSimulation({stations,lines,state,economy,getRoutePlanner:()=>network.planner,isRunning:()=>running,getCapacityLevel:()=>economy.capacityLevel,getExpressLevel:()=>economy.expressLevel,onPhaseReward:reward=>rewards+=reward,onOverload:()=>assert.fail('Unexpected overload')});
  engine.step(1/60);assert.equal(state.credits,28);
  running=true;for(let i=0;i<60;i++) engine.step(1/60);
  assert.equal(state.credits,36);assert.equal(rewards,8);
});
test('non-finite budgets cannot purchase an upgrade',()=>{
  const economy=new RunEconomy();assert.equal(economy.buy('express',{credits:NaN}).ok,false);assert.equal(economy.buy('capacity',{credits:Infinity}).ok,false);
});
