import test from 'node:test';
import assert from 'node:assert/strict';
import {districtEventAt,SERVICE_PLANS} from '../.test-build/simulation/servicePlans.js';
import {passengerTripWeight} from '../.test-build/simulation/passengerDemand.js';
test('seeded events announce real destinations and never overlap stadium phases',()=>{
 assert.equal(districtEventAt(29.99,0),null);assert.equal(districtEventAt(30,0).stationId,'museum');
 assert.equal(districtEventAt(30,1).stationId,'harbor');assert.equal(districtEventAt(30,2).stationId,'university');
 assert.deepEqual(districtEventAt(50,1),districtEventAt(50,1));
 for(const time of [70,99,100,159,160,205,219.99]) assert.equal(districtEventAt(time,1),null);
 assert.equal(districtEventAt(220,1).start,220);assert.equal(districtEventAt(260,1),null);
 assert.equal(districtEventAt(320,1).start,320);
});
test('cultural events attract inbound trips and ferry arrivals generate outbound trips',()=>{
 const candidate={from:{id:'harbor',kind:'commerce'},to:{id:'museum',kind:'culture'}};
 const context={elapsed:40,hour:9};const baseline=passengerTripWeight(candidate,context);
 assert.equal(passengerTripWeight(candidate,{...context,event:{stationId:'museum'}}),baseline*5);
 assert.equal(passengerTripWeight(candidate,{...context,event:{stationId:'harbor'}}),baseline*5);
 assert.equal(passengerTripWeight(candidate,{...context,event:{stationId:'university'}}),baseline);
});
test('standard retains original tuning; sandbox does not qualify for ranked records',()=>{
 assert.equal(SERVICE_PLANS.standard.demand,1);assert.equal(SERVICE_PLANS.standard.overloadSeconds,17);
 assert.equal(SERVICE_PLANS.sandbox.overloadSeconds,Infinity);assert.equal(SERVICE_PLANS.sandbox.ranked,false);
 assert.ok(SERVICE_PLANS.rush.demand>SERVICE_PLANS.standard.demand);
});
