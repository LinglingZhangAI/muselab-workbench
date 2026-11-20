import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {readNews,refreshNews,shanghaiDay,newsNeedsRefresh,type NewsEdition} from './news-source';

export function newsApi(root:string):Plugin{
 let pending:Promise<NewsEdition>|null=null;let lastAttempt=0;let lastWarning='';
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/daily-news')return next();
  const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取新闻'});
  if((req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)||req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'请从 Muselab 读取新闻'});
  void(async()=>{
   let edition=await readNews(root);const force=url.searchParams.get('refresh')==='1';
   if((force||newsNeedsRefresh(edition))&&Date.now()-lastAttempt>60000&&!pending){lastAttempt=Date.now();pending=refreshNews(root).then(result=>{lastWarning='';return result;},error=>{lastWarning=error instanceof Error?error.message:'新闻更新失败';throw error;}).finally(()=>{pending=null;});}
   if(pending){try{edition=await pending;}catch{/* Keep the last verified edition. */}}
   if(!edition)return reply(503,{error:lastWarning||'暂无新闻，请稍后重试'});
   reply(200,{...edition,stale:edition.date!==shanghaiDay(),warning:lastWarning});
  })().catch(()=>reply(500,{error:'新闻暂时无法读取，请稍后重试'}));
 };
 return {name:'muselab-daily-news',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
