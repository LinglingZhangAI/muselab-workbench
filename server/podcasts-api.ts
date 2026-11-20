import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {readPodcasts,refreshPodcasts} from './podcasts';
import {podcastDay} from '../src/lib/podcasts';
export function podcastsApi(root:string):Plugin{
 let pending:ReturnType<typeof refreshPodcasts>|null=null;let lastAttempt=0;let warning='';
 function refresh(){if(!pending){lastAttempt=Date.now();pending=refreshPodcasts(root).then(edition=>{warning='';return edition;},error=>{warning=error instanceof Error?error.message:'播客更新失败';throw error;}).finally(()=>{pending=null;});}return pending;}
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/daily-podcasts')return next();
  const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取播客'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!['http://'+req.headers.host,'https://'+req.headers.host].includes(req.headers.origin)))return reply(403,{error:'请从 Muselab 读取播客'});
  void(async()=>{
   let edition=await readPodcasts(root);const stale=!edition||edition.date!==podcastDay()||Date.now()-Date.parse(edition.fetchedAt)>30*60000;
   if((stale||url.searchParams.get('refresh')==='1')&&Date.now()-lastAttempt>60000)try{edition=await refresh();}catch{/* Preserve the last useful list. */}
   if(!edition)return reply(503,{error:warning||'暂无播客推荐，请稍后重试'});reply(200,{...edition,today:podcastDay(),stale:edition.date!==podcastDay(),warning});
  })().catch(()=>reply(500,{error:'播客推荐暂时无法读取'}));
 };
 const start=()=>{void refresh().catch(()=>{});const timer=setInterval(()=>void refresh().catch(()=>{}),30*60000);timer.unref();return timer;};
 return {name:'muselab-podcasts',configureServer(server){server.middlewares.use(middleware);const timer=start();server.httpServer?.once('close',()=>clearInterval(timer));},configurePreviewServer(server){server.middlewares.use(middleware);const timer=start();server.httpServer.once('close',()=>clearInterval(timer));}};
}
