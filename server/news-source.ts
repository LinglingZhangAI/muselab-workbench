import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {durableFile} from './supabase.ts';

export const newsSource='https://www.uisdc.com/news';
export type NewsItem={id:string;title:string;content:string;tag:string;url:string;images?:string[]};
export type NewsEdition={date:string;fetchedAt:string;source:string;items:NewsItem[]};
export function shanghaiDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function newsNeedsRefresh(edition:NewsEdition|null,now=new Date()){
 const today=shanghaiDay(now);
 return !edition||edition.date!==today||!Number.isFinite(Date.parse(edition.fetchedAt))||shanghaiDay(new Date(edition.fetchedAt))!==today||edition.items.some(item=>item.images?.some(image=>image.startsWith('https:')));
}
function plain(value:string){return value.replace(/\[\[[^\]]*\]\]/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function safeUrl(value:unknown){try{if(typeof value!=='string'||!value.trim())return newsSource;const url=new URL(value,newsSource);return url.protocol==='https:'&&!url.username&&!url.password?url.href:newsSource;}catch{return newsSource;}}
function newsImages(value:unknown){
 if(typeof value!=='string')return [];
 const images:string[]=[];
 for(const part of value.split('|')){
  try{const url=new URL(part.trim());if(url.protocol==='https:'&&url.hostname==='image.uisdc.com'&&!url.port&&!url.username&&!url.password&&/\.(?:webp|png|jpe?g|gif|avif)$/i.test(url.pathname)&&!images.includes(url.href))images.push(url.href);}catch{/* Ignore empty slots and invalid image URLs. */}
 }
 return images;
}
export function parseNews(html:string,now=new Date()):NewsEdition{
 // The site embeds JSON inside a JavaScript string, which can also escape apostrophes.
 // Consume escape pairs so escaped backslashes remain intact. Never evaluate source code.
 const match=html.match(/\bvar\s+uisdc_news\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
 if(!match)throw new Error('优设新闻数据结构已变化，请稍后重试');
 const jsonString=match[1].replace(/\\[\s\S]/g,escape=>escape==="\\'"?"'":escape);
 const editions:unknown=JSON.parse(JSON.parse(jsonString));
 if(!Array.isArray(editions))throw new Error('优设新闻数据无效');
 const parsed:NewsEdition[]=[];
 for(const edition of editions){
  if(!edition||edition.status!=='publish'||!Array.isArray(edition.dubao))continue;
  const imageDates=edition.dubao.flatMap((item:{images?:unknown})=>typeof item?.images==='string'?[...item.images.matchAll(/\/db-(\d{4})(\d{2})(\d{2})-/g)].map(m=>`${m[1]}-${m[2]}-${m[3]}`):[]);
  const uniqueDates=[...new Set<string>(imageDates)];
  // A zero timestamp occurs in today's edition. Its dated artwork is explicit evidence.
  const date=typeof edition.time==='number'&&edition.time>0?shanghaiDay(new Date(edition.time*1000)):uniqueDates.length===1?uniqueDates[0]:'';
  if(!date||date>shanghaiDay(now))continue;
  const seen=new Set<string>();const items:NewsItem[]=[];
  for(const item of edition.dubao){
   if(!item||typeof item.title!=='string'||typeof item.content!=='string')continue;
   const title=plain(item.title).slice(0,240);if(!title||seen.has(title))continue;seen.add(title);
   items.push({id:`${edition.id}-${items.length+1}`,title,content:plain(item.content).slice(0,12000),tag:typeof item.tag==='string'?plain(item.tag).slice(0,40):'',url:safeUrl(item.url),images:newsImages(item.images)});
  }
  if(items.length)parsed.push({date,fetchedAt:now.toISOString(),source:newsSource,items});
 }
 parsed.sort((a,b)=>b.date.localeCompare(a.date));
 if(!parsed.length)throw new Error('暂未读取到可确认日期的新闻');
 return parsed[0];
}
export function newsFile(root:string){return path.join(root,'data/daily-news.json');}
export async function readNews(root:string):Promise<NewsEdition|null>{
 try{const data=JSON.parse(await readFile(newsFile(root),'utf8'));if(!data||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||data.source!==newsSource||!Array.isArray(data.items)||!data.items.length||!data.items.every((item:NewsItem)=>typeof item.title==='string'&&typeof item.content==='string'&&typeof item.tag==='string'&&typeof item.id==='string'&&typeof item.url==='string'))return null;return data;}catch{return null;}
}
export async function saveNews(root:string,edition:NewsEdition){await durableFile(root,newsFile(root),JSON.stringify(edition,null,2)+'\n');}
async function cacheNewsImages(root:string,edition:NewsEdition){
 const directory=path.join(root,'public/assets/news');
 await mkdir(directory,{recursive:true});
 await Promise.all(edition.items.map(async item=>{
  item.images=await Promise.all((item.images||[]).map(async source=>{
   const key=createHash('sha256').update(source).digest('hex').slice(0,24);
   const filename=key+path.extname(new URL(source).pathname).toLowerCase();
   const file=path.join(directory,filename);const local='/assets/news/'+filename;
   try{
    try{if((await readFile(file)).length)return local;}catch{/* Fetch missing image. */}
    const response=await fetch(source,{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('配图不可读取');
    const reader=response.body?.getReader();if(!reader)throw new Error('配图为空');
    let size=0;const chunks:Uint8Array[]=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024)throw new Error('配图过大');chunks.push(value);}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    const valid=bytes.length>12&&(bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.subarray(0,6).toString().match(/^GIF8[79]a$/)||(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')||bytes.subarray(4,12).toString()==='ftypavif');
    if(!valid)throw new Error('配图格式无效');
    await durableFile(root,file,bytes);return local;
   }catch{console.warn('新闻配图缓存失败，将在后续同步重试');return source;}
  }));
 }));
}
export async function refreshNews(root:string){
 const response=await fetch(newsSource,{signal:AbortSignal.timeout(25000),headers:{Accept:'text/html','User-Agent':'Muselab Daily News Reader'}});
 if(!response.ok)throw new Error('优设暂时无法访问（'+response.status+'）');
 const chunks:Uint8Array[]=[];let size=0;const reader=response.body?.getReader();if(!reader)throw new Error('优设返回空内容');
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw new Error('新闻页面内容过大');chunks.push(value);}}finally{await reader.cancel();}
 const edition=parseNews(Buffer.concat(chunks).toString('utf8'));const previous=await readNews(root);
 if(previous&&previous.date>edition.date)throw new Error('来源返回旧版内容，已保留最近一期');
 await cacheNewsImages(root,edition);await saveNews(root,edition);return edition;
}
