import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {SupabaseStore,initializeSupabase,durableFile,mediaKey,documentKey} from './supabase.ts';
import {cloudState} from './cloud-state.ts';

test('durable cloud data, private images, recovery and conflict handling',async t=>{
 const original=globalThis.fetch;
 const documents=new Map<string,unknown>();const images=new Map<string,Uint8Array>();const states=new Map<string,{value:string;revision:string}>();
 let failWrites=false;let publicBucket=false;let revision=0;
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test_only'};
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));const headers=new Headers(init.headers);
  assert.equal(url.origin,env.SUPABASE_URL);assert.equal(headers.get('apikey'),env.SUPABASE_SERVICE_ROLE_KEY);assert.equal(headers.get('Authorization'),null);
  const json=(value:unknown,status=200)=>Response.json(value,{status});
  if(url.pathname.startsWith('/storage/v1/bucket/'))return json({id:'muselab-media',public:publicBucket});
  if(failWrites&&init.method==='POST')return json({error:'storage unavailable'},503);
  if(url.pathname==='/rest/v1/muselab_documents'){
   if(init.method==='POST'){const body=JSON.parse(String(init.body));if(!documents.has(body.key)||headers.get('prefer')?.includes('merge-duplicates'))documents.set(body.key,body.value);return new Response(null,{status:201});}
   const rows=[...documents].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,value}));const offset=Number(url.searchParams.get('offset')||0);return json(rows.slice(offset,offset+Number(url.searchParams.get('limit')||200)));
  }
  if(url.pathname==='/rest/v1/muselab_state')return json([...states].map(([key,entry])=>({key,...entry})));
  if(url.pathname==='/rest/v1/rpc/muselab_save_state'){
   const body=JSON.parse(String(init.body));if((states.get(body.p_key)?.revision||'')!==body.p_expected)return json({saved:false});
   const next=String(++revision);states.set(body.p_key,{value:body.p_value,revision:next});return json({saved:true,revision:next});
  }
  if(url.pathname.startsWith('/storage/v1/object/muselab-media/')){
   const key=url.pathname.slice('/storage/v1/object/muselab-media/'.length);
   if(init.method==='POST'){assert.equal(headers.get('x-upsert'),'true');images.set(key,new Uint8Array(init.body as Uint8Array));return json({Key:key});}
   const bytes=images.get(key);return bytes?new Response(new Uint8Array(bytes)):json({statusCode:'404',error:'not_found'},400);
  }
  throw new Error('Unexpected request '+url.pathname);
 };
 const roots:string[]=[];const temporary=async()=>{const root=await mkdtemp(path.join(tmpdir(),'muselab-storage-test-'));roots.push(root);return root;};
 try{
  const store=new SupabaseStore(env);const root=await temporary();await initializeSupabase(root,store);
  await t.test('writes text to PostgreSQL and restores after losing the entire cache',async()=>{
   const key='data/daily-news.json';await durableFile(root,path.join(root,key),JSON.stringify({date:'2026-10-26',items:[{title:'真实来源'}]}));
   assert.equal((documents.get(key) as {date:string}).date,'2026-10-26');
   const restarted=await temporary();await initializeSupabase(restarted,store);assert.deepEqual(JSON.parse(await readFile(path.join(restarted,key),'utf8')),documents.get(key));
  });
  await t.test('does not replace the valid cache on a remote write failure',async()=>{
   failWrites=true;await assert.rejects(durableFile(root,path.join(root,'data/daily-news.json'),'{"changed":true}'),/503/);failWrites=false;
   assert.equal(JSON.parse(await readFile(path.join(root,'data/daily-news.json'),'utf8')).date,'2026-10-26');
  });
  await t.test('missing private objects are handled correctly and new images persist',async()=>{
   const key='assets/uploads/test.png';assert.equal(await store.media(key),null);
   const bytes=Buffer.from([137,80,78,71,13,10,26,10]);await durableFile(root,path.join(root,'public',key),bytes);
   assert.deepEqual((await store.media(key))?.bytes,bytes);assert.deepEqual(await readFile(path.join(root,'public',key)),bytes);
  });
  await t.test('state API returns conflicts and reads the committed database state',async()=>{
   const handler=cloudState(root);
   async function request(method:string,url:string,body='',expected=''){
    return new Promise<{status:number;body:any}>(resolve=>{
     const req=Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;req.method=method;req.url=url;req.headers={'if-match':expected};
     let status=200;const stub={headersSent:false,writeHead(code:number){status=code;stub.headersSent=true;},end(value:string){resolve({status,body:JSON.parse(value)});}};
     handler(req,stub as unknown as ServerResponse,()=>assert.fail('State route was not handled'));
    });
   }
   const url='/api/user-state?key=muselab-notes%3Av1';const first=await request('PUT',url,'[{"title":"笔记"}]');assert.equal(first.status,200);
   const conflict=await request('PUT',url,'[]');assert.equal(conflict.status,409);
   assert.equal(JSON.parse((await request('GET',url)).body.state['muselab-notes:v1'].value)[0].title,'笔记');
   const saved=await request('PUT',url,'[{"title":"已更新"}]',first.body.revision);assert.equal(saved.status,200);
   assert.equal((await request('PUT',url,'{}',saved.body.revision)).status,400);
   const board=await request('PUT','/api/user-state?key=muselab-whiteboard%3Av1','{"elements":[],"files":{}}');assert.equal(board.status,200);
   assert.equal((await request('GET','/api/user-state')).body.state['muselab-whiteboard:v1'],undefined);
  });
  await t.test('initial migration preserves existing cloud documents',async()=>{
   await store.putDocument('data/daily-news.json',{changed:true},true);assert.equal((documents.get('data/daily-news.json') as {date:string}).date,'2026-10-26');
  });
  await t.test('rejects public buckets and unsafe paths',async()=>{
   publicBucket=true;await assert.rejects(store.check(),/私有/);publicBucket=false;
   for(const key of ['../secrets.png','assets/uploads/../../secrets.png','assets/uploads/private.svg','assets/uploads/x.png?secret'])assert.equal(mediaKey(key),false);
   for(const key of ['data/../.env.json','data/user-state.json','data/podcast-asr/runtime/key.json'])assert.equal(documentKey(key),false);
   await assert.rejects(durableFile(root,path.join(root,'private.json'),'{}'),/尚未配置/);
  });
 }finally{globalThis.fetch=original;await Promise.all(roots.map(root=>rm(root,{recursive:true,force:true})));}
});
