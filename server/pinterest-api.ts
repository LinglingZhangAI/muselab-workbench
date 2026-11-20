import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import type {Asset} from '../src/data/assets';
import {durableFile} from './supabase';
type Saved={assets:Asset[];collectedCount:number;errors:string[]};
type Pin={id:string;imageUrl:string;width:number;height:number;title?:string};
type Job={running:boolean;processed:number;total:number;added:number;skipped:number;errors:string[]};
export function pinterestApi(root:string):Plugin{
 const file=path.join(root,'data/pinterest-library.json');
 const images=path.join(root,'public/assets/pinterest');
 const seedFile=path.join(root,'src/data/pinterest-import.json');
 let job:Job={running:false,processed:0,total:0,added:0,skipped:0,errors:[]};
 const read=async():Promise<Saved>=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return {assets:[],collectedCount:25,errors:[]};}};
 const save=async(data:Saved)=>{await durableFile(root,file,JSON.stringify(data,null,2));};
 const reply=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 async function body(req:IncomingMessage){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new Error('导入文件过大');chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 function validPin(pin:Pin){try{const url=new URL(pin.imageUrl);return /^\d{8,25}$/.test(pin.id)&&url.protocol==='https:'&&url.hostname==='i.pinimg.com'&&!url.username&&!url.password&&Number.isFinite(pin.width)&&pin.width>0&&Number.isFinite(pin.height)&&pin.height>0;}catch{return false;}}
 async function download(pin:Pin){
  const response=await fetch(pin.imageUrl,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw new Error('图片下载失败 '+response.status);
  const type=response.headers.get('content-type')?.split(';')[0];
  const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'} as Record<string,string>)[type||''];
  if(!extension)throw new Error('暂不支持该图片格式');
  const chunks:Uint8Array[]=[];let size=0;const reader=response.body?.getReader();if(!reader)throw new Error('图片为空');
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3*1024*1024)throw new Error('图片超过 3 MB');chunks.push(value);}}finally{await reader.cancel();}
  if(!size)throw new Error('图片为空');
  await mkdir(images,{recursive:true});const name=pin.id+'.'+extension;await durableFile(root,path.join(images,name),Buffer.concat(chunks));
  return {id:'pinterest-'+pin.id,pinId:pin.id,title:pin.title?.trim().slice(0,160)||'Pinterest 收藏 '+pin.id,imageUrl:'/assets/pinterest/'+name,width:pin.width,height:pin.height,prompt:'',sourceUrl:`https://www.pinterest.com/pin/${pin.id}/`,tags:['Pinterest'],folder:'待分类',palette:[],favorite:false,deleted:false,createdAt:new Date().toISOString().slice(0,10),format:extension.toUpperCase(),analysisStatus:'pending'} satisfies Asset;
 }
 async function importPins(pins:Pin[]){
  const saved=await read();const seed=JSON.parse(await readFile(seedFile,'utf8'));
  const known=new Set<string>([...seed.assets.map((a:Asset)=>a.pinId),...saved.assets.map(a=>a.pinId)]);
  let index=0;
  await Promise.all(Array.from({length:3},async()=>{while(index<pins.length){const pin=pins[index++];if(known.has(pin.id)){job.skipped++;job.processed++;continue;}known.add(pin.id);try{saved.assets.push(await download(pin));job.added++;}catch(e){job.errors.push(`${pin.id}: ${e instanceof Error?e.message:'下载失败'}`);}job.processed++;}}));
  saved.collectedCount=seed.assets.length+saved.assets.length;saved.errors=[...job.errors];await save(saved);
 }
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=req.url?.split('?')[0];if(!url?.startsWith('/api/pinterest/'))return next();
  // Only this local workbench and the user's installed extension can import.
  const origin=req.headers.origin||'';
  const same=!origin||['http://'+req.headers.host,'https://'+req.headers.host].includes(origin);
  const extension=/^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  if(!same&&!extension)return reply(res,403,{error:'请从个人工作台或本地采集扩展导入'});
  if(extension){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  void(async()=>{
   if(url==='/api/pinterest/library'&&req.method==='GET')return reply(res,200,{...await read(),job});
   if(url==='/api/pinterest/import'&&req.method==='POST'){
    if(job.running)return reply(res,409,{error:'已有导入任务，请等待完成'});
    if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'请导入 JSON 数据'});
    const input=await body(req);
    if(typeof input.username!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(input.username)||!Array.isArray(input.pins)||input.pins.length>2000||!input.pins.length)return reply(res,400,{error:'请使用 Pinterest 收藏页的采集文件'});
    if(!input.pins.every(validPin))return reply(res,400,{error:'采集文件包含无效的 Pin 或图片地址'});
    const unique=[...new Map<string,Pin>(input.pins.map((p:Pin)=>[p.id,p])).values()];
    job={running:true,processed:0,total:unique.length,added:0,skipped:0,errors:[]};
    void importPins(unique).catch(()=>job.errors.push('本地保存失败，请重试导入')).finally(()=>{job.running=false;});
    return reply(res,202,{accepted:true,total:unique.length});
   }
   if(url==='/api/pinterest/analysis'&&req.method==='POST'&&same){
    if(job.running)return reply(res,409,{error:'导入进行中，请稍后保存分析结果'});
    const input=await body(req);const saved=await read();
    const target=saved.assets.find(a=>a.id===input.id);
    if(!target)return reply(res,404,{error:'未找到素材'});
    if(typeof input.prompt!=='string'||input.prompt.length>50000||typeof input.folder!=='string'||!['complete','non-ui'].includes(input.analysisStatus))return reply(res,400,{error:'分析结果无效'});
    Object.assign(target,{prompt:input.prompt,folder:input.folder,analysisStatus:input.analysisStatus,tags:Array.isArray(input.tags)?input.tags.filter((v:unknown)=>typeof v==='string').slice(0,20):target.tags});
    if(typeof input.title==='string'&&input.title.trim())target.title=input.title.trim().slice(0,160);
    await save(saved);return reply(res,200,{saved:true});
   }
   return reply(res,404,{error:'接口不存在'});
  })().catch(()=>{if(!res.headersSent)reply(res,400,{error:'无法读取或保存导入文件，请检查文件后重试'});});
 };
 return {name:'pinterest-local-import',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
