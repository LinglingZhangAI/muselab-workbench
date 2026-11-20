import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PodcastTranscriber} from './podcast-transcription.ts';
import type {PodcastEpisode} from '../src/lib/podcasts.ts';

test('concurrent requests share a single job and complete captions survive restart',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-transcript-'));const directory=path.join(root,'data/podcast-asr');
 const episode:PodcastEpisode={id:'0123456789abcdef01234567',audio:'https://example.org/public.mp3',sourceId:'weekly',show:'节目',title:'单集',url:'https://example.org/episode',description:'',duration:'',publishedAt:new Date().toISOString(),reason:''};
 const hash=createHash('sha256').update(episode.audio).digest('hex').slice(0,24);let engine:PodcastTranscriber|undefined;
 try{
  await mkdir(path.join(directory,'runtime/bin'),{recursive:true});await mkdir(path.join(directory,'model'));
  await writeFile(path.join(directory,'model/model.bin'),'fixture');await writeFile(path.join(directory,hash+'.audio'),Buffer.alloc(1500));
  // A deterministic subprocess fixture exercises job ordering and on-disk recovery without speech-model/network dependencies.
  await writeFile(path.join(directory,'runtime/bin/python'),'#!/bin/sh\nprintf \'%s\\n\' \'{"event":"started","duration":10}\' \'{"event":"cue","start":1,"end":5,"text":"有时间轴的音频识别结果"}\' \'{"event":"done","duration":10}\'\n',{mode:0o755});
  engine=new PodcastTranscriber(root);const results=await Promise.all([engine.request(episode),engine.request(episode)]);assert.equal(results[0],results[1]);
  const deadline=Date.now()+5000;while((await engine.read(episode))?.status!=='complete'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
  const state=await engine.read(episode);assert.equal(state?.status,'complete');assert.equal(state?.cues.length,1);assert.equal(state?.processedSeconds,10);
  const saved=JSON.parse(await readFile(path.join(directory,episode.id+'.json'),'utf8'));assert.equal(saved.source,'local-asr');
  engine.close();engine=new PodcastTranscriber(root);assert.equal((await engine.read(episode))?.status,'complete');assert.equal((await engine.request(episode))?.cues[0].start,1);
  assert.equal(await engine.read({...episode,audio:'https://example.org/replaced.mp3'}),null);
 }finally{engine?.close();await rm(root,{recursive:true,force:true});}
});

test('interrupted captions remain available and a missing engine is reported truthfully',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-transcript-'));const directory=path.join(root,'data/podcast-asr');const episode={id:'0123456789abcdef01234567',audio:'https://example.org/public.mp3'} as PodcastEpisode;
 try{await mkdir(directory,{recursive:true});await writeFile(path.join(directory,episode.id+'.json'),JSON.stringify({id:episode.id,audioHash:createHash('sha256').update(episode.audio).digest('hex').slice(0,24),status:'transcribing',source:'local-asr',cues:[{start:1,end:2,text:'已保存片段'}],processedSeconds:2,duration:50}));
  const engine=new PodcastTranscriber(root);const value=await engine.read(episode);assert.equal(value?.status,'error');assert.equal(value?.cues.length,1);await assert.rejects(engine.request(episode),/尚未准备好/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('two episodes transcribe concurrently while the third waits and then completes',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-transcript-pool-'));const directory=path.join(root,'data/podcast-asr');let engine:PodcastTranscriber|undefined;
 const episodes=Array.from({length:3},(_,index)=>({id:String(index+1).padStart(24,'0'),audio:'https://example.org/'+index+'.mp3',sourceId:'weekly'} as PodcastEpisode));
 try{
  await mkdir(path.join(directory,'runtime/bin'),{recursive:true});await mkdir(path.join(directory,'model'));await writeFile(path.join(directory,'model/model.bin'),'fixture');
  for(const episode of episodes){const hash=createHash('sha256').update(episode.audio).digest('hex').slice(0,24);await writeFile(path.join(directory,hash+'.audio'),Buffer.alloc(1500));}
  const release=path.join(directory,'release');
  await writeFile(path.join(directory,'runtime/bin/python'),'#!'+process.execPath+'\nconst fs=require("node:fs");console.log(JSON.stringify({event:"started",duration:10}));const timer=setInterval(()=>{if(fs.existsSync('+JSON.stringify(release)+')){clearInterval(timer);console.log(JSON.stringify({event:"cue",start:1,end:9,text:"独立任务的字幕"}));console.log(JSON.stringify({event:"done",duration:10}));}},20);\n',{mode:0o755});
  engine=new PodcastTranscriber(root);await Promise.all(episodes.map(episode=>engine!.request(episode)));
  const deadline=Date.now()+5000;let states=await Promise.all(episodes.map(episode=>engine!.read(episode)));
  while(states.filter(state=>state?.status==='transcribing').length<2&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));states=await Promise.all(episodes.map(episode=>engine!.read(episode)));}
  assert.equal(states.filter(state=>state?.status==='transcribing').length,2);assert.equal(states.filter(state=>state?.status==='queued').length,1);
  await writeFile(release,'ready');
  while(states.some(state=>state?.status!=='complete')&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));states=await Promise.all(episodes.map(episode=>engine!.read(episode)));}
  assert(states.every(state=>state?.status==='complete'&&state.cues.length===1));
 }finally{engine?.close();await rm(root,{recursive:true,force:true});}
});

test('closing stops both active workers and retains their partial captions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-transcript-close-'));const directory=path.join(root,'data/podcast-asr');let engine:PodcastTranscriber|undefined;
 const episodes=Array.from({length:3},(_,index)=>({id:String(index+1).padStart(24,'0'),audio:'https://example.org/close-'+index+'.mp3',sourceId:'weekly'} as PodcastEpisode));
 try{
  await mkdir(path.join(directory,'runtime/bin'),{recursive:true});await mkdir(path.join(directory,'model'));await writeFile(path.join(directory,'model/model.bin'),'fixture');
  for(const episode of episodes){const hash=createHash('sha256').update(episode.audio).digest('hex').slice(0,24);await writeFile(path.join(directory,hash+'.audio'),Buffer.alloc(1500));}
  await writeFile(path.join(directory,'runtime/bin/python'),'#!'+process.execPath+'\nconsole.log(JSON.stringify({event:"started",duration:50}));console.log(JSON.stringify({event:"cue",start:1,end:9,text:"关闭前已保存的字幕"}));setInterval(()=>{},1000);\n',{mode:0o755});
  engine=new PodcastTranscriber(root);await Promise.all(episodes.map(episode=>engine!.request(episode)));
  const deadline=Date.now()+5000;let states=await Promise.all(episodes.map(episode=>engine!.read(episode)));
  while(states.filter(state=>state?.cues.length===1).length<2&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));states=await Promise.all(episodes.map(episode=>engine!.read(episode)));}
  assert.equal(states.filter(state=>state?.cues.length===1).length,2);engine.close();
  while(states.filter(state=>state?.status==='error').length<2&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));states=await Promise.all(episodes.map(episode=>engine!.read(episode)));}
  assert.equal(states.filter(state=>state?.status==='error'&&state.cues.length===1).length,2);assert.equal(states.filter(state=>state?.status==='queued'&&!state.cues.length).length,1);
  for(const episode of episodes){const saved=JSON.parse(await readFile(path.join(directory,episode.id+'.json'),'utf8'));assert.equal(saved.cues.length,states.find(state=>state?.id===episode.id)?.cues.length);}
 }finally{engine?.close();await rm(root,{recursive:true,force:true});}
});
