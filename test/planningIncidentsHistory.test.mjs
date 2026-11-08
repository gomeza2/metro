import test from 'node:test';
import assert from 'node:assert/strict';
import {RouteDraft,routeImpact} from '../.test-build/simulation/routeDraft.js';
import {NetworkCommands} from '../.test-build/simulation/networkCommands.js';
import {incidentAt,approachingIncident} from '../.test-build/simulation/operatingIncidents.js';
import {parseRunHistory,appendRun} from '../.test-build/runHistory.js';
import {GameSimulation} from '../.test-build/simulation/gameSimulation.js';
import {RunState} from '../.test-build/simulation/runState.js';
function fixture(){
 const stations=['A','B','C','D'].map((id,i)=>({id,name:id,x:i*100,y:0,kind:'residential',queue:[],overload:0,active:id!=='D'}));
 const lines=[{id:0,stations:[],trains:[],fleetSize:1}];const network=new NetworkCommands(stations,lines);
 for(const id of ['A','B','C'])network.selectStation(0,id);
 return {stations,lines,network};
}
test('draft edits are isolated and reject unavailable stops',()=>{
 const g=fixture(),route=g.lines[0].stations,train=g.lines[0].trains[0],planner=g.network.planner;
 const draft=new RouteDraft(0,route,new Set(['A','B','C']));assert.equal(draft.changed,false);assert.equal(draft.select('D'),false);
 draft.select('A');assert.deepEqual(draft.stations,['A']);assert.deepEqual(route,['A','B','C']);assert.equal(draft.changed,true);
 draft.undo();assert.equal(draft.stations.length,0);draft.select('C');draft.clear();
 assert.equal(g.lines[0].trains[0],train);assert.equal(g.network.planner,planner);assert.equal(g.lines[0].stations,route);
});
test('preview predicts waiting riders disconnected by an edit without changing live passenger objects',()=>{
 const g=fixture(),p={id:1,origin:'A',destination:'C',route:['A','B','C']};g.stations[0].queue.push(p);
 g.lines[0].trains[0].passengers.push({id:2,origin:'A',destination:'C',route:['A','B','C']});
 const draft=new RouteDraft(0,g.lines[0].stations,new Set(['A','B','C']));draft.select('A');
 assert.deepEqual(routeImpact(g.stations,g.lines,draft),{before:3,after:0,disconnected:2});
 assert.equal(g.stations[0].queue[0],p);assert.equal(g.lines[0].trains[0].passengers.length,1);
});
test('applying a route validates everything before mutation and preserves all riders',()=>{
 const g=fixture(),planner=g.network.planner,train=g.lines[0].trains[0];
 train.passengers.push({id:1,origin:'A',destination:'C',route:['A','B','C']});
 for(const route of [['A','unknown'],['A','D'],['A','A']])assert.equal(g.network.replaceRoute(0,route),'invalid');
 assert.equal(g.network.planner,planner);assert.equal(g.lines[0].trains[0],train);
 assert.equal(g.network.replaceRoute(0,['A','B','C']),'unchanged');assert.equal(g.lines[0].trains[0],train);
 assert.equal(g.network.replaceRoute(0,['A','C']),'extended');assert.deepEqual(g.stations[0].queue[0].route,['A','C']);assert.equal(g.stations[0].queue.length,1);assert.equal(g.lines[0].trains[0].passengers.length,0);
});
test('incident windows are deterministic, announced 15 seconds early and finite',()=>{
 assert.equal(incidentAt(100,0,false),null);assert.equal(incidentAt(99.99,0,true),null);assert.equal(incidentAt(100,0,true).stationId,'museum');
 assert.equal(incidentAt(129.99,0,true).speed,.65);assert.equal(incidentAt(130,0,true),null);assert.equal(incidentAt(220,0,true).stationId,'civic');
 assert.equal(approachingIncident(84.99,0,true),null);assert.equal(approachingIncident(85,0,true).start,100);assert.equal(approachingIncident(100,0,true),null);
});
test('an incident slows affected legs only; disabled incidents retain the original speed',()=>{
 for(const enabled of [false,true]){
  const stations=[{id:'A',x:0,y:0},{id:'museum',x:100,y:0},{id:'B',x:0,y:100}].map(s=>({...s,name:s.id,kind:'residential',queue:[],overload:0}));
  const lines=[['A','museum'],['A','B']].map((stops,id)=>({id,stations:stops,trains:[{id,stationIndex:0,lastStationId:'A',direction:1,progress:0,dwell:0,passengers:[]}],fleetSize:1}));
  const network=new NetworkCommands(stations,lines),state=new RunState();state.elapsed=100;
  const engine=new GameSimulation({stations,lines,state,getRoutePlanner:()=>network.planner,isRunning:()=>true,getCapacityLevel:()=>1,getExpressLevel:()=>1,getEventSeed:()=>0,getIncidentsEnabled:()=>enabled,onOverload:()=>{}});
  engine.step(.1);assert.ok(Math.abs(lines[0].trains[0].progress-.105*(enabled ? 0.65 : 1))<1e-9);assert.ok(Math.abs(lines[1].trains[0].progress-.105)<1e-9);
 }
});
const record={mode:'standard',outcome:'abandoned',score:10,elapsed:30,phases:1,grants:1,progressive:true,incidents:false};
test('history validates untrusted storage and keeps only eight recent summaries',()=>{
 for(const value of [null,'bad json','{}','null'])assert.deepEqual(parseRunHistory(value),[]);
 const invalid=[{...record,mode:'__proto__'},{...record,score:-1},{...record,grants:99},{...record,outcome:'<script>'}];
 assert.deepEqual(parseRunHistory(JSON.stringify(invalid)),[]);
 let history=[];for(let i=0;i<12;i++)history=appendRun(history,{...record,score:i});
 assert.equal(history.length,8);assert.equal(history[0].score,11);assert.equal(history[7].score,4);
 assert.deepEqual(parseRunHistory(JSON.stringify(history)),history);
});
