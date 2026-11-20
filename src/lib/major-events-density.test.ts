import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {eventDateGroups,eventDensityBeads} from './major-events-density.ts';
test('same-day events share a date and align across lanes without overlapping within a lane',()=>{
 const result=eventDateGroups([{id:'a',date:'2026-10-13',track:'模型'},{id:'b',date:'2026-10-13',track:'产品'},{id:'c',date:'2026-10-13',track:'模型'},{id:'d',date:'2026-10-14',track:'资本'}]);
 assert.equal(result.groups.length,2);assert.equal(result.groups[0].count,3);
 assert.equal(result.positions.a,result.positions.b);assert.ok(result.positions.c-result.positions.a>=292);
 assert.ok(result.positions.d-result.positions.c>=292);
 assert.equal(result.groups[0].nearbyCount,4);assert.equal(result.groups[1].nearbyCount,4);
});
test('partial dates stay separate, groups sort by date, filtering recomputes counts',()=>{
 const events=[{id:'c',date:'2026-10-13',track:'模型' as const},{id:'b',date:'2026-10',track:'产品' as const},{id:'a',date:'2026',track:'政策' as const},{id:'d',date:'2026-10-13',track:'产品' as const}];
 assert.deepEqual(eventDateGroups(events).groups.map(g=>[g.date,g.count]),[['2026',1],['2026-10',1],['2026-10-13',2]]);
 assert.equal(eventDateGroups(events.filter(e=>e.track==='模型')).groups[0].count,1);
 assert.deepEqual(eventDateGroups([]).groups,[]);
});

test('seven-day activity changes bubble size even when dates each contain one event',()=>{
 const result=eventDateGroups([{id:'a',date:'2026-10-01',track:'模型'},{id:'b',date:'2026-10-20',track:'模型'},{id:'c',date:'2026-10-21',track:'产品'},{id:'d',date:'2026-10-23',track:'产品'},{id:'m',date:'2026-10',track:'模型'}]);
 const a=result.groups.find(g=>g.date==='2026-10-01')!,b=result.groups.find(g=>g.date==='2026-10-20')!;
 assert.equal(a.count,b.count);assert.equal(a.nearbyCount,1);assert.equal(b.nearbyCount,3);assert.ok(b.radius>a.radius);
 assert.equal(result.groups.find(g=>g.date==='2026-10')?.nearbyCount,null);
 const filtered=eventDateGroups([{id:'b',date:'2026-10-20',track:'模型'},{id:'c',date:'2026-10-21',track:'产品'}]);assert.equal(filtered.groups[0].nearbyCount,2);
});

test('bead chain keeps data peaks and tapers through smaller circles without counting them as events',()=>{
 const groups=[{center:100,radius:25,date:'2026-10-13'},{center:400,radius:11,date:'2026-10-20'}];
 const beads=eventDensityBeads(groups,550);
 assert.ok(beads.some(b=>b.x===100&&b.radius===25));
 assert.ok(beads.some(b=>b.x===400&&b.radius===11));
 assert.ok(beads.some(b=>b.radius>3&&b.radius<11));
 assert.ok(beads.some(b=>b.radius===1.5));
 assert.ok(beads.every(b=>Number.isFinite(b.radius)&&b.radius>0));
 assert.deepEqual(eventDensityBeads([],550),[]);
});

test('all circles have visible gaps, including shoulders next to the large peaks',()=>{
 const groups=[{center:100,radius:29,date:'2026-10-13'},{center:290,radius:24,date:'2026-10-20'},{center:490,radius:11,date:'2026-10-25'}];
 const beads=eventDensityBeads(groups,600);
 for(let i=1;i<beads.length;i++)assert.ok(beads[i].x-beads[i-1].x-beads[i].radius-beads[i-1].radius>=4.9);
});
