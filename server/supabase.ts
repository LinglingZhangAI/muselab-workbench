// Server only. Never import this module into browser code or use VITE_ credentials.
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';

export type StoredState={value:string;revision:string};
const mediaTypes:Record<string,string>={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif'};
export function mediaKey(key:string){return /^(?:assets\/(?:pinterest|uploads|news|note-images|research)|article-covers)\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif)$/.test(key);}
export function documentKey(key:string){return /^data\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.json$/.test(key)&&!key.startsWith('data/podcast-asr/runtime/')&&!key.startsWith('data/podcast-asr/model/')&&key!=='data/user-state.json';}
export class SupabaseStore{
 private url:URL;private secret:string;private bucket:string;
 constructor(env:NodeJS.ProcessEnv=process.env){
  this.url=new URL(env.SUPABASE_URL||'');this.secret=env.SUPABASE_SERVICE_ROLE_KEY||'';this.bucket=env.SUPABASE_STORAGE_BUCKET||'muselab-media';
  if(this.url.protocol!=='https:'||this.url.username||this.url.password||this.url.pathname!=='/'||this.url.search||this.url.hash||!this.secret||!/^[a-z0-9-]+$/.test(this.bucket))throw new Error('请配置 Supabase 项目 URL、服务端密钥和私有图片桶');
 }
 private async request(endpoint:string,init:RequestInit={},objectRead=false){
  const headers=new Headers(init.headers);headers.set('apikey',this.secret);
  // Supabase's new sb_secret_ keys use apikey, not a JWT Authorization header.
  if(!this.secret.startsWith('sb_secret_'))headers.set('Authorization','Bearer '+this.secret);
  const response=await fetch(new URL(endpoint,this.url),{...init,headers,redirect:'error',signal:AbortSignal.timeout(45000)});
  // Storage can report a missing object with HTTP 400 plus a 404 statusCode.
  if(objectRead&&response.status===400){const error=await response.clone().json().catch(()=>null);if(String(error?.statusCode)==='404'){await response.body?.cancel();return new Response(null,{status:404});}}
  if(!response.ok&&response.status!==404){await response.body?.cancel();throw new Error('Supabase 请求失败（'+response.status+'），未确认云端保存成功');}
  return response;
 }
 async check(){
  const result=await this.request('/rest/v1/muselab_documents?select=key&limit=1');if(!result.ok)throw new Error('请先执行 Supabase 建表 SQL');await result.body?.cancel();
  const bucket=await this.request('/storage/v1/bucket/'+this.bucket);if(!bucket.ok)throw new Error('请先创建 Supabase 图片桶');
  const info=await bucket.json();if(info.public!==false)throw new Error('Muselab 图片桶必须设为私有');
 }
 async documents(){
  const values:{key:string;value:unknown}[]=[];
  for(let offset=0;;offset+=200){const response=await this.request('/rest/v1/muselab_documents?select=key,value&order=key&limit=200&offset='+offset);if(!response.ok)throw new Error('云端资料读取失败');const rows=await response.json() as {key:string;value:unknown}[];values.push(...rows);if(rows.length<200)break;}
  return values;
 }
 async putDocument(key:string,value:unknown,onlyIfAbsent=false){
  if(!documentKey(key))throw new Error('云端资料路径无效');
  const response=await this.request('/rest/v1/muselab_documents?on_conflict=key',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution='+(onlyIfAbsent?'ignore':'merge')+'-duplicates,return=minimal'},body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});
  if(!response.ok)throw new Error('云端资料保存失败');await response.body?.cancel();
 }
 async state():Promise<Record<string,StoredState>>{
  const response=await this.request('/rest/v1/muselab_state?select=key,value,revision');if(!response.ok)throw new Error('云端笔记读取失败');
  return Object.fromEntries((await response.json() as ({key:string}&StoredState)[]).map(({key,...value})=>[key,value]));
 }
 async putState(key:string,value:string,expected:string){
  const response=await this.request('/rest/v1/rpc/muselab_save_state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_key:key,p_value:value,p_expected:expected})});
  if(!response.ok)throw new Error('云端笔记保存失败');return await response.json() as {saved:boolean;revision?:string};
 }
 private objectPath(key:string){if(!mediaKey(key))throw new Error('图片路径无效');return '/storage/v1/object/'+this.bucket+'/'+key.split('/').map(encodeURIComponent).join('/');}
 async putMedia(key:string,bytes:Buffer){
  if(!bytes.length||bytes.length>5*1024*1024)throw new Error('图片应在 5 MB 以内');
  const response=await this.request(this.objectPath(key),{method:'POST',headers:{'Content-Type':mediaTypes[path.extname(key)],'x-upsert':'true'},body:new Uint8Array(bytes)});if(!response.ok)throw new Error('云端图片保存失败');await response.body?.cancel();
 }
 async media(key:string){
  const response=await this.request(this.objectPath(key),{},true);if(response.status===404)return null;
  const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>5*1024*1024)throw new Error('云端图片大小无效');
  return {bytes,type:mediaTypes[path.extname(key)]};
 }
}
const stores=new Map<string,SupabaseStore>();
export const storeFor=(root:string)=>stores.get(path.resolve(root));
export async function atomicLocalFile(file:string,contents:string|Buffer){
 await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,contents);await rename(temporary,file);
}
// Upload before changing the local cache. A failed upload never returns a false success.
export async function durableFile(root:string,file:string,contents:string|Buffer){
 const store=storeFor(root);const key=path.relative(root,file).split(path.sep).join('/');
 if(store){
  if(key.startsWith('public/')&&mediaKey(key.slice(7)))await store.putMedia(key.slice(7),Buffer.from(contents));
  else if(documentKey(key))await store.putDocument(key,JSON.parse(contents.toString()));
  else throw new Error('此路径尚未配置云端持久存储');
 }
 await atomicLocalFile(file,contents);
}
export async function initializeSupabase(root:string,store=new SupabaseStore()){
 await store.check();
 for(const {key,value} of await store.documents()){
  if(!documentKey(key))throw new Error('云端资料包含无效路径');
  await atomicLocalFile(path.join(root,key),JSON.stringify(value));
 }
 stores.set(path.resolve(root),store);return store;
}
export async function cachedMediaExists(root:string,key:string){
 if(!mediaKey(key))return false;
 try{if((await readFile(path.join(root,'public',key))).length)return true;}catch{/* Restore a synced image on demand. */}
 const media=await storeFor(root)?.media(key);if(!media)return false;await atomicLocalFile(path.join(root,'public',key),media.bytes);return true;
}
