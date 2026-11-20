import {spawn,type ChildProcess} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,stat,unlink} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {get} from 'node:https';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {publicAddress,rewriteUrl} from './rewrite-source.ts';
import type {PodcastEpisode} from '../src/lib/podcasts';
import {podcastSources} from '../src/lib/podcasts.ts';
import type {PodcastCue} from '../src/lib/podcast-playback';

export type TranscriptState={id:string;audioHash:string;status:'queued'|'downloading'|'transcribing'|'complete'|'error';cues:PodcastCue[];processedSeconds:number;duration:number;updatedAt:string;source:'local-asr';error?:string};
export function validCue(cue:PodcastCue){return Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&cue.start>=0&&cue.end>cue.start&&typeof cue.text==='string'&&cue.text.trim().length>0;}
export async function downloadPodcastAudio(value:string,file:string){
 let url=rewriteUrl(value);
 for(let redirect=0;redirect<5;redirect++){
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(address=>!publicAddress(address.address)))throw new Error('音频地址不是公开地址');const address=addresses[0];
  const response=await new Promise<import('node:http').IncomingMessage>((resolve,reject)=>{
   const request=get(url,{headers:{'User-Agent':'Muselab Podcast Reader'},lookup:(_host,options,done)=>{if(typeof options==='object'&&options.all)(done as Function)(null,[address]);else done(null,address.address,address.family);}},resolve);
   request.setTimeout(30000,()=>request.destroy(new Error('音频下载超时')));request.on('error',reject);
  });
  if((response.statusCode||0)>=300&&(response.statusCode||0)<400){response.resume();if(!response.headers.location)throw new Error('音频跳转失败');url=rewriteUrl(new URL(response.headers.location,url).href);continue;}
  if(response.statusCode!==200){response.resume();throw new Error('原站音频暂时无法读取');}
  if(!/^(audio\/|video\/mp4|application\/octet-stream)/i.test(response.headers['content-type']||'')){response.resume();throw new Error('原站未返回音频文件');}
  let size=0;const limit=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;callback(size>400*1024*1024?new Error('本期音频超过 400 MB'):null,chunk);}});
  const timer=setTimeout(()=>response.destroy(new Error('音频下载超时')),30*60*1000);
  try{await pipeline(response,limit,createWriteStream(file,{flags:'wx'}));if(size<1000)throw new Error('音频文件为空');return;}finally{clearTimeout(timer);}
 }
 throw new Error('音频跳转过多');
}
export class PodcastTranscriber{
 private newest=new Set<string>();
 private states=new Map<string,TranscriptState>();private requests=new Map<string,Promise<TranscriptState>>();private queue:PodcastEpisode[]=[];private workers=0;private children=new Set<ChildProcess>();private stopped=false;
 private root:string;
 constructor(root:string){this.root=root;}
 private directory(){return path.join(this.root,'data/podcast-asr');}
 private hash(episode:PodcastEpisode){return createHash('sha256').update(episode.audio).digest('hex').slice(0,24);}
 private file(id:string){return path.join(this.directory(),id+'.json');}
 async read(episode:PodcastEpisode){
  const cached=this.states.get(episode.id);if(cached?.audioHash===this.hash(episode))return cached;
  try{const value=JSON.parse(await readFile(this.file(episode.id),'utf8')) as TranscriptState;
   if(value.id===episode.id&&value.audioHash===this.hash(episode)&&Array.isArray(value.cues)&&value.cues.length<20000&&value.cues.every(validCue)){
    if(value.status!=='complete'&&value.status!=='error'){value.status='error';value.error='上次转写中断，重新打开字幕即可继续。';}this.states.set(episode.id,value);return value;
   }
  }catch{/* No previously generated captions. */}
  return null;
 }
 private async save(state:TranscriptState){state.updatedAt=new Date().toISOString();await mkdir(this.directory(),{recursive:true});const file=this.file(state.id);const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state)+'\n');await rename(temp,file);}
 request(episode:PodcastEpisode,latest=false){
  if(latest)this.newest.add(episode.id);
  const existing=this.requests.get(episode.id);if(existing)return existing;
  const pending=this.enqueue(episode).finally(()=>this.requests.delete(episode.id));this.requests.set(episode.id,pending);return pending;
 }
 private async enqueue(episode:PodcastEpisode){
  const old=await this.read(episode);if(old&&old.status!=='error')return old;
  if(!episode.audio)throw new Error('这期没有可读取的公开音频');
  const python=path.join(this.directory(),'runtime/bin/python');const model=path.join(this.directory(),'model');
  try{await stat(python);await stat(path.join(model,'model.bin'));}catch{throw new Error('本机字幕引擎尚未准备好，请稍后重试。');}
  const state:TranscriptState={id:episode.id,audioHash:this.hash(episode),status:'queued',source:'local-asr',cues:old?.cues||[],processedSeconds:old?.processedSeconds||0,duration:old?.duration||0,updatedAt:new Date().toISOString()};
  this.states.set(episode.id,state);await this.save(state);this.queue.push(episode);void this.drain().catch(()=>{});return state;
 }
 private async drain(){
  while(this.workers<2&&this.queue.length&&!this.stopped){
   this.queue.sort((a,b)=>Number(this.newest.has(b.id))-Number(this.newest.has(a.id))||(b.publishedAt||'').localeCompare(a.publishedAt||''));
   const episode=this.queue.shift()!;const state=this.states.get(episode.id)!;this.workers++;
   void (async()=>{try{await this.run(episode,state);}catch(error){state.status='error';state.error=error instanceof Error?error.message:'本机转写失败';await this.save(state);}finally{this.workers--;void this.drain().catch(()=>{});}})().catch(()=>{});
  }
 }
 private async run(episode:PodcastEpisode,state:TranscriptState){
  const audio=path.join(this.directory(),state.audioHash+'.audio');let exists=false;try{exists=(await stat(audio)).size>1000;}catch{}
  if(!exists){state.status='downloading';await this.save(state);const temp=audio+'.'+randomUUID()+'.tmp';try{await downloadPodcastAudio(episode.audio,temp);await rename(temp,audio);}catch(error){await unlink(temp).catch(()=>{});throw error;}}
  state.status='transcribing';await this.save(state);
  const offset=state.cues.at(-1)?.end||0;const python=path.join(this.directory(),'runtime/bin/python');
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(python,[path.join(this.root,'scripts/transcribe-podcast.py'),audio,path.join(this.directory(),'model'),podcastSources.find(source=>source.id===episode.sourceId)?.language||'zh',String(offset)],{cwd:this.root,stdio:['ignore','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});this.children.add(child);
   let stderr='',lastSave=0,write=Promise.resolve();let done=false;
   const lines=createInterface({input:child.stdout!});lines.on('line',line=>{try{const data=JSON.parse(line);if(data.event==='started'&&Number.isFinite(data.duration))state.duration=data.duration;
    if(data.event==='cue'&&validCue(data)&&data.start>=offset&&state.cues.length<20000){state.cues.push({start:data.start,end:data.end,text:data.text.slice(0,3000)});state.processedSeconds=data.end;}
    if(data.event==='done'){done=true;state.processedSeconds=state.duration;}
    if(Date.now()-lastSave>3000){lastSave=Date.now();write=write.then(()=>this.save(state));}
   }catch{/* Only validated machine-readable events are consumed. */}});
   child.stderr!.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-3000);});
   const timer=setTimeout(()=>{child.kill('SIGTERM');},3*60*60*1000);
   child.once('error',error=>{clearTimeout(timer);this.children.delete(child);reject(error);});child.once('close',code=>{clearTimeout(timer);this.children.delete(child);void write.then(()=>{if(code===0&&done&&state.cues.length)resolve();else reject(new Error(stderr.includes('No module')?'本机字幕依赖不可用，请修复后重试。':'本机转写中断，已保留生成的字幕，可重试继续。'));},reject);});
  });
  state.status='complete';await this.save(state);await unlink(audio).catch(()=>{});
 }
 close(){this.stopped=true;for(const child of this.children)child.kill('SIGTERM');}
}
