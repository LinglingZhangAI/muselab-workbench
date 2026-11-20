import type {Plugin} from 'vite';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {load} from 'cheerio';
import {durableFile} from './supabase.ts';

export const buildersSite='https://luolan0214.github.io/follow-builders-newsletter/';
export type BuildersEntry={url:string;date:string;title:string;description:string;issue:string};
export function parseBuildersDirectory(html:string){
 const $=load(html);const unique=new Map<string,BuildersEntry>();
 $('#archive .archive-link').each((_,element)=>{const link=$(element);try{const url=new URL(link.attr('href')||'',buildersSite);const title=link.find('.archive-entry-title').text().trim();if(url.origin!==new URL(buildersSite).origin||!/^\/follow-builders-newsletter\/issues\/[^/]+\.html$/.test(url.pathname)||!title||unique.has(url.href))return;
 unique.set(url.href,{url:url.href,title:title.slice(0,300),date:link.find('.archive-date').text().trim().slice(0,50),description:link.find('.archive-entry-desc').text().trim().slice(0,1000),issue:link.find('.archive-issue').text().trim().slice(0,50)});
 }catch{/* Only the known newsletter's article links are accepted. */}});
 if(!unique.size)throw new Error('原站暂未返回可用目录');return [...unique.values()];
}
type Directory={entries:BuildersEntry[];fetchedAt:string};
export function buildersApi(root:string,fetchSource:typeof fetch=fetch):Plugin{
 const file=path.join(root,'data/builders-directory.json');let stored:Directory|null=null;let pending:Promise<Directory>|null=null;let lastAttempt=0;let lastError='';
 async function read(){if(stored)return stored;try{const data=JSON.parse(await readFile(file,'utf8'));if(Array.isArray(data.entries)&&data.entries.length&&Number.isFinite(Date.parse(data.fetchedAt))&&data.entries.every((item:BuildersEntry)=>typeof item.title==='string'&&typeof item.url==='string'&&item.url.startsWith(buildersSite+'issues/')))stored=data;}catch{}return stored;}
 async function update(){if(pending)return pending;lastAttempt=Date.now();pending=(async()=>{
  const response=await fetchSource(buildersSite,{signal:AbortSignal.timeout(30000),headers:{Accept:'text/html','Accept-Encoding':'gzip, br','User-Agent':'Muselab Reader'}});if(!response.ok)throw new Error('原站暂时无法读取');
  const reader=response.body?.getReader();if(!reader)throw new Error('目录为空');const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new Error('目录过大');chunks.push(value);}}finally{await reader.cancel();}
  const entries=parseBuildersDirectory(Buffer.concat(chunks).toString('utf8'));const value={entries,fetchedAt:new Date().toISOString()};await durableFile(root,file,JSON.stringify(value)+'\n');stored=value;lastError='';return value;
 })().finally(()=>{pending=null;});return pending;}
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/builders-directory')return next();const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取目录'});
  void(async()=>{let value=await read();let stale=!value||Date.now()-Date.parse(value.fetchedAt)>30*60000;
   if(!value||url.searchParams.has('refresh')||(stale&&(pending||Date.now()-lastAttempt>60000))){
    try{value=await update();return reply(200,{...value,stale:false});}
    catch{lastError='原站刷新失败，已保留上次目录。';stale=true;if(!value)throw new Error(lastError);}
   }
   reply(200,{...value,stale,...(lastError?{warning:lastError}:{})});
  })().catch(()=>reply(503,{error:'目录暂时无法读取，请重试或打开原站。'}));
 };
 return {name:'muselab-builders',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
