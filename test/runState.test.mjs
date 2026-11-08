import test from 'node:test';
import assert from 'node:assert/strict';
import {RunState} from '../.test-build/simulation/runState.js';
test('restart clears every counter and applies the chosen service budget without replacing state identity',()=>{
 const state=new RunState();const identity=state;
 for(const key of Object.keys(state)) state[key]=999;
 state.reset(150);
 assert.equal(state,identity);assert.deepEqual({...state},{passengerId:1,elapsed:0,demandClock:0,score:0,credits:150,stadiumArrivalsDelivered:0,stadiumDeparturesDelivered:0});
});
