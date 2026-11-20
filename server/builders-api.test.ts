import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type RequestListener} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildersApi,buildersSite,parseBuildersDirectory} from './builders-api.ts';
test('directory accepts known article paths, deduplicates and preserves source dates',()=>{
 const entry=(href:string)=>`<a class="archive-link" href="${href}"><b class="archive-entry-title">真实标题</b><time class="archive-date">2026-10-20</time><span class="archive-entry-desc">简介</span><i class="archive-issue">Issue 148</i></a>`;
 const entries=parseBuildersDirectory('<div id="archive">'+entry('./issues/daily.html')+entry('./issues/daily.html')+entry('https://other.example/issues/daily.html')+entry('javascript:alert(1)')+'</div>');assert.equal(entries.length,1);assert.equal(entries[0].date,'2026-10-20');assert.throws(()=>parseBuildersDirectory('<p>temporarily unavailable</p>'));
});

const directory=(date:string)=>`<section id="archive"><a class="archive-link" href="./issues/${date}.html"><h3 class="archive-entry-title">真实标题 ${date}</h3><time class="archive-date">${date}</time></a></section>`;
async function fixture(fetchSource:typeof fetch){
 const root=await mkdtemp(path.join(tmpdir(),'builders-refresh-'));await mkdir(path.join(root,'data'));
 const previous={entries:parseBuildersDirectory(directory('2026-11-02')),fetchedAt:'2026-11-03T06:34:58.666Z'};
 const file=path.join(root,'data/builders-directory.json');await writeFile(file,JSON.stringify(previous));
 let middleware:RequestListener=()=>{};
 const plugin=buildersApi(root,fetchSource);
 (plugin.configureServer as Function)({middlewares:{use(value:RequestListener){middleware=value;}}});
 const server=createServer((req,res)=>middleware(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('No test port');
 return {root,file,previous,url:`http://127.0.0.1:${address.port}/api/builders-directory`,async close(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}};
}

test('refresh returns the new directory in the same request even when the homepage exceeds 4 MB',async()=>{
 let calls=0;
 const app=await fixture((async url=>{assert.equal(url,buildersSite);calls++;return new Response(directory('2026-11-13')+' '.repeat(5*1024*1024));}) as typeof fetch);
 try{
  const result=await (await fetch(app.url+'?refresh=1')).json();
  assert.equal(result.entries[0].date,'2026-11-13');assert.equal(result.stale,false);assert.equal(calls,1);
  const saved=JSON.parse(await readFile(app.file,'utf8'));assert.deepEqual(saved.entries,result.entries);assert.notEqual(saved.fetchedAt,app.previous.fetchedAt);
  const cached=await (await fetch(app.url)).json();assert.equal(cached.entries[0].date,'2026-11-13');assert.equal(calls,1);
  await fetch(app.url+'?refresh=1');assert.equal(calls,2,'explicit refresh must not be silently ignored by the cooldown');
 }finally{await app.close();}
});

test('a stale directory is refreshed before returning and failed refreshes visibly preserve the last valid data',async()=>{
 let fail=false;
 const app=await fixture((async()=>{if(fail)throw new Error('network timeout');return new Response(directory('2026-11-13'));}) as typeof fetch);
 try{
  const refreshed=await (await fetch(app.url)).json();assert.equal(refreshed.entries[0].date,'2026-11-13');
  const before=await readFile(app.file,'utf8');fail=true;
  const response=await fetch(app.url+'?refresh=1');const cached=await response.json();
  assert.equal(response.status,200);assert.equal(cached.stale,true);assert.match(cached.warning,/刷新失败/);assert.deepEqual(cached.entries,refreshed.entries);assert.equal(await readFile(app.file,'utf8'),before);
 }finally{await app.close();}
});

test('oversized source pages never replace the valid directory',async()=>{
 const app=await fixture((async()=>new Response(directory('2026-11-13')+' '.repeat(8*1024*1024))) as typeof fetch);
 try{
  const before=await readFile(app.file,'utf8');const result=await (await fetch(app.url+'?refresh=1')).json();
  assert.equal(result.stale,true);assert.match(result.warning,/刷新失败/);assert.deepEqual(result.entries,app.previous.entries);assert.equal(await readFile(app.file,'utf8'),before);
 }finally{await app.close();}
});
