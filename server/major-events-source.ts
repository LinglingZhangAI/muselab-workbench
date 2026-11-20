import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {durableFile} from './supabase.ts';
import {load} from 'cheerio';
import type {MajorEvent,EventsArchive,EventSourceStatus} from '../src/lib/major-events-types.ts';
import {validEventDate} from '../src/lib/major-events-format.ts';

export const eventInterval=15*60*1000;
export const eventSources=[
 {id:'openai',name:'OpenAI',url:'https://openai.com/news/rss.xml',base:'https://openai.com',host:'openai.com',region:'海外',kind:'rss'},
 {id:'anthropic',name:'Anthropic',url:'https://www.anthropic.com/news',base:'https://www.anthropic.com',host:'anthropic.com',region:'海外',kind:'html'},
 {id:'deepmind',name:'Google DeepMind',url:'https://deepmind.google/discover/blog/',base:'https://deepmind.google',host:'google',region:'海外',kind:'html'},
 {id:'qwen',name:'阿里通义',url:'https://qwenlm.github.io/blog/',base:'https://qwenlm.github.io',host:'qwenlm.github.io',region:'国内',kind:'html'},
 {id:'kimi',name:'月之暗面',url:'https://www.kimi.com/blog',base:'https://www.kimi.com',host:'kimi.com',region:'国内',kind:'html'},
 {id:'deepseek',name:'DeepSeek',url:'https://api.github.com/orgs/deepseek-ai/repos?sort=created&per_page=15',base:'https://github.com/deepseek-ai',host:'github.com',region:'国内',kind:'github'},
 {id:'seed',name:'字节 Seed',url:'https://seed.bytedance.com/en/blog',base:'https://seed.bytedance.com',host:'seed.bytedance.com',region:'国内',kind:'html'},
 {id:'microsoft',name:'Microsoft',url:'https://blogs.microsoft.com/feed/',base:'https://blogs.microsoft.com',host:'microsoft.com',region:'海外',kind:'rss'}
] as const;
type Source=(typeof eventSources)[number];
export type Candidate={id:string;title:string;url:string;date:string|null;org:string;region:string;discoveredAt:string;description:string;sourceId:string};
const archiveFile=(root:string)=>path.join(root,'data/major-events.json');
const digest=(v:string)=>createHash('sha256').update(v).digest('hex').slice(0,18);
export function canonicalUrl(value:string){try{const u=new URL(value);u.search='';u.hash='';return u.href.replace(/\/$/,'');}catch{return '';}}
export function allowedSourceUrl(value:string,source:Source){try{const u=new URL(value);if(u.protocol!=='https:')return false;return source.id==='deepmind'?['deepmind.google','blog.google'].includes(u.hostname):u.hostname===source.host||u.hostname.endsWith('.'+source.host);}catch{return false;}}
function parsedDate(raw:string|null|undefined){if(!raw||!(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/).test(raw))return null;const d=new Date(raw);if(!Number.isFinite(d.getTime()))return null;return d.toISOString().slice(0,10);}
const relevant=/\bGPT|ChatGPT|Codex|Sora|Claude|Gemini|Genie|Copilot|Qwen|Kimi|DeepSeek|Doubao|Seedance|Seedream|Hunyuan|UI.TARS|通义|千问|豆包|元宝|混元|智能体|大模型|人工智能|AI\b/i;
export function parseEventCandidates(text:string,source:Source,now=new Date().toISOString()):Candidate[]{
 const result=new Map<string,Candidate>();
 const put=(title:string,url:string,date:string|null,description='')=>{const clean=title.replace(/\s+/g,' ').trim();const link=canonicalUrl(url);if(!link||clean.length<5||clean.length>400||!allowedSourceUrl(link,source)||!relevant.test(clean+' '+description))return;const d=parsedDate(date);if(d&&d>now.slice(0,10))return;result.set(link,{id:digest(link),title:clean,url:link,date:d,org:source.name,region:source.region,sourceId:source.id,discoveredAt:now,description:description.slice(0,3000)});};
 if(source.kind==='github'){
  const data=JSON.parse(text);if(!Array.isArray(data))throw new Error('仓库列表格式异常');
  for(const item of data){if(item&&item.fork===false&&typeof item.name==='string'&&typeof item.html_url==='string')put(item.name+' — 新建官方代码仓库',item.html_url,null,typeof item.description==='string'?item.description:'');}
 }else if(source.kind==='rss'){
  const $=load(text,{xmlMode:true});if(!$('rss,feed').length)throw new Error('没有返回有效订阅源');
  $('item,entry').each((_,node)=>{const item=$(node);put(item.find('title').first().text(),item.find('link').first().text()||item.find('link').first().attr('href')||'',item.find('pubDate,published').first().text(),load(item.find('description,summary').first().text()).text());});
 }else{
  const $=load(text);$('script,style,nav,footer,header').remove();
  $('a[href]').each((_,node)=>{const anchor=$(node);let url:URL;try{url=new URL(anchor.attr('href')||'',source.base);}catch{return;}
   if(!/\/(?:news|blog|claude-|innovation-and-ai)/.test(url.pathname)||/\/(?:tag|tags|category|page)\//.test(url.pathname)||url.pathname.replace(/\/$/,'')==='/blog'||url.pathname.replace(/\/$/,'')==='/news')return;
   const card=anchor.closest('article,li,.card');const container=card.length?card:anchor;
   const rawDate=container.find('time').first().attr('datetime')||container.find('time').first().text();
   const title=anchor.find('h1,h2,h3,h4').first().text()||container.find('h1,h2,h3,h4,h5,h6').first().text()||anchor.attr('aria-label')||anchor.text();put(title,url.href,rawDate||null);
  });
  if(!result.size)throw new Error('页面未返回可核验文章列表；可能需要 JavaScript 或源站结构变化');
 }
 return [...result.values()].slice(0,100);
}
export async function readEventArchive(root:string):Promise<EventsArchive>{
 const raw=JSON.parse(await readFile(archiveFile(root),'utf8')) as EventsArchive;
 if(!Array.isArray(raw.events)||!raw.events.length||!raw.events.every(validEvent))throw new Error('事件资料格式无效');return raw;
}
export function validEvent(e:MajorEvent){return e&&typeof e.id==='string'&&typeof e.date==='string'&&validEventDate(e.date)&&['模型','产品','算力','资本','政策','产业'].includes(e.track)&&['国内','海外'].includes(e.region)&&typeof e.title==='string'&&typeof e.url==='string'&&(e.url.startsWith('https://')||(e.url===''&&e.sourceType==='reference'&&e.referenceUrl?.startsWith('/assets/major-events/')))&&e.image&&typeof e.image.path==='string'&&e.image.path.startsWith('/assets/major-events/');}
export async function writeEventsJson(root:string,file:string,value:unknown){await durableFile(root,file,JSON.stringify(value,null,2)+'\n');}
async function fetchSource(source:Source){
 const response=await fetch(source.url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'Muselab Major Events Reader','Accept':source.kind==='github'?'application/vnd.github+json':'application/rss+xml,application/xml,text/html;q=0.9'}});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const reader=response.body?.getReader();if(!reader)throw new Error('空响应');let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new Error('来源内容过大');chunks.push(value);}}finally{await reader.cancel();}
 return Buffer.concat(chunks).toString('utf8');
}
export async function scanMajorEvents(root:string,fetcher:(source:Source)=>Promise<string>=fetchSource):Promise<EventsArchive>{
 const archive=await readEventArchive(root),now=new Date().toISOString();
 const candidatesFile=path.join(root,'data/major-events-candidates.json');let old:Candidate[]=[];
 try{const j=JSON.parse(await readFile(candidatesFile,'utf8'));if(Array.isArray(j.items))old=j.items;}catch{}
 const known=new Set(archive.events.map(e=>canonicalUrl(e.url)));const found=new Map(old.filter(e=>!known.has(e.url)).map(e=>[e.url,e]));
 const sourceStatus:EventSourceStatus[]=await Promise.all(eventSources.map(async source=>{
  try{const entries=parseEventCandidates(await fetcher(source),source,now);for(const e of entries){if(known.has(e.url))continue;if(e.date&&e.date<archive.checkedAt)continue;found.set(e.url,e);}return {id:source.id,name:source.name,ok:true,checkedAt:now,found:entries.length};}
  catch(error){return {id:source.id,name:source.name,ok:false,checkedAt:now,found:0,error:error instanceof Error?error.message:'检查失败'};}
 }));
 const list=[...found.values()].sort((a,b)=>(b.date||b.discoveredAt).localeCompare(a.date||a.discoveredAt)).slice(0,500);
 await writeEventsJson(root,candidatesFile,{checkedAt:now,items:list});
 const successes=sourceStatus.filter(s=>s.ok).length;
 const result={...archive,lastAttemptAt:now,lastSuccessAt:successes?now:archive.lastSuccessAt,sourceStatus,candidateCount:list.length,intervalMinutes:15};
 await writeEventsJson(root,archiveFile(root),result);return result;
}
