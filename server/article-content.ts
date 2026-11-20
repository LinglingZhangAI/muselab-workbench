import {load} from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import type {ArticleContent} from '../src/lib/article-content';
import {cacheArticleImage} from './article-images.ts';
import {durableFile} from './supabase';

function webUrl(value:string,base:string){try{const url=new URL(value,base);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function sourceUrl(value:string){const url=new URL(value);if(url.origin!=='https://www.uisdc.com'||url.username||url.password)throw new Error('仅支持优设文章');return url.href;}
export function extractArticle(html:string,url:string):ArticleContent{
 sourceUrl(url);const $=load(html);const content=$('<div></div>');const article=$('.post-article .article').first();
 if(article.length)content.append(article.contents().clone());
 else if($('.hunter-singular-main .info-content').length)content.append($('.hunter-singular-main .main-image img').first().clone(),$('.hunter-singular-main .info-content').first().clone());
 else if($('.group-singular-images img').length)content.append($('.group-singular-images img').clone());
 else throw new Error('暂未读取到文章正文，可稍后重试或查看原文');
 content.find('script,style,iframe,object,embed,form,input,button,svg,.tuwen_link,.article-bt,.article-author,.post-btns,.use-vue,.adsbygoogle').remove();
 content.find('img').each((_,element)=>{const image=$(element);const src=webUrl(image.attr('data-src')||image.attr('data-original')||image.attr('src')||'',url);if(!src){image.remove();return;}image.attr('src',src);});
 content.find('a').each((_,element)=>{const link=$(element);const href=webUrl(link.attr('href')||'',url);if(href)link.attr('href',href);else link.removeAttr('href');});
 const cleaned=sanitizeHtml(content.html()||'',{
  allowedTags:['p','br','h2','h3','h4','h5','h6','strong','b','em','i','u','s','del','span','div','a','img','figure','figcaption','blockquote','ul','ol','li','pre','code','hr','table','thead','tbody','tr','th','td','sup','sub'],
  allowedAttributes:{a:['href','target','rel'],img:['src','alt','loading','decoding','referrerpolicy'],ol:['start'],th:['colspan','rowspan'],td:['colspan','rowspan']},allowedSchemes:['https'],allowProtocolRelative:false,
  transformTags:{a:(_,attributes)=>({tagName:'a',attribs:{...attributes,target:'_blank',rel:'noopener noreferrer'}}),img:(_,attributes)=>({tagName:'img',attribs:{src:attributes.src||'',alt:attributes.alt||'',loading:'lazy',decoding:'async',referrerpolicy:'no-referrer'}})},
 });
 const visible=load(cleaned);const imageCount=visible('img').length;
 if(visible.text().trim().length<80&&!imageCount)throw new Error('文章正文暂不可读取，请查看原文');
 const title=$('meta[property="og:title"]').attr('content')||$('title').text().replace(/ - 优设网.*$/,'');
 return {url,title,publishedAt:$('meta[property="og:article:published_time"]').attr('content')||'',fetchedAt:new Date().toISOString(),html:cleaned,imageCount};
}
export async function fetchArticle(url:string){
 let target=sourceUrl(url);const signal=AbortSignal.timeout(25000);let response:Response|undefined;
 for(let i=0;i<4;i++){
  response=await fetch(target,{signal,redirect:'manual',headers:{Accept:'text/html','User-Agent':'Muselab Article Reader'}});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('文章地址暂时不可用');target=sourceUrl(new URL(location,target).href);continue;}
  break;
 }
 if(!response?.ok)throw new Error('原站暂时无法读取，请稍后重试');
 const reader=response.body?.getReader();if(!reader)throw new Error('原站返回空内容');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw new Error('文章内容过大，请查看原文');chunks.push(value);}}finally{await reader.cancel();}
 return extractArticle(Buffer.concat(chunks).toString('utf8'),url);
}
export async function cacheArticleBody(root:string,content:ArticleContent):Promise<ArticleContent>{
 const $=load(content.html,null,false);const sources=[...new Set($('img').map((_,image)=>$(image).attr('src')||'').get().filter(source=>source.startsWith('https:')))];
 const cached=new Map<string,string>();let next=0;
 // Long illustrated articles can contain dozens of images. Limit simultaneous downloads.
 await Promise.all(Array.from({length:Math.min(4,sources.length)},async()=>{
  while(next<sources.length){const source=sources[next++];try{cached.set(source,await cacheArticleImage(root,source));}catch{/* Preserve the source if its image cannot be cached. */}}
 }));
 if(!cached.size)return content;
 $('img').each((_,image)=>{const local=cached.get($(image).attr('src')||'');if(local)$(image).attr('src',local);});
 return {...content,html:$.html()};
}
export function articleReader(root:string){
 const pending=new Map<string,Promise<ArticleContent>>();
 return async(url:string)=>{
  sourceUrl(url);const key=createHash('sha256').update(url).digest('hex');const directory=path.join(root,'data/article-content');const file=path.join(directory,key+'.json');let cache:ArticleContent|null=null;
  try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.url===url&&typeof saved.html==='string'&&typeof saved.title==='string'&&Number.isFinite(Date.parse(saved.fetchedAt)))cache=saved;}catch{/* No saved article yet. */}
  if(!pending.has(url))pending.set(url,(async()=>{
   try{const original=cache&&Date.now()-Date.parse(cache.fetchedAt)<24*60*60*1000?cache:await fetchArticle(url);const result=await cacheArticleBody(root,original);if(result!==cache)await durableFile(root,file,JSON.stringify(result)+'\n');return result;}
   catch(error){if(cache)return {...cache,stale:true,warning:'原文更新失败，显示上次保存的正文'};throw error;}
   finally{pending.delete(url);}
  })());
  return pending.get(url)!;
 };
}
