import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {publicResource} from './rewrite-source.ts';
import type {NoteImage} from '../src/lib/note-images';
export function imageExtension(buffer:Buffer){
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'jpg';
 if(/^GIF8[79]a$/.test(buffer.subarray(0,6).toString()))return 'gif';
 if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return 'webp';
 if(buffer.subarray(4,8).toString()==='ftyp'&&/avif|avis/.test(buffer.subarray(8,32).toString()))return 'avif';
 throw new Error('原文配图格式不可用');
}
export async function cacheNoteImages(root:string,images:{url:string;alt:string;caption:string}[]){
 const directory=path.join(root,'public/assets/note-images');await mkdir(directory,{recursive:true});
 const results=await Promise.allSettled(images.slice(0,6).map(async image=>{
  const key=createHash('sha256').update(image.url).digest('hex').slice(0,24);
  for(const ext of ['jpg','png','webp','gif','avif'])try{const data=await readFile(path.join(directory,key+'.'+ext));if(data.length&&imageExtension(data)===ext)return {src:'/assets/note-images/'+key+'.'+ext,originalUrl:image.url,alt:image.alt,caption:image.caption};}catch{/* Fetch once. */}
  const result=await publicResource(image.url,'image');const ext=imageExtension(result.body);const name=key+'.'+ext;const file=path.join(directory,name);const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,result.body);await rename(temporary,file);return {src:'/assets/note-images/'+name,originalUrl:image.url,alt:image.alt,caption:image.caption};
 }));
 return {images:results.filter((item):item is PromiseFulfilledResult<NoteImage>=>item.status==='fulfilled').map(item=>item.value),failed:results.filter(item=>item.status==='rejected').length};
}
