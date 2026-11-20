import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {eventSources,parseEventCandidates,scanMajorEvents,validEvent} from './major-events-source.ts';
import type {MajorEvent} from '../src/lib/major-events-types.ts';
const now='2026-10-29T15:00:00Z';
const rss=(items:string)=>`<rss><channel>${items}</channel></rss>`;
const item=(title:string,url:string,date='')=>`<item><title>${title}</title><link>${url}</link>${date?`<pubDate>${date}</pubDate>`:''}</item>`;
test('reference events can remain readable without an unrelated external source URL',()=>{
 const event={id:'reference',date:'2026-10',track:'产品',region:'国内',title:'待核验事件',url:'',sourceType:'reference',referenceUrl:'/assets/major-events/chronicle-2022-2026.md',image:{path:'/assets/major-events/chronicle-reference.svg'}} as MajorEvent;
 assert.ok(validEvent(event));
 assert.ok(!validEvent({...event,sourceType:'official'}));
 assert.ok(!validEvent({...event,referenceUrl:'https://untrusted.example/file'}));
});
test('RSS preserves publication dates, rejects future/off-domain URLs and deduplicates',()=>{
 const result=parseEventCandidates(rss(item('New GPT model','https://openai.com/index/new?utm=1','Wed, 28 Oct 2026 10:00:00 GMT')+item('New GPT model','https://openai.com/index/new#ref','Wed, 28 Oct 2026 10:00:00 GMT')+item('Future GPT','https://openai.com/future','Fri, 30 Oct 2026 10:00:00 GMT')+item('Fake GPT','https://openai.com.evil.test/index/new')) ,eventSources[0],now);
 assert.equal(result.length,1);assert.equal(result[0].date,'2026-10-28');assert.equal(result[0].url,'https://openai.com/index/new');
});
test('unknown HTML dates and repository creation remain unverified, not publication timestamps',()=>{
 const html=parseEventCandidates('<article><a href="/news/claude-new"><h2>Claude new capabilities</h2></a></article>',eventSources[1],now);
 assert.equal(html[0].date,null);
 const github=parseEventCandidates(JSON.stringify([{name:'DeepSeek-New',html_url:'https://github.com/deepseek-ai/new',fork:false,created_at:now}]),eventSources[5],now);
 assert.equal(github[0].date,null);assert.equal(github[0].discoveredAt,now);
 assert.throws(()=>parseEventCandidates('<html>Access denied</html>',eventSources[0],now));
 assert.throws(()=>parseEventCandidates('<html>Access denied</html>',eventSources[1],now));
});
test('partial/all source failure preserves verified timeline, deduplicates candidates, records honest status',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'major-events-test-'));
 try{
  await mkdir(path.join(root,'data'));
  const seed=JSON.parse(await readFile(new URL('../src/data/major-events.json',import.meta.url),'utf8'));
  await writeFile(path.join(root,'data/major-events.json'),JSON.stringify(seed));
  const fetcher=async(source:(typeof eventSources)[number])=>{if(source.id!=='openai')throw new Error('fixture unavailable');return rss(item('New GPT capability','https://openai.com/index/test-event',new Date().toUTCString())+item('Existing GPT','https://openai.com/index/introducing-chatgpt/'));};
  const first=await scanMajorEvents(root,fetcher);assert.deepEqual(first.events,seed.events);assert.equal(first.sourceStatus?.filter(s=>s.ok).length,1);assert.ok(first.lastSuccessAt);
  const count=first.candidateCount;assert.ok(count&&count>=1);
  const second=await scanMajorEvents(root,fetcher);assert.equal(second.candidateCount,count);
  const failed=await scanMajorEvents(root,async()=>{throw new Error('offline');});assert.deepEqual(failed.events,seed.events);assert.equal(failed.lastSuccessAt,second.lastSuccessAt);assert.ok(failed.sourceStatus?.every(s=>!s.ok));assert.equal(failed.candidateCount,count);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('reads DeepMind sibling headings without inventing a day for month-only dates',()=>{
 const source=eventSources.find(s=>s.id==='deepmind')!;
 const result=parseEventCandidates('<div class="card"><div class="card__content"><h3>Genie 4: A new generation of world simulation</h3><time datetime="October 2026">October 2026</time><a href="/blog/genie-4/" aria-label="Learn more">Learn more</a></div></div>',source,now);
 assert.equal(result.length,1);assert.equal(result[0].title,'Genie 4: A new generation of world simulation');assert.equal(result[0].date,null);
});
