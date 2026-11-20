import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SupabaseStore,mediaKey} from '../server/supabase.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const apply=process.argv.includes('--apply');
if(process.argv.includes('--check')){await new SupabaseStore().check();console.log('Supabase 数据表和私有图片桶检查通过');process.exit(0);}
const files=[];
for(const directory of ['assets/pinterest','assets/uploads','assets/news','assets/note-images','assets/research','article-covers']){
 for(const entry of await readdir(path.join(root,'public',directory),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
  const key=directory+'/'+entry.name;if(!entry.isFile()||!mediaKey(key))continue;
  const file=path.join(root,'public',key);const size=(await stat(file)).size;if(!size||size>5*1024*1024)throw new Error('图片大小无效：'+key);
  files.push({key,file,size});
 }
}
const documents=[];
for(const name of ['pinterest-library.json','daily-news.json','design-articles.json','daily-podcasts.json','daily-brief.json']){
 try{documents.push({key:'data/'+name,value:JSON.parse(await readFile(path.join(root,'data',name),'utf8'))});}catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const entry of await readdir(path.join(root,'data/podcast-asr'),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
 if(!entry.isFile()||! /^[a-f0-9]{24}\.json$/.test(entry.name))continue;
 const value=JSON.parse(await readFile(path.join(root,'data/podcast-asr',entry.name),'utf8'));
 if(value.status==='complete'&&Array.isArray(value.cues)&&value.cues.length)documents.push({key:'data/podcast-asr/'+entry.name,value});
}
let legacyState={};try{legacyState=JSON.parse(await readFile(path.join(root,'data/user-state.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
console.log(JSON.stringify({mode:apply?'apply':'dry-run',images:files.length,imageBytes:files.reduce((n,f)=>n+f.size,0),documents:documents.map(d=>d.key),legacyStateKeys:Object.keys(legacyState),browserNotes:'笔记和白板若只存在浏览器中，需要另行导出迁移；本脚本不会读取浏览器凭据。'},null,2));
if(!apply)process.exit(0);
const store=new SupabaseStore();await store.check();
// Images first; a failed image must not result in publishing broken document links.
let images=0;
for(const file of files){const data=await readFile(file.file);await store.putMedia(file.key,data);const saved=await store.media(file.key);if(!saved||!saved.bytes.equals(data))throw new Error('云端图片校验失败：'+file.key);images++;if(images%25===0)console.log('已校验图片 '+images+'/'+files.length);}
for(const {key,value} of documents)await store.putDocument(key,value,true);
for(const [key,entry] of Object.entries(legacyState)){
 if(typeof entry.value!=='string')throw new Error('旧版状态格式异常');
 const result=await store.putState(key,entry.value,'');if(!result.saved)console.log('保留云端已存在的状态：'+key);
}
const stored=new Map((await store.documents()).map(d=>[d.key,d.value]));
for(const {key} of documents)if(!stored.has(key))throw new Error('云端资料校验失败：'+key);
console.log(JSON.stringify({verifiedImages:images,verifiedDocumentKeys:documents.length,preservedExistingCloudDocuments:true}));
