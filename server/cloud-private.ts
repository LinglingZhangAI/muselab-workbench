import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {shanghaiDay,readNews} from './news-source';
import {workItemsFromRecords,type WorkRecord} from '../src/lib/work-task-summary';
import {imageExtension} from './note-images';
import {cachedMediaExists,durableFile} from './supabase';

async function readBody(req:IncomingMessage,limit:number){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('同步内容过大');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}
export function privateSync(root:string,token:string){
 return(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/', 'http://localhost');if(!url.pathname.startsWith('/api/private/'))return next();
  const value=req.headers.authorization?.replace(/^Bearer /,'')||'';
  const reply=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(!token||Buffer.byteLength(value)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(value),Buffer.from(token)))return reply(401,{error:'同步凭据无效'});
  if(req.method!=='POST')return reply(405,{error:'仅支持同步写入'});
  void(async()=>{
   if(url.pathname==='/api/private/brief'){
    const brief=JSON.parse((await readBody(req,1024*1024)).toString('utf8'));const day=shanghaiDay();
    const validItem=(r:WorkRecord)=>r&&['title','detail','status','threadId','threadTitle'].every(k=>typeof r[k as keyof WorkRecord]==='string')&&/^[a-f0-9-]{36}$/.test(r.threadId);
    if(brief.date!==day||!Number.isFinite(Date.parse(brief.updatedAt))||typeof brief.coverage!=='string'||!Array.isArray(brief.work)||!brief.work.every(validItem)||!Array.isArray(brief.updates)||!brief.updates.every(validItem)||!Array.isArray(brief.timeline)||!brief.timeline.every((r:WorkRecord)=>validItem(r)&&typeof r.id==='string'&&r.status==='已完成'&&Number.isFinite(Date.parse(r.start))&&Number.isFinite(Date.parse(r.end))&&Date.parse(r.end)>=Date.parse(r.start)&&shanghaiDay(new Date(r.start))===day&&shanghaiDay(new Date(r.end))===day))return reply(400,{error:'仅接受今天的有效简报与完成记录'});
    const file=path.join(root,'data/daily-brief.json');await durableFile(root,file,JSON.stringify(brief));return reply(200,{saved:true,date:day,records:brief.timeline.length});
   }
   if(url.pathname==='/api/private/media'){
    const name=url.searchParams.get('path')||'';if(!/^(?:assets\/(?:pinterest|uploads|news|note-images|research)|article-covers)\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp|gif|avif)$/.test(name))return reply(400,{error:'图片路径无效'});
    const target=path.join(root,'public',name);if(await cachedMediaExists(root,name))return reply(200,{saved:true,skipped:true});
    const data=await readBody(req,5*1024*1024);const extension=imageExtension(data);if(!name.endsWith('.'+extension))return reply(400,{error:'图片格式不匹配'});await durableFile(root,target,data);return reply(201,{saved:true});
   }
   if(url.pathname==='/api/private/library'){
    const input=JSON.parse((await readBody(req,2*1024*1024)).toString('utf8'));
    if(!Array.isArray(input.assets)||!input.assets.every((a:Record<string,unknown>)=>a&&typeof a.pinId==='string'&&/^\d+$/.test(a.pinId)&&a.id==='pinterest-'+a.pinId&&typeof a.imageUrl==='string'&&new RegExp('^/assets/pinterest/'+a.pinId+'\\.(jpg|png|webp|avif)$').test(a.imageUrl)&&typeof a.title==='string'&&typeof a.prompt==='string'&&typeof a.folder==='string'&&Array.isArray(a.tags)))return reply(400,{error:'素材清单格式无效'});
    for(const a of input.assets)if(!await cachedMediaExists(root,a.imageUrl.slice(1)))throw new Error('请先同步素材图片');
    const file=path.join(root,'data/pinterest-library.json');let existing:{assets:{id:string}[]}={assets:[]};try{existing=JSON.parse(await readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const merged=new Map(existing.assets.map(a=>[a.id,a]));let added=0;for(const a of input.assets)if(!merged.has(a.id)){merged.set(a.id,a);added++;}
    const seed=JSON.parse(await readFile(path.join(root,'src/data/pinterest-import.json'),'utf8'));const assets=[...merged.values()];await durableFile(root,file,JSON.stringify({assets,collectedCount:new Set([...seed.assets,...assets].map(a=>a.id)).size,errors:[]}));return reply(200,{saved:true,added});
   }
   if(url.pathname==='/api/private/document'){
    const name=url.searchParams.get('path')||'';
    if(!['data/daily-news.json','data/design-articles.json','data/daily-podcasts.json'].includes(name)&&!/^data\/podcast-asr\/[a-f0-9]{24}\.json$/.test(name))return reply(400,{error:'同步资料路径无效'});
    const input=JSON.parse((await readBody(req,8*1024*1024)).toString('utf8'));
    if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{error:'同步资料格式无效'});
    if(name.startsWith('data/podcast-asr/')&&(input.id!==path.basename(name,'.json')||input.status!=='complete'||!Array.isArray(input.cues)||!input.cues.length||!input.cues.every((c:{start:number;end:number;text:string})=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start&&typeof c.text==='string')))return reply(400,{error:'仅同步已经完成的真实字幕'});
    if(!name.startsWith('data/podcast-asr/')){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.fetchedAt))||!Array.isArray(name.endsWith('daily-podcasts.json')?input.episodes:input.items))return reply(400,{error:'同步资料内容无效'});}
    await durableFile(root,path.join(root,name),JSON.stringify(input));return reply(200,{saved:true});
   }
   reply(404,{error:'同步接口不存在'});
  })().catch(()=>{if(!res.headersSent)reply(400,{error:'同步失败，已保留上次内容'});});
 };
}
export function cloudBrief(root:string){return(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
 const pathname=req.url?.split('?')[0];if(!['/api/daily-brief','/api/daily-brief/refresh'].includes(pathname||''))return next();
 void(async()=>{let brief;try{brief=JSON.parse(await readFile(path.join(root,'data/daily-brief.json'),'utf8'));}catch{brief={date:shanghaiDay(),updatedAt:new Date().toISOString(),greeting:'欢迎回来。',work:[],updates:[],timeline:[],coverage:'云端尚未收到本机同步的 Codex 工作记录。'};}
 const news=await readNews(root);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({...brief,work:brief.timeline?.length?workItemsFromRecords(brief.timeline):brief.work,today:shanghaiDay(),stale:brief.date!==shanghaiDay(),newsCount:news?.date===shanghaiDay()?news.items.length:0,...(req.method==='POST'?{warning:'已读取云端最近同步的记录；新的 Codex 工作需从本机同步。'}:{})}));})().catch(()=>{res.writeHead(503);res.end(JSON.stringify({error:'工作简报暂不可用'}));});
 };}
