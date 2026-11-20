import {load} from 'cheerio';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {durableFile} from './supabase.ts';
import path from 'node:path';
import {podcastSources,podcastDay,type PodcastEpisode,type PodcastSource,type PodcastEdition} from '../src/lib/podcasts.ts';

function https(value:string){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return '';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);return url.href;}catch{return '';}}
function plain(value:string){const $=load(value);$('script,style').remove();$('br').replaceWith('\n');$('p,div,li,h1,h2,h3,h4').each((_,element)=>{$(element).append('\n\n');});return $.text().replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
export function parsePodcastFeed(xml:string,source:PodcastSource,now=new Date()):PodcastEpisode[]{
 const $=load(xml,{xmlMode:true});const actual=$('channel>title').first().text().replace(/\s+/g,'').toLowerCase();
 if(!actual||actual!==(source.feedTitle||source.name).replace(/\s+/g,'').toLowerCase())throw new Error('订阅源节目名称未匹配');
 const episodes:PodcastEpisode[]=[];
 $('channel>item').slice(0,30).each((_,element)=>{
  const item=$(element);const title=plain(item.children('title').text());const date=Date.parse(item.children('pubDate').text());const url=https(item.children('link').text())||https(item.children('guid').attr('isPermaLink')!=='false'?item.children('guid').text():'')||https(item.children('enclosure[type^="audio/"]').attr('url')||'');
  if(!title||!url||!Number.isFinite(date)||date>now.getTime())return;
  const seconds=item.find('itunes\\:duration').text().trim();const duration=/^\d{1,3}(?::\d{2}){1,2}$/.test(seconds)?seconds:/^\d+$/.test(seconds)?Math.ceil(Number(seconds)/60)+' 分钟':'';
  const description=plain(item.find('content\\:encoded').text()||item.children('description').text()).slice(0,30000);
  const audio=https(item.children('enclosure[type^="audio/"]').attr('url')||item.children('enclosure').attr('url')||'');
  const cover=https(item.children('itunes\\:image').attr('href')||$('channel').children('itunes\\:image').attr('href')||$('channel>image>url').text());
  const transcriptUrl=https(item.children('podcast\\:transcript').filter((_,el)=>/^(text\/vtt|application\/x-subrip)$/i.test($(el).attr('type')||'')).first().attr('url')||'');
  episodes.push({id:createHash('sha256').update(source.id+'|'+url).digest('hex').slice(0,24),sourceId:source.id,show:source.name,title,url,publishedAt:new Date(date).toISOString(),duration,description,audio,cover,transcriptUrl,reason:source.need+'，从这期的具体讨论开始。'});
 });
 if(!episodes.length)throw new Error('订阅源暂无可确认的节目');return [...new Map(episodes.map(item=>[item.id,item])).values()];
}
export function parsePodcastPage(html:string,source:PodcastSource,now=new Date()):PodcastEpisode[]{
 const $=load(html);const podcast=JSON.parse($('#__NEXT_DATA__').text()).props?.pageProps?.podcast;
 if(!podcast||source.url!=='https://www.xiaoyuzhoufm.com/podcast/'+podcast.pid||podcast.title.replace(/\s+/g,'').toLowerCase()!==source.name.replace(/\s+/g,'').toLowerCase())throw new Error('节目页面未匹配');
 const episodes:PodcastEpisode[]=[];
 for(const item of podcast.episodes||[]){
  const date=Date.parse(item.pubDate);if(item.pid!==podcast.pid||item.status!=='NORMAL'||!Number.isFinite(date)||date>now.getTime()||typeof item.title!=='string'||!/^[a-f0-9]{24}$/.test(item.eid))continue;
  const url='https://www.xiaoyuzhoufm.com/episode/'+item.eid;
  episodes.push({id:createHash('sha256').update(source.id+'|'+url).digest('hex').slice(0,24),sourceId:source.id,show:source.name,title:item.title,url,publishedAt:new Date(date).toISOString(),duration:Number.isFinite(item.duration)?Math.ceil(item.duration/60)+' 分钟':'',description:plain(item.description||'').slice(0,30000),audio:item.isPrivateMedia||item.payType!=='FREE'?'':https(item.enclosure?.url||''),cover:https(item.image?.picUrl||podcast.image?.picUrl||''),reason:source.need+'，从这期的具体讨论开始。'});
 }
 if(!episodes.length)throw new Error('节目页面暂无可确认的节目');return episodes;
}
async function fetchFeed(source:PodcastSource){
 const signal=AbortSignal.timeout(18000);let url=new URL(source.feed);
 const hosts=new Set(['feed.xyzfm.space','justinyan.me','www.justinyan.me','rss.buzzsprout.com','feeds.buzzsprout.com','www.xiaoyuzhoufm.com','feeds.fireside.fm','api.substack.com','podcast.latent.space','feeds.megaphone.fm']);
 for(let redirect=0;redirect<4;redirect++){
  if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.username||url.password)throw new Error('订阅源跳转未匹配');
  const response=await fetch(url,{redirect:'manual',signal,headers:{Accept:'application/rss+xml, application/xml, text/xml','User-Agent':'Muselab Podcast Reader'}});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('订阅源跳转失败');url=new URL(location,url);continue;}
  if(!response.ok)throw new Error('订阅源暂时不可用');const reader=response.body?.getReader();if(!reader)throw new Error('订阅源为空');const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024)throw new Error('订阅源过大');chunks.push(value);}}finally{await reader.cancel();}
  const text=Buffer.concat(chunks).toString('utf8');return source.id==='z-prompt'?parsePodcastPage(text,source):parsePodcastFeed(text,source);
 }
 throw new Error('订阅源跳转过多');
}
export async function readPodcasts(root:string):Promise<PodcastEdition|null>{
 try{const data=JSON.parse(await readFile(path.join(root,'data/daily-podcasts.json'),'utf8'));if(!data||!Array.isArray(data.episodes)||!Array.isArray(data.sources)||!Array.isArray(data.warnings)||!Number.isFinite(Date.parse(data.fetchedAt))||!/^\d{4}-\d{2}-\d{2}$/.test(data.date))return null;
  if(!data.episodes.every((item:PodcastEpisode)=>podcastSources.some(source=>source.id===item.sourceId)&&typeof item.title==='string'&&typeof item.description==='string'&&Number.isFinite(Date.parse(item.publishedAt))&&https(item.url)&&(!item.audio||https(item.audio))))return null;return data;
 }catch{return null;}
}
export async function refreshPodcasts(root:string){
 const previous=await readPodcasts(root);const now=new Date();const results=await Promise.allSettled(podcastSources.map(source=>source.feed?fetchFeed(source):Promise.resolve([])));
 const edition:PodcastEdition={date:podcastDay(now),fetchedAt:now.toISOString(),episodes:[],sources:[],warnings:[]};
 results.forEach((result,index)=>{
  const source=podcastSources[index];
  if(!source.feed){edition.sources.push({...source,status:'unconfigured'});return;}
  if(result.status==='fulfilled'){edition.episodes.push(...result.value);edition.sources.push({...source,status:'updated'});}
  else{const old=previous?.episodes.filter(item=>item.sourceId===source.id)||[];edition.episodes.push(...old);edition.sources.push({...source,status:old.length?'cached':'unavailable'});edition.warnings.push(source.name+'暂未刷新'+(old.length?'，保留上次节目':''));}
 });
 if(!edition.episodes.length)throw new Error('播客订阅源暂时无法读取，请稍后重试');
 edition.episodes.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 const file=path.join(root,'data/daily-podcasts.json');await durableFile(root,file,JSON.stringify(edition)+'\n');return edition;
}
