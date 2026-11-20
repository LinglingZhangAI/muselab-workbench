import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {Plugin} from 'vite';
import {readNews,shanghaiDay} from './news-source';
import {collectCodexBrief} from './codex-records';
import {workItemsFromRecords} from '../src/lib/work-task-summary';
export function briefApi(root:string):Plugin{
 let refreshing:ReturnType<typeof collectCodexBrief>|null=null;
 let lastRefresh=0;let lastWarning='';
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const endpoint=req.url?.split('?')[0];
  if(endpoint!=='/api/daily-brief'&&endpoint!=='/api/daily-brief/refresh')return next();
  const reply=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if((endpoint==='/api/daily-brief'&&req.method!=='GET')||(endpoint==='/api/daily-brief/refresh'&&req.method!=='POST'))return reply(405,{error:'请求方式不支持'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)))return reply(403,{error:'请从 Muselab 读取简报'});
  void(async()=>{
   if(endpoint==='/api/daily-brief/refresh'){
    if(!refreshing&&Date.now()-lastRefresh>=10000){
     refreshing=collectCodexBrief(root);
     refreshing.then(result=>{lastRefresh=Date.now();lastWarning=result.warning;},()=>{}).finally(()=>{refreshing=null;});
    }
    if(refreshing)await refreshing;
   }
   const brief=JSON.parse(await readFile(path.join(root,'data/daily-brief.json'),'utf8'));
   const validItem=(item:{title?:unknown;detail?:unknown;threadId?:unknown;threadTitle?:unknown;status?:unknown})=>item&&typeof item.title==='string'&&typeof item.detail==='string'&&typeof item.status==='string'&&typeof item.threadId==='string'&&/^[a-f0-9-]{36}$/.test(item.threadId)&&typeof item.threadTitle==='string';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(brief.date)||!Array.isArray(brief.work)||!Array.isArray(brief.updates)||!brief.work.every(validItem)||!brief.updates.every(validItem)||typeof brief.updatedAt!=='string'||!Number.isFinite(Date.parse(brief.updatedAt))||typeof brief.coverage!=='string')throw new Error();
   const timeline=brief.timeline??[];
   if(!Array.isArray(timeline)||!timeline.every(item=>validItem(item)&&typeof item.id==='string'&&item.status==='已完成'&&typeof item.start==='string'&&typeof item.end==='string'&&Number.isFinite(Date.parse(item.start))&&Number.isFinite(Date.parse(item.end))&&Date.parse(item.end)>=Date.parse(item.start)&&shanghaiDay(new Date(item.start))===brief.date&&shanghaiDay(new Date(item.end))===brief.date))throw new Error();
   const news=await readNews(root);return reply(200,{...brief,work:timeline.length?workItemsFromRecords(timeline):brief.work,timeline,today:shanghaiDay(),stale:brief.date!==shanghaiDay(),newsCount:news?.date===shanghaiDay()?news.items.length:0,...(endpoint==='/api/daily-brief/refresh'?{warning:lastWarning}:{})});
  })().catch(()=>reply(503,{error:endpoint==='/api/daily-brief/refresh'?'未能同步最新 Codex 记录，已保留上次内容，请确认 Codex 可正常打开后重试':'今日简报暂未生成，请稍后刷新'}));
 };
 return {name:'muselab-daily-brief',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
