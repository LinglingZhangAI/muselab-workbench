import type {Plugin} from 'vite';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readEventArchive,scanMajorEvents,eventInterval} from './major-events-source.ts';
import type {EventsArchive} from '../src/lib/major-events-types.ts';

export function majorEventsApi(root:string):Plugin{
 let pending:Promise<EventsArchive>|null=null,lastAttempt=0,scanError='';
 const scan=()=>{if(pending||Date.now()-lastAttempt<60000)return;lastAttempt=Date.now();pending=scanMajorEvents(root).then(value=>{scanError='';return value;},error=>{scanError='来源检测未完成，已有资料保留，请重试。';throw error;}).finally(()=>{pending=null;});void pending.catch(()=>{});};
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/major-events')return next();
  const reply=(status:number,value:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取事件'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)))return reply(403,{error:'请从工作台查看事件'});
  void readEventArchive(root).then(archive=>{if(url.searchParams.has('refresh')||!archive.lastAttemptAt||Date.now()-Date.parse(archive.lastAttemptAt)>eventInterval)scan();reply(200,{...archive,warning:scanError||undefined,running:!!pending,intervalMinutes:15});},()=>reply(503,{error:'重大事件暂时无法读取，已有资料会保留，请稍后重试。'}));
 };
 const start=()=>{const first=setTimeout(scan,3000);first.unref();const timer=setInterval(scan,eventInterval);timer.unref();return()=>{clearTimeout(first);clearInterval(timer);};};
 return {name:'muselab-major-events',configureServer(server){server.middlewares.use(middleware);const stop=start();server.httpServer?.once('close',stop);},configurePreviewServer(server){server.middlewares.use(middleware);const stop=start();server.httpServer?.once('close',stop);}};
}
