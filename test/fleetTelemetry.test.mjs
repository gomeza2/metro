import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkCommands, REASSIGNMENT_COST } from '../.test-build/simulation/networkCommands.js';
import { lineTelemetry } from '../.test-build/simulation/lineTelemetry.js';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';
import { RunState } from '../.test-build/simulation/runState.js';

function fixture() {
  const stations = ['A','B','C','D'].map((id,index) => ({id,name:id,x:index*100,y:0,kind:'residential',queue:[],overload:0}));
  const lines = [0,1,2].map(id => ({id,name:`Line ${id}`,color:'#fff',stations:[],trains:[],fleetSize:1}));
  const network = new NetworkCommands(stations,lines);
  for (const [id,route] of [[0,['A','B']],[1,['B','C']],[2,['C','D']]]) for (const stop of route) network.selectStation(id,stop);
  return {stations,lines,network};
}
const rider = (id,destination='D') => ({id,origin:'A',destination,route:['A','B','C','D']});

test('reassignment preserves people, live train positions, topology and train identity, charging once', () => {
  const {stations,lines,network} = fixture(); const budget={credits:100};
  network.dispatch(0,budget);
  const [busy,moved] = lines[0].trains;
  busy.progress=.4; busy.passengers.push(rider(1),rider(2));
  moved.progress=.3; moved.passengers.push(rider(3));
  const targetTrain=lines[1].trains[0];targetTrain.progress=.6;
  const untouched=JSON.stringify(lines[2]),planner=network.planner;
  assert.deepEqual(network.reassignmentPreview(0,1),{trainId:moved.id,passengers:1,stationId:'B'});
  const before=budget.credits;
  assert.equal(network.reassign(0,1,budget),true);
  assert.equal(budget.credits,before-REASSIGNMENT_COST);
  assert.equal(lines[0].fleetSize,1);assert.equal(lines[1].fleetSize,2);
  assert.equal(lines[0].trains[0],busy);assert.equal(busy.progress,.4);
  assert.equal(lines[1].trains[0],targetTrain);assert.equal(targetTrain.progress,.6);
  assert.equal(lines[1].trains[1].id,moved.id);assert.equal(lines[1].trains[1].passengers.length,0);
  assert.equal(stations[1].queue[0].id,3);assert.deepEqual(stations[1].queue[0].route,['B','C','D']);
  assert.equal(network.planner,planner);assert.equal(JSON.stringify(lines[2]),untouched);
  assert.equal(network.reassign(0,1,budget),false);assert.equal(budget.credits,before-REASSIGNMENT_COST);
});

test('invalid transfers and nonfinite purchase budgets never mutate network or budget', () => {
  const {stations,lines,network}=fixture();network.dispatch(0,{credits:100});
  const snapshot=JSON.stringify({stations,lines});
  for(const [from,to,credits] of [[0,0,100],[99,1,100],[0,99,100],[1,0,100],[0,1,3],[0,1,NaN],[0,1,Infinity],[0,1,-1]]) {
    const budget={credits};assert.equal(network.reassign(from,to,budget),false);assert.ok(Object.is(budget.credits,credits));assert.equal(JSON.stringify({stations,lines}),snapshot);
  }
  for(const credits of [NaN,Infinity,-1]) {assert.equal(network.dispatch(1,{credits}),false);assert.equal(JSON.stringify({stations,lines}),snapshot);}
  network.dispatch(1,{credits:100});network.dispatch(1,{credits:100});
  assert.equal(network.reassignmentPreview(0,1),null);
  network.clear(1);assert.equal(network.reassignmentPreview(0,1),null);
  network.selectStation(1,'B');network.selectStation(1,'C');lines[1].fleetSize=1;
  stations[2].active=false;assert.equal(network.reassign(0,1,{credits:100}),false);
});

test('an unused extra train can leave a cleared line and adopts the destination policy', () => {
  const {lines,network}=fixture();network.dispatch(0,{credits:100});network.clear(0);
  lines[1].policy='local';const budget={credits:4};
  assert.deepEqual(network.reassignmentPreview(0,1),{trainId:null,passengers:0,stationId:null});
  assert.equal(network.reassign(0,1,budget),true);
  assert.equal(budget.credits,0);assert.equal(lines[0].fleetSize,1);assert.equal(lines[0].trains.length,0);
  assert.equal(lines[1].trains.length,2);assert.equal(lines[1].trains[1].policy,'local');
  network.reset();assert.ok(lines.every(line=>line.fleetSize===1 && !line.trains.length));
});

test('people remain accounted for through repeated transfers and ongoing multi-line service', () => {
  const {stations,lines,network}=fixture();const state=new RunState();state.credits=200;state.passengerId=4;
  network.dispatch(0,state);lines[0].trains[0].passengers.push(rider(1),rider(2));lines[0].trains[1].passengers.push(rider(3));
  const sim=new GameSimulation({stations,lines,state,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>1,getExpressLevel:()=>1,random:()=>0,getServicePlan:()=> 'sandbox',onOverload:()=>assert.fail('sandbox overload')});
  for(let tick=0;tick<3600;tick++) {
    if(tick===0)assert.equal(network.reassign(0,1,state),true);
    if(tick===300)assert.equal(network.reassign(1,2,state),true);
    if(tick===600)assert.equal(network.reassign(2,0,state),true);
    sim.step(1/60);
    const waiting=stations.flatMap(station=>station.queue),onboard=lines.flatMap(line=>line.trains.flatMap(train=>train.passengers));
    assert.equal(waiting.length+onboard.length+state.score,state.passengerId-1);
    assert.equal(new Set([...waiting,...onboard].map(person=>person.id)).size,waiting.length+onboard.length);
    assert.equal(lines.reduce((n,line)=>n+line.fleetSize,0),4);
    assert.equal(new Set(lines.flatMap(line=>line.trains.map(train=>train.id))).size,4);
  }
  assert.ok(state.score>=3);
});

test('telemetry observes actual mixed train policies and queues without changing their order', () => {
  const {stations,lines,network}=fixture();network.dispatch(0,{credits:100});
  lines[0].trains[0].policy='local';lines[0].trains[1].policy='rapid';
  lines[0].trains[0].passengers.push(rider(1));
  stations[0].queue.push(rider(2),{...rider(3),route:[]});stations[1].queue.push(rider(4));
  const snapshot=JSON.stringify({stations,lines});const t=lineTelemetry(lines[0],stations,1);
  assert.deepEqual([t.onboard,t.seats,t.waiting,t.disconnected],[1,13,3,1]);assert.equal(t.priority.id,'A');
  assert.equal(JSON.stringify({stations,lines}),snapshot);
  stations[1].overload=1;assert.equal(lineTelemetry(lines[0],stations,1).priority.id,'B');
  stations[1].overload=0;stations[0].platformLevel=2;stations[1].queue.push(rider(5));
  assert.equal(lineTelemetry(lines[0],stations,1).priority.id,'B');
  network.clear(0);assert.deepEqual(lineTelemetry(lines[0],stations,1),{onboard:0,seats:0,waiting:0,disconnected:0,priority:null});
});
