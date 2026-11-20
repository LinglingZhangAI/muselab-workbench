import {readFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const origin=new URL(process.env.MUSELAB_CLOUD_URL||'');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('MUSELAB_CLOUD_URL 必须是云端 HTTPS 根地址');
const token=process.env.MUSELAB_SYNC_TOKEN||'';if(token.length<32)throw new Error('请配置 Render 中的 MUSELAB_SYNC_TOKEN');
async function post(endpoint,body,type='application/json'){
 const response=await fetch(new URL(endpoint,origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':type},body,redirect:'error',signal:AbortSignal.timeout(45000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'同步失败 '+response.status);return data;
}
let failures=0;
async function section(name,run){try{await run();console.log(name+'：同步完成');}catch(error){failures++;console.error(name+'：'+error.message);}}
let mediaFailed=false;
await section('图片',async()=>{
 let errors=0;
 for(const directory of ['assets/pinterest','assets/uploads','assets/news','assets/note-images','assets/research','article-covers']){
  for(const entry of await readdir(path.join(root,'public',directory),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
   if(!entry.isFile()||! /^[a-zA-Z0-9_-]+\.(?:jpg|png|webp|gif|avif)$/.test(entry.name))continue;
   const key=directory+'/'+entry.name;
   try{await post('/api/private/media?path='+encodeURIComponent(key),await readFile(path.join(root,'public',key)),'application/octet-stream');}catch(error){errors++;console.error('图片同步失败：'+key+' '+error.message);}
  }
 }
 if(errors){mediaFailed=true;throw new Error(errors+' 张图片未同步，本次保留云端原有文章和素材清单');}
});
// Keep independent sections running even if one source is unavailable.
if(!mediaFailed){
 await section('灵感库',async()=>{const library=JSON.parse(await readFile(path.join(root,'data/pinterest-library.json'),'utf8'));await post('/api/private/library',JSON.stringify({assets:library.assets}));});
 for(const name of ['daily-news.json','design-articles.json'])await section(name,async()=>{await post('/api/private/document?path='+encodeURIComponent('data/'+name),await readFile(path.join(root,'data',name),'utf8'));});
}
await section('播客',async()=>{await post('/api/private/document?path=data%2Fdaily-podcasts.json',await readFile(path.join(root,'data/daily-podcasts.json'),'utf8'));});
await section('字幕',async()=>{
 for(const name of await readdir(path.join(root,'data/podcast-asr')).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
  if(!/^[a-f0-9]{24}\.json$/.test(name))continue;
  const body=await readFile(path.join(root,'data/podcast-asr',name),'utf8');if(JSON.parse(body).status!=='complete')continue;
  await post('/api/private/document?path='+encodeURIComponent('data/podcast-asr/'+name),body);
 }
});
await section('今日工作记录',async()=>{await post('/api/private/brief',await readFile(path.join(root,'data/daily-brief.json'),'utf8'));});
if(failures)process.exitCode=1;
