import type {Plugin} from 'vite';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readPodcasts} from './podcasts';
import {publicResource} from './rewrite-source';
import {parsePodcastCues} from '../src/lib/podcast-playback';
import {PodcastTranscriber} from './podcast-transcription';
import {PodcastTranslator} from './podcast-translation';
import {podcastSources} from '../src/lib/podcasts';
export function podcastTranscriptApi(root:string,options:{allowTranscription?:boolean}={}):Plugin{
 const transcriber=new PodcastTranscriber(root);
 const translator=new PodcastTranslator(root);
 const cache=new Map<string,{at:number;cues:ReturnType<typeof parsePodcastCues>}>();
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host}`);if(url.pathname!=='/api/podcast-transcript')return next();
  const reply=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET'&&req.method!=='POST')return reply(405,{error:'仅支持读取或生成字幕'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!['http://'+req.headers.host,'https://'+req.headers.host].includes(req.headers.origin)))return reply(403,{error:'请从 Muselab 读取字幕'});
  void(async()=>{
   const edition=await readPodcasts(root);const episode=edition?.episodes.find(item=>item.id===url.searchParams.get('id'));
   if(!episode)return reply(404,{error:'未找到这期节目'});
   if(!/^[a-f0-9]{24}$/.test(episode.id))return reply(400,{error:'节目编号无效'});
   const send=async(state:{cues:ReturnType<typeof parsePodcastCues>;status:string;[key:string]:unknown})=>{
    if(state.status==='complete'&&state.cues.length&&podcastSources.find(source=>source.id===episode.sourceId)?.language==='en'){
     const canGenerate=options.allowTranscription!==false&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
     const start=canGenerate&&(req.method==='POST'||!(await translator.read(episode.id,state.cues)));
     return reply(200,{...state,...await translator.attach(episode.id,state.cues,start)});
    }
    return reply(200,state);
   };
   const local=async()=>{const existing=await transcriber.read(episode);if(existing?.status==='complete')return existing;if(options.allowTranscription===false)return existing||{cues:[],status:'error',available:false,error:'这期字幕尚未从本机同步，请在本机生成后同步到云端。'};const latest=!edition!.episodes.some(item=>item.sourceId===episode.sourceId&&item.publishedAt>episode.publishedAt);return req.method==='POST'?await transcriber.request(episode,latest):existing;};
   if(!episode.transcriptUrl){const state=await local();return send(state||{cues:[],status:'idle',available:false});}
   const stored=cache.get(episode.id);if(stored&&Date.now()-stored.at<3600000)return send({cues:stored.cues,status:'complete',source:'publisher',available:true});
   try{const resource=await publicResource(episode.transcriptUrl,'transcript');const cues=parsePodcastCues(resource.body.toString('utf8'));cache.set(episode.id,{at:Date.now(),cues});await send({cues,status:'complete',source:'publisher',available:true});}
   catch{const state=await local();await send(state||{cues:[],status:'idle',available:false});}
  })().catch(error=>reply(502,{error:error instanceof Error?error.message:'本期字幕暂时无法读取'}));
 };
 return {name:'muselab-podcast-transcript',configureServer(server){server.middlewares.use(middleware);server.httpServer?.once('close',()=>transcriber.close());},configurePreviewServer(server){server.middlewares.use(middleware);server.httpServer.once('close',()=>transcriber.close());}};
}
