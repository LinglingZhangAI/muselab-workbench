import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {storeFor} from './supabase.ts';
type Stored={value:string;revision:string};
type State=Record<string,Stored>;
export function cloudState(root:string){
 const file=path.join(root,'data/user-state.json');let queue=Promise.resolve();
 const read=async():Promise<State>=>{const store=storeFor(root);if(store)return store.state();try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}};
 const allowed=(key:string)=>['muselab-notes:v1','muselab-folders:v1','muselab-note-folders:v1','eagle-prompt-library:v1','muselab-whiteboard:v1'].includes(key)||/^muselab-timeline:v2:\d{4}-\d{2}-\d{2}$/.test(key);
 return(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/', 'http://localhost');if(url.pathname!=='/api/user-state')return next();
  const reply=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method==='GET'){void read().then(state=>{const key=url.searchParams.get('key');if(key&&!allowed(key))return reply(400,{error:'存储项目无效'});if(key)return reply(200,{cloud:true,state:state[key]?{[key]:state[key]}:{}});delete state['muselab-whiteboard:v1'];reply(200,{cloud:true,state});},()=>reply(503,{error:'云端内容读取失败，已保留本机副本'}));return;}
  if(req.method!=='PUT')return reply(405,{error:'请求方式不支持'});
  void(async()=>{
   const key=url.searchParams.get('key')||'';if(!allowed(key))return reply(400,{error:'存储项目无效'});
   const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(key==='muselab-whiteboard:v1'?24:8)*1024*1024)return reply(413,{error:'内容超过云端保存限制'});chunks.push(Buffer.from(chunk));}
   const value=Buffer.concat(chunks).toString('utf8');const parsed=JSON.parse(value);if(key==='muselab-whiteboard:v1'?(!parsed||Array.isArray(parsed)||typeof parsed!=='object'):!Array.isArray(parsed))return reply(400,{error:'存储内容格式无效'});
   queue=queue.catch(()=>{}).then(async()=>{
    const store=storeFor(root);if(store){const result=await store.putState(key,value,String(req.headers['if-match']||''));return result.saved?reply(200,result):reply(409,{error:'另一台设备已修改此内容，当前修改保留在本机。请备份后重新打开。'});}
    const state=await read();if((state[key]?.revision||'')!==(req.headers['if-match']||''))return reply(409,{error:'另一台设备已修改此内容。当前修改保留在本机，请先导出备份再重新打开页面。'});
    const revision=randomUUID();state[key]={value,revision};const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(state));await rename(tmp,file);reply(200,{saved:true,revision});
   });await queue;
  })().catch(()=>{if(!res.headersSent)reply(503,{error:'云端保存失败，当前内容已保留在本机'});});
 };
}
