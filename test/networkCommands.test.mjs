import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkCommands } from '../.test-build/simulation/networkCommands.js';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';
import { RunState } from '../.test-build/simulation/runState.js';
function fixture() {
  const stations = ['A','B','C','D'].map((id,index)=>({id,name:id,x:index*50,y:0,kind:'residential',queue:[],overload:0}));
  const lines = [0,1,2].map(id=>({id,name:`Line ${id}`,color:'#fff',stations:[],trains:[],fleetSize:1}));
  const network = new NetworkCommands(stations,lines);
  return {stations,lines,network};
}
test('route commands atomically extend, trim, undo and rebuild the planner',()=>{
  const {network,lines}=fixture();
  assert.equal(network.selectStation(0,'A'),'extended');network.selectStation(0,'B');network.selectStation(0,'C');
  const oldPlanner=network.planner;
  assert.deepEqual([...network.planner.findRoute('A','C')],['A','B','C']);
  assert.equal(network.selectStation(0,'B'),'trimmed');
  assert.deepEqual(lines[0].stations,['A','B']);assert.equal(network.planner.findRoute('A','C'),null);
  assert.deepEqual([...oldPlanner.findRoute('A','C')],['A','B','C'],'Old graph snapshots remain immutable');
  assert.equal(network.undo(0),true);assert.equal(lines[0].trains.length,0);
  assert.equal(network.clear(0),true);assert.equal(network.clear(0),false);
});
test('selecting the current endpoint or an invalid station preserves fleet and planner identity',()=>{
  const {network,lines}=fixture();network.selectStation(0,'A');network.selectStation(0,'B');
  const train=lines[0].trains[0],planner=network.planner;train.progress=.4;
  assert.equal(network.selectStation(0,'B'),'unchanged');
  assert.equal(network.selectStation(0,'unknown'),'invalid');assert.equal(network.selectStation(99,'A'),'invalid');
  assert.equal(lines[0].trains[0],train);assert.equal(train.progress,.4);assert.equal(network.planner,planner);
});
test('editing a fleet preserves every rider at their actual last stop and replans queues',()=>{
  const {network,lines,stations}=fixture();network.selectStation(0,'A');network.selectStation(0,'B');network.selectStation(0,'C');
  const budget={credits:100};assert.equal(network.dispatch(0,budget),true);
  lines[0].trains[0].passengers.push({id:1,origin:'A',destination:'C',route:['A','B','C']});
  lines[0].trains[1].passengers.push({id:2,origin:'C',destination:'A',route:['C','B','A']});
  assert.equal(network.clear(0),true);
  assert.deepEqual(stations[0].queue.map(p=>p.id),[1]);assert.deepEqual(stations[2].queue.map(p=>p.id),[2]);
  assert.equal(stations[0].queue[0].route.length,0);assert.equal(lines[0].fleetSize,2);
  network.selectStation(0,'A');network.selectStation(0,'B');network.selectStation(0,'C');
  assert.deepEqual(stations[0].queue[0].route,['A','B','C']);assert.equal(lines[0].trains.length,2);
});
test('dispatch charges once, spaces trains and rejects insufficient funds and fleet overflow',()=>{
  const {network,lines}=fixture();const budget={credits:100};
  assert.equal(network.dispatch(0,budget),false);assert.equal(budget.credits,100);
  network.selectStation(0,'A');network.selectStation(0,'B');network.selectStation(0,'C');
  assert.equal(network.dispatch(0,{credits:17}),false);assert.equal(lines[0].fleetSize,1);
  assert.equal(network.dispatch(0,budget),true);assert.equal(budget.credits,82);assert.equal(lines[0].trains[1].stationIndex,2);
  assert.equal(network.dispatch(0,budget),true);assert.equal(budget.credits,48);assert.equal(network.dispatch(0,budget),false);assert.equal(budget.credits,48);
});
test('a removed transfer never creates a phantom delivery; restoring it rescues the stranded rider',()=>{
  const {network,lines,stations}=fixture();network.selectStation(0,'A');network.selectStation(0,'B');network.selectStation(1,'B');network.selectStation(1,'C');
  const state=new RunState();state.passengerId=2;
  lines[0].trains[0].passengers.push({id:1,origin:'A',destination:'C',route:['A','B','C']});
  lines[0].trains[0].dwell=0;lines[0].trains[0].progress=.4;
  const simulation=new GameSimulation({stations,lines,state,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>1,getExpressLevel:()=>1,random:()=>0,onOverload:()=>assert.fail('Unexpected overload')});
  network.clear(1);
  for(let i=0;i<60;i++) simulation.step(1/60);
  assert.equal(state.score,0);assert.equal(stations[1].queue[0].id,1);assert.deepEqual(stations[1].queue[0].route,[]);
  network.selectStation(1,'B');network.selectStation(1,'C');
  for(let i=0;i<120;i++) {
    simulation.step(1/60);
    const waiting=stations.reduce((n,s)=>n+s.queue.length,0);
    const onboard=lines.reduce((n,l)=>n+l.trains.reduce((sum,t)=>sum+t.passengers.length,0),0);
    assert.equal(waiting+onboard+state.score,state.passengerId-1);
  }
  assert.equal(state.score,1);
});
test('network reset clears fleets, queues, overload and all planner edges',()=>{
  const {network,lines,stations}=fixture();network.selectStation(0,'A');network.selectStation(0,'B');
  stations[0].queue.push({id:1,origin:'A',destination:'B',route:['A','B']});stations[0].overload=10;
  network.dispatch(0,{credits:100});network.reset();
  assert.equal(network.planner.findRoute('A','B'),null);assert.equal(stations[0].queue.length,0);assert.equal(stations[0].overload,0);
  assert.equal(lines[0].fleetSize,1);assert.equal(lines[0].trains.length,0);
  network.selectStation(0,'A');network.selectStation(0,'B');assert.equal(lines[0].trains[0].id,1);
});
