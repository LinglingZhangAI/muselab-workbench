import {createServer} from 'node:http';
import {mkdir,copyFile,access,readFile} from 'node:fs/promises';
import path from 'node:path';
import connect from 'connect';
import sirv from 'sirv';
import type {Plugin,PreviewServer} from 'vite';
import {cloudAuth} from './cloud-auth';
import {cloudBrief,privateSync} from './cloud-private';
import {cloudState} from './cloud-state';
import {promptApi} from './prompt-api';
import {pinterestApi} from './pinterest-api';
import {imageImportApi} from './image-import-api';
import {newsApi} from './news-api';
import {weatherApi} from './weather-api';
import {articlesApi} from './articles-api';
import {refreshNews,shanghaiDay} from './news-source';
import {refreshArticles} from './design-articles';
import {initializeSupabase,storeFor,mediaKey} from './supabase';
import {podcastsApi} from './podcasts-api';
import {podcastTranscriptApi} from './podcast-transcript-api';
import {buildersApi} from './builders-api';
import {majorEventsApi} from './major-events-api';

const appRoot=process.cwd();const root=path.resolve(process.env.MUSELAB_DATA_DIR||'.cloud-data');
if(!process.env.MUSELAB_PUBLIC_URL&&!process.env.RENDER_EXTERNAL_HOSTNAME)throw new Error('请设置 MUSELAB_PUBLIC_URL');
const publicUrl=new URL(process.env.MUSELAB_PUBLIC_URL||('https://'+process.env.RENDER_EXTERNAL_HOSTNAME));
if(!['http:','https:'].includes(publicUrl.protocol)||publicUrl.username||publicUrl.password||publicUrl.pathname!=='/'||publicUrl.search||publicUrl.hash)throw new Error('请设置网站的完整 MUSELAB_PUBLIC_URL');
const token=process.env.MUSELAB_SYNC_TOKEN||'';if(token.length<32)throw new Error('请配置至少 32 位的 MUSELAB_SYNC_TOKEN');
for(const directory of ['data','public/assets/uploads','public/assets/pinterest','src/data'])await mkdir(path.join(root,directory),{recursive:true});
await copyFile(path.join(appRoot,'src/data/pinterest-import.json'),path.join(root,'src/data/pinterest-import.json'));
try{await access(path.join(root,'data/pinterest-library.json'));}catch{await copyFile(path.join(appRoot,'deploy/seed/pinterest-library.json'),path.join(root,'data/pinterest-library.json'));}
// Only public source data is bundled. Personal Codex records arrive through authenticated sync.
for(const name of ['daily-news.json','design-articles.json','major-events.json'])try{await access(path.join(root,'data',name));}catch{try{await copyFile(path.join(appRoot,'deploy/seed',name),path.join(root,'data',name));}catch{/* Fetch on first use. */}}
if(process.env.MUSELAB_STORAGE==='supabase'){
 const store=await initializeSupabase(root);
 for(const name of ['pinterest-library.json','daily-news.json','design-articles.json','major-events.json'])try{await store.putDocument('data/'+name,JSON.parse(await readFile(path.join(root,'data',name),'utf8')),true);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}else if(process.env.RENDER)throw new Error('Render 免费部署必须配置 MUSELAB_STORAGE=supabase，禁止将个人资料仅保存在临时磁盘');
const app=connect();
const server=createServer(app);server.requestTimeout=120000;
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');if(publicUrl.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');if(req.url==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}next();});
app.use(privateSync(root,token));
app.use(cloudAuth(process.env.MUSELAB_PASSWORD||'',process.env.MUSELAB_SESSION_SECRET||'',publicUrl));
app.use((req,res,next)=>{if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==publicUrl.origin)){res.writeHead(403);res.end('请从个人工作台发起请求');return;}req.headers.host=publicUrl.host;next();});
const mount=(plugin:Plugin)=>{const configure=plugin.configurePreviewServer;if(typeof configure==='function')configure.call({} as never,{middlewares:app,httpServer:server} as PreviewServer);};
app.use(cloudBrief(root));
app.use(cloudState(root));
for(const plugin of [majorEventsApi(root),articlesApi(root),weatherApi(root),newsApi(root),buildersApi(root),imageImportApi(root),pinterestApi(root),podcastsApi(root),podcastTranscriptApi(root,{allowTranscription:false}),promptApi({...process.env} as Record<string,string>)])mount(plugin);
app.use((req,res,next)=>{if(!/^\/api\/(?:note-rewrite|podcast-article|product-research|note-yuque|note-images)(?:[/?]|$)/.test(req.url||''))return next();res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'此功能需要本机 Codex 或语雀工具，请在本机工作台完成后同步结果。'}));});
app.use('/api',(req,res)=>{res.writeHead(404,{'Content-Type':'application/json'});res.end('{"error":"接口不存在"}');});
app.use((req,res,next)=>{
 const store=storeFor(root);let key:string;try{key=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname).slice(1);}catch{res.writeHead(400);res.end();return;}
 if(!store||!mediaKey(key)||!['GET','HEAD'].includes(req.method||''))return next();
 void store.media(key).then(media=>{if(!media)return next();res.writeHead(200,{'Content-Type':media.type,'Content-Length':media.bytes.length,'Cache-Control':'private, max-age=300'});res.end(req.method==='HEAD'?undefined:media.bytes);},()=>{res.writeHead(503);res.end('图片暂时无法读取，请重试');});
});
app.use(sirv(path.join(root,'public'),{maxAge:0}));
app.use(sirv(path.join(appRoot,'dist'),{maxAge:0}));
app.use((req,res)=>{if(req.url?.startsWith('/assets/')||req.url?.startsWith('/article-covers/')){res.writeHead(404);res.end('图片不存在');return;}void readFile(path.join(appRoot,'dist/index.html')).then(html=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);},()=>{res.writeHead(503);res.end('网站正在准备中');});});
const port=Number(process.env.PORT||10000);server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Muselab listening on ${port}`));
let updating=false;let refreshed='';
async function update(){const now=new Date();const day=shanghaiDay(now);const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));const minute=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',minute:'2-digit'}).format(now));if(updating||refreshed===day||hour<7||(hour===7&&minute<45))return;updating=true;try{const results=await Promise.allSettled([refreshNews(root),refreshArticles(root)]);if(results.every(r=>r.status==='fulfilled'))refreshed=day;else console.error('资讯更新未全部完成，将重试并保留上次内容');}finally{updating=false;}}
if(process.env.MUSELAB_BACKGROUND_REFRESH!=='0')void update();const timer=setInterval(()=>{if(process.env.MUSELAB_BACKGROUND_REFRESH!=='0')void update();},60000);timer.unref();
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{clearInterval(timer);server.close(()=>process.exit(0));});
