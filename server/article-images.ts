import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {imageExtension} from './note-images.ts';
import {durableFile} from './supabase';

export async function cacheArticleImage(root:string,source:string){
 const url=new URL(source);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['image.uisdc.com','www.uisdc.com'].includes(url.hostname))throw new Error('不支持的文章配图来源');
 const directory=path.join(root,'public/article-covers');
 const key=createHash('sha256').update(url.href).digest('hex').slice(0,24);
 for(const ext of ['jpg','png','webp','gif','avif'])try{
  const bytes=await readFile(path.join(directory,key+'.'+ext));
  if(bytes.length&&imageExtension(bytes)===ext)return '/article-covers/'+key+'.'+ext;
 }catch{/* Download missing or invalid cached images. */}
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'}});
 if(!response.ok||!/^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(response.headers.get('content-type')||'')){
  await response.body?.cancel();throw new Error('文章配图暂时无法读取');
 }
 const reader=response.body?.getReader();if(!reader)throw new Error('文章配图为空');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024)throw new Error('文章配图过大');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);const ext=imageExtension(bytes);const name=key+'.'+ext;
 await mkdir(directory,{recursive:true});const file=path.join(directory,name);const temporary=file+'.'+randomUUID()+'.tmp';
 await durableFile(root,file,bytes);return '/article-covers/'+name;
}
