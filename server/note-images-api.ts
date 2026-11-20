import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {fetchRewriteSource,rewriteUrl} from './rewrite-source';
import {cacheNoteImages} from './note-images';
import {readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {imageMarkdown} from '../src/lib/note-images';
import {readPodcasts} from './podcasts';
import {podcastCoverImages} from './podcast-article';
export function noteImagesApi(root:string):Plugin{
 let busy=false;
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/note-images')return next();
  const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='POST')return reply(405,{error:'请提交文章链接'});
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||req.headers.origin!==url.origin||req.headers['sec-fetch-site']==='cross-site'||!req.headers['content-type']?.startsWith('application/json'))return reply(403,{error:'请从本机 Muselab 插入原文配图'});
  void(async()=>{
   let body='';for await(const chunk of req){body+=chunk;if(body.length>5000)return reply(413,{error:'链接过长'});}
   let input;try{input=JSON.parse(body);rewriteUrl(input.url);}catch{return reply(400,{error:'请提供公开文章链接'});}
   if(busy)return reply(409,{error:'正在读取另一篇文章配图，请稍候'});busy=true;
   try{
    const episode=(await readPodcasts(root))?.episodes.find(item=>input.episodeId?item.id===input.episodeId:item.url===input.url);
    if(input.episodeId&&(typeof input.episodeId!=='string'||!/^[a-f0-9]{24}$/.test(input.episodeId)||!episode||episode.url!==input.url))return reply(400,{error:'未找到对应播客'});
    const source=episode?{url:episode.url,images:podcastCoverImages(episode)}:await fetchRewriteSource(input.url);const result=await cacheNoteImages(root,source.images);
    if(result.images.length){
     const folder=path.join(root,'data/note-rewrites');
     for(const name of await readdir(folder).catch(()=>[])){
      if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
      const file=path.join(folder,name);let job;try{job=JSON.parse(await readFile(file,'utf8'));}catch{continue;}
      if(job.status!=='completed'||job.url!==source.url||typeof job.body!=='string'||typeof job.title!=='string')continue;
      job.images=result.images;const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(job)+'\n',{mode:0o600});await rename(temp,file);
      const markdown=`# ${job.title}\n\n${result.images.map(image=>imageMarkdown(image)).join('\n\n')}\n\n${job.body}\n\n[原文来源](${source.url})\n`;const md=file.replace(/\.json$/,'.md');await writeFile(md+'.tmp',markdown,{mode:0o600});await rename(md+'.tmp',md);
     }
    }
    reply(200,{...result,message:result.images.length?'已插入 '+result.images.length+' 张原文配图':result.failed?'原文配图暂时无法下载，请稍后重试':'原文未找到可用配图'});
   }finally{busy=false;}
  })().catch(error=>reply(502,{error:error instanceof Error?error.message:'原文配图暂时无法读取'}));
 };
 return {name:'muselab-note-images',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
