import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance,distanceLabel,mapsUrl,validSpot,walkLabel} from '../src/lib/geo.ts';
test('distance identity and known equatorial distance',()=>{assert.equal(distance({lat:0,lng:0},{lat:0,lng:0}),0);assert.ok(Math.abs(distance({lat:0,lng:0},{lat:0,lng:1})-111195)<1);});
test('labels and walking estimate',()=>{assert.equal(distanceLabel(321),'320 m');assert.equal(walkLabel(830),10);assert.equal(distanceLabel(2500),'2.5 km');});
test('Maps link explicitly requests walking',()=>assert.equal(mapsUrl({lat:12,lng:77}),'https://www.google.com/maps/dir/?api=1&destination=12,77&travelmode=walking'));
test('reject corrupted storage data',()=>{assert.equal(validSpot({id:'x',name:'Car',note:'',createdAt:1,lat:91,lng:0}),false);assert.equal(validSpot({id:'x',name:'Car',note:'',createdAt:1,lat:12,lng:77}),true);});
