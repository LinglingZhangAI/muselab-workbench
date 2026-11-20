import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {readArticles,refreshArticles,type ArticleEdition} from './design-articles';
import {shanghaiDay} from './news-source';
import {articleReader} from './article-content';
export function articlesApi(root:string):Plugin{
 let pending:Promise<ArticleEdition>|null=null;let lastAttempt=0;let lastWarning='';
 const readContent=articleReader(root);
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(!['/api/design-articles','/api/design-article-content'].includes(url.pathname))return next();
  const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取文章'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)))return reply(403,{error:'请从 Muselab 读取文章'});
  if(url.pathname==='/api/design-article-content'){
   void(async()=>{const edition=await readArticles(root);const item=edition?.items.find(item=>item.id===url.searchParams.get('id'));if(!item)return reply(404,{error:'未找到这篇文章，请刷新文章目录'});try{reply(200,await readContent(item.url));}catch(e){reply(502,{error:e instanceof Error?e.message:'正文暂时无法读取'});}})().catch(()=>reply(500,{error:'正文暂时无法读取'}));
   return;
  }
  void(async()=>{
   let edition=await readArticles(root);const fetchedToday=edition&&shanghaiDay(new Date(edition.fetchedAt))===shanghaiDay();
   if((url.searchParams.get('refresh')==='1'||!fetchedToday)&&Date.now()-lastAttempt>60000&&!pending){lastAttempt=Date.now();pending=refreshArticles(root).then(result=>{lastWarning='';return result;},error=>{lastWarning=error instanceof Error?error.message:'文章更新失败，已保留上次内容';throw error;}).finally(()=>{pending=null;});}
   if(pending)try{edition=await pending;}catch{/* Keep the last successful collection. */}
   if(!edition)return reply(503,{error:lastWarning||'暂无文章，请稍后重试'});
   reply(200,{...edition,stale:edition.date!==shanghaiDay(),warning:lastWarning});
  })().catch(()=>reply(500,{error:'文章暂时无法读取'}));
 };
 return {name:'muselab-design-articles',configureServer(s){s.middlewares.use(middleware);},configurePreviewServer(s){s.middlewares.use(middleware);}};
}
