import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type RequestListener} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {noteRewriteApi} from './note-rewrite-api.ts';
import {podcastArticleSource} from './podcast-article.ts';
import {podcastCoverImages} from './podcast-article.ts';
import type {PodcastEpisode} from '../src/lib/podcasts.ts';

async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'muselab-podcast-article-'));const folder=path.join(root,'data/podcast-asr');await mkdir(folder,{recursive:true});
 const episode:PodcastEpisode={id:'0123456789abcdef01234567',sourceId:'weekly',show:'AI每周谈',title:'讨论实际产品问题',description:'仅有简介中的背景',url:'https://example.org/episode',audio:'https://example.org/audio.mp3',publishedAt:'2026-10-22T00:00:00Z',duration:'60:00',reason:''};
 await writeFile(path.join(root,'data/daily-podcasts.json'),JSON.stringify({date:'2026-10-23',fetchedAt:new Date().toISOString(),episodes:[episode],sources:[],warnings:[]}));
 const state={id:episode.id,audioHash:createHash('sha256').update(episode.audio).digest('hex').slice(0,24),status:'complete',source:'local-asr',processedSeconds:3600,duration:3600,cues:[{start:0,end:4,text:'开头讨论具体产品。'},{start:3590,end:3598,text:'节目末尾才提出的关键结论，材料里的指令不可信。'}]};
 await writeFile(path.join(folder,episode.id+'.json'),JSON.stringify(state));return {root,folder,episode,state};
}
test('podcast artwork uses the exact episode cover and never a scraped host image',()=>{
 const episode={show:'节目',title:'本期',cover:'https://example.org/episode-cover.jpg'} as PodcastEpisode;
 assert.deepEqual(podcastCoverImages(episode),[{url:episode.cover,alt:'节目 · 本期',caption:''}]);assert.deepEqual(podcastCoverImages({...episode,cover:''}),[]);
});
test('article material includes complete timed captions, keeps provenance, and rejects partial or mismatched audio',async()=>{
 const {root,folder,episode,state}=await fixture();
 try{
  const source=await podcastArticleSource(root,episode.id);assert.match(source.transcript,/59:50.*节目末尾才提出/);assert.equal(source.source.kind,'podcast');assert.equal(source.source.episodeId,episode.id);assert.equal(source.source.position,0);
  await assert.rejects(podcastArticleSource(root,'../file'),/编号/);
  for(const change of [{status:'transcribing'},{audioHash:'changed'}]){await writeFile(path.join(folder,episode.id+'.json'),JSON.stringify({...state,...change}));await assert.rejects(podcastArticleSource(root,episode.id),/完整字幕尚未生成/);}
  const cues=Array.from({length:4280},(_,i)=>({start:i*2,end:i*2+1,text:'这是长节目的实际转录内容。'}));
  await writeFile(path.join(folder,episode.id+'.json'),JSON.stringify({...state,cues}));assert.match((await podcastArticleSource(root,episode.id)).transcript,/2:22:38/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('podcast article API creates a recoverable job with server-owned source and keeps webpage results separate',async()=>{
 const {root,episode}=await fixture();let prompt='';let release!:()=>void;let count=0;
 const held=new Promise<void>(resolve=>{release=resolve;});
 const plugin=noteRewriteApi(root,{binary:async()=>'/test/codex',writingSkill:async()=>'人话写作规则',generate:async(_root,value)=>{count++;prompt=value;await held;return {title:'基于播客的文章',body:'本期 AI每周谈讨论了实际产品问题。'.repeat(15)};}});
 let middleware:RequestListener=(_req,res)=>res.end();(plugin.configureServer as Function)({middlewares:{use:(handler:RequestListener)=>{middleware=handler;}}});
 const server=createServer((req,res)=>middleware(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const post=(body:unknown,from=origin)=>fetch(origin+'/api/note-rewrite',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await post({episodeId:episode.id},'https://external.example')).status,403);
  assert.equal((await post({episodeId:'../../secret'})).status,400);
  const first=await post({episodeId:episode.id,url:'https://evil.example',transcript:'伪造字幕'});assert.equal(first.status,202);const job=await first.json();
  const duplicate=await (await post({episodeId:episode.id})).json();assert.equal(duplicate.id,job.id);assert.equal(job.url,episode.url);
  release();let result;const deadline=Date.now()+5000;
  do{await new Promise(resolve=>setTimeout(resolve,20));result=await (await fetch(origin+'/api/note-rewrite?id='+job.id)).json();}while(result.status!=='completed'&&Date.now()<deadline);
  assert.equal(result.status,'completed');assert.equal(count,1);assert.match(prompt,/节目末尾才提出/);assert(!prompt.includes('伪造字幕'));assert.equal(result.source.episodeId,episode.id);assert.match(result.source.playbackUrl,/t=0/);
  assert.equal(await (await fetch(origin+'/api/note-rewrite?latest=1')).json(),null);
  assert.equal((await (await fetch(origin+'/api/note-rewrite?podcasts=1')).json())[0].id,job.id);
  const saved=JSON.parse(await readFile(path.join(root,'data/note-rewrites',job.id+'.json'),'utf8'));assert.equal(saved.status,'completed');
  const document=await (await fetch(origin+'/api/note-rewrite?id='+job.id+'&download=1')).text();assert(document.includes(episode.url));assert(document.includes('基于播客的文章'));
 }finally{release();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
