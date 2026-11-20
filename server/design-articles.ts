import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {durableFile} from './supabase.ts';
import path from 'node:path';
import {shanghaiDay} from './news-source.ts';
import {cacheArticleImage} from './article-images.ts';

export const articleSource='https://www.uisdc.com/';
export type DesignArticle={id:string;title:string;description:string;image:string;author:string;tag:string;url:string};
export type ArticleEdition={date:string;fetchedAt:string;source:string;items:DesignArticle[]};
function text(value:string){return value.replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const point=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return point>0&&point<=0x10ffff?String.fromCodePoint(point):'';}).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
function safeUrl(value:string,image=false){try{const url=new URL(text(value),articleSource);return url.protocol==='https:'&&!url.username&&!url.password&&(image?['image.uisdc.com','www.uisdc.com'].includes(url.hostname):url.hostname==='www.uisdc.com')?url.href:'';}catch{return '';}}
export function parseArticles(html:string,now=new Date()):ArticleEdition{
 const area=html.split('id="home_list_normal"')[1];
 if(!area)throw new Error('优设首页暂不可读取，已保留上次文章');
 const items:DesignArticle[]=[];const seen=new Set<string>();
 for(const block of area.split(/<div class="[^"]*\bitem-article\b[^"]*">/).slice(1)){
  const heading=block.match(/<h2 class="item-title">([\s\S]*?)<\/h2>/)?.[1]||'';
  const url=safeUrl(heading.match(/href="([^"]+)"/)?.[1]||'');const title=text(heading);
  if(!url||!title||seen.has(url))continue;
  seen.add(url);
  let author='';const encoded=block.match(/class="meta-name"[^>]*data-val="([^"]+)"/)?.[1];
  if(encoded)try{author=text(decodeURIComponent(encoded.replace(/\+/g,' ')).match(/class="uname"[^>]*>([\s\S]*?)<\/i>/)?.[1]||'');}catch{/* The author is optional. */}
  if(!author)author=text(block.match(/class="uname"[^>]*>([\s\S]*?)<\/i>/)?.[1]||'');
  const cover=block.match(/<a class="item-thumb[^>]*>([\s\S]*?)<\/a>/)?.[1]||'';
  items.push({id:new URL(url).pathname,title,description:text(block.match(/class="desc-wrap"[^>]*>([\s\S]*?)<\/a>/)?.[1]||'').slice(0,500),image:safeUrl(cover.match(/<img[^>]*src="([^"]+)"/)?.[1]||cover.match(/background-image:url\(([^)]+)\)/)?.[1]||'',true),author,tag:text(block.match(/class="meta-tag[^"]*">([\s\S]*?)<\/div>/)?.[1]||'').slice(0,30),url});
  if(items.length>=9)break;
 }
 if(!items.length)throw new Error('优设文章结构已变化，已保留上次内容');
 return {date:shanghaiDay(now),fetchedAt:now.toISOString(),source:articleSource,items};
}
function valid(data:ArticleEdition){return data&&/^\d{4}-\d{2}-\d{2}$/.test(data.date)&&Number.isFinite(Date.parse(data.fetchedAt))&&data.source===articleSource&&Array.isArray(data.items)&&data.items.length>0&&data.items.every(item=>item&&['id','title','description','image','author','tag','url'].every(key=>typeof item[key as keyof DesignArticle]==='string')&&safeUrl(item.url)&&(!item.image||safeUrl(item.image,true)||/^\/article-covers\/[\w.-]+$/.test(item.image)));}
export async function readArticles(root:string):Promise<ArticleEdition|null>{try{const data=JSON.parse(await readFile(path.join(root,'data/design-articles.json'),'utf8'));return valid(data)?data:null;}catch{return null;}}
export async function saveArticles(root:string,edition:ArticleEdition){if(!valid(edition))throw new Error('文章数据无效');await durableFile(root,path.join(root,'data/design-articles.json'),JSON.stringify(edition,null,2)+'\n');}
export async function cacheArticleCovers(root:string,edition:ArticleEdition):Promise<ArticleEdition>{
 const items=await Promise.all(edition.items.map(async item=>{
  if(!item.image.startsWith('https:'))return item;
  try{return {...item,image:await cacheArticleImage(root,item.image)};}
  catch{console.warn('文章封面缓存失败，已保留来源图片');return item;}
 }));
 return {...edition,items};
}
export async function refreshArticles(root:string){
 const response=await fetch(articleSource,{signal:AbortSignal.timeout(20000),headers:{Accept:'text/html','User-Agent':'Muselab Design Reader'}});
 if(!response.ok)throw new Error('优设首页暂时无法访问，已保留上次文章');
 const reader=response.body?.getReader();if(!reader)throw new Error('优设返回空内容');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw new Error('优设页面内容过大');chunks.push(value);}}finally{await reader.cancel();}
 const edition=await cacheArticleCovers(root,parseArticles(Buffer.concat(chunks).toString('utf8')));await saveArticles(root,edition);return edition;
}
