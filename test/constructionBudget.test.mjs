import {parseRunHistory} from '../.test-build/runHistory.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ConstructionBudget, constructionQuote } from '../.test-build/simulation/constructionBudget.js';
import { NetworkCommands } from '../.test-build/simulation/networkCommands.js';
const stations=Array.from({length:8},(_,index)=>({id:String(index),x:index*80,y:0,kind:'residential',name:String(index),queue:[],overload:0}));
const lines=()=>[0,1].map(id=>({id,name:String(id),color:'#fff',stations:[],trains:[],fleetSize:1}));
test('material grows with the city, purchases compete for funds and reset is complete',()=>{
 const supply=new ConstructionBudget();assert.deepEqual([3,6,10,14].map(count=>supply.capacity(count)),[9,16,24,30]);
 const budget={credits:1000};for(let index=0;index<6;index++){const cost=16+index*8;assert.equal(supply.cost,cost);const before=budget.credits;assert.equal(supply.expand(budget),true);assert.equal(budget.credits,before-cost);}
 assert.equal(supply.capacity(3),39);assert.equal(supply.expand(budget),false);supply.reset();assert.equal(supply.packs,0);assert.equal(supply.cost,16);
});
test('invalid budgets never spend or grant material',()=>{
 const supply=new ConstructionBudget();for(const credits of [15,-1,NaN,Infinity]){const budget={credits};assert.equal(supply.expand(budget),false);assert.ok(Object.is(budget.credits,credits));assert.equal(supply.packs,0);}
});
test('track quotes charge per segment and per line, releasing material when routes shrink',()=>{
 const network=lines();network[0].stations=['0','1','3'];network[1].stations=['0','1'];
 assert.equal(constructionQuote(stations,network,0,network[0].stations,9).used,4);
 assert.equal(constructionQuote(stations,network,0,['0','1'],9).used,2);
 assert.equal(constructionQuote(stations,network,0,[],9).used,1);
 const diagonal=[{...stations[0],x:1,y:1},stations[1]];assert.equal(constructionQuote(diagonal,network,0,['0','1'],9).used,2);
 assert.deepEqual(network[0].stations,['0','1','3']);
});
test('six stops force transfers even with spare material; classic mode remains unrestricted',()=>{
 const network=lines(),route=stations.map(station=>station.id);
 assert.equal(constructionQuote(stations,network,0,route.slice(0,6),30).ok,true);
 assert.equal(constructionQuote(stations,network,0,route.slice(0,7),30).reason,'stops');
 assert.equal(constructionQuote(stations,network,0,route,Infinity).ok,true);
 assert.equal(constructionQuote(stations,network,0,['0','7'],6).reason,'track');
 assert.equal(constructionQuote(stations,network,0,['missing'],30).reason,'station');
 assert.equal(constructionQuote(stations,network,0,['0','1'],NaN).ok,false);
});
test('construction guard rejects direct edits and replacements before mutating fleet, passengers or planner',()=>{
 const city=structuredClone(stations),network=lines();const commands=new NetworkCommands(city,network,(id,route)=>constructionQuote(city,network,id,route,2).ok);
 commands.selectStation(0,'0');commands.selectStation(0,'1');const train=network[0].trains[0];train.progress=.5;train.passengers.push({id:1,origin:'0',destination:'1',route:['0','1']});
 const before=JSON.stringify({city,network}),planner=commands.planner;
 assert.equal(commands.selectStation(0,'4'),'invalid');assert.equal(commands.replaceRoute(0,['0','7']),'invalid');
 assert.equal(JSON.stringify({city,network}),before);assert.equal(commands.planner,planner);assert.equal(network[0].trains[0],train);
 assert.equal(commands.replaceRoute(0,['0','1','2']),'extended');assert.equal(city[0].queue[0].id,1);
 commands.clear(0);assert.equal(constructionQuote(city,network,1,['1','3'],2).ok,true);
});

test('history distinguishes constrained runs and still reads older classic summaries',()=>{
 const record={mode:'standard',outcome:'overload',score:8,elapsed:70,phases:1,grants:0,progressive:true,incidents:false};
 assert.deepEqual(parseRunHistory(JSON.stringify([record])),[record]);
 const constrained={...record,limitedTrack:true};assert.deepEqual(parseRunHistory(JSON.stringify([constrained])),[constrained]);
});
