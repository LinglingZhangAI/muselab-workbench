import type {IncomingMessage,ServerResponse} from 'node:http';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Plugin} from 'vite';
import {durableFile} from './supabase';

const maxBytes=3*1024*1024;
export function publicAddress(address:string){
 if(isIP(address)===4){
  const [a,b]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
 }
 return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:0:|db8:)/i.test(address)&&!/^2002:/i.test(address);
}
export function imageFormat(data:Buffer){
 if(data.length>=8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {type:'image/png',extension:'png'};
 if(data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255)return {type:'image/jpeg',extension:'jpg'};
 if(data.length>=12&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP')return {type:'image/webp',extension:'webp'};
 if(data.length>=16&&data.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(data.toString('ascii',8,32)))return {type:'image/avif',extension:'avif'};
 throw new Error('请选择 PNG、JPG、WebP 或 AVIF 图片');
}
async function body(req:IncomingMessage,limit:number){
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('每张图片请控制在 3 MB 以内');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
// Resolve and pin the public address for every redirect. No browser credentials
// are forwarded, and private/local network destinations cannot be requested.
export async function downloadPublicImage(input:string,redirects=0):Promise<Buffer>{
 const url=new URL(input);
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port)))throw new Error('请拖入公开网页中的图片');
 const host=url.hostname.replace(/^\[|\]$/g,'');
 const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('不能导入本机或内网地址中的图片');
 const chosen=addresses[0];
 return new Promise((resolve,reject)=>{
  const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{headers:{Accept:'image/avif,image/webp,image/png,image/jpeg'},agent:false,family:chosen.family,lookup:(_hostname,options,callback)=>options.all?callback(null,[chosen]):callback(null,chosen.address,chosen.family)},response=>{
   if([301,302,303,307,308].includes(response.statusCode||0)){
    response.resume();
    if(!response.headers.location||redirects>=3){reject(new Error('图片地址重定向过多'));return;}
    void downloadPublicImage(new URL(response.headers.location,url).href,redirects+1).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.resume();reject(new Error('无法下载该网页图片，请复制图片后粘贴或下载后上传'));return;}
   const chunks:Buffer[]=[];let size=0;
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){response.destroy();reject(new Error('每张图片请控制在 3 MB 以内'));}else chunks.push(chunk);});
   response.on('error',reject);
   response.on('end',()=>resolve(Buffer.concat(chunks)));
  });
  request.setTimeout(15000,()=>request.destroy(new Error('图片下载超时，请稍后重试')));
  request.on('error',reject);request.end();
 });
}
export function imageImportApi(root:string):Plugin{
 const reply=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const url=req.url?.split('?')[0];if(!url?.startsWith('/api/images/'))return next();
  const origin=req.headers.origin;
  if((origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)||req.headers['sec-fetch-site']==='cross-site')return reply(res,403,{error:'请从 Muselab 导入图片'});
  void(async()=>{
   if(req.method!=='POST')return reply(res,405,{error:'请使用图片导入操作'});
   if(url==='/api/images/upload'){
    const data=await body(req,maxBytes);const format=imageFormat(data);
    const name=randomUUID()+'.'+format.extension;
    const directory=path.join(root,'public/assets/uploads');await mkdir(directory,{recursive:true});
    await durableFile(root,path.join(directory,name),data);
    return reply(res,201,{imageUrl:'/assets/uploads/'+name,format:format.extension.toUpperCase()});
   }
   if(url==='/api/images/remote'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'请求格式无效'});
    const input=JSON.parse((await body(req,16000)).toString('utf8'));
    if(typeof input.url!=='string'||input.url.length>8000)return reply(res,400,{error:'图片地址无效'});
    const data=await downloadPublicImage(input.url);const format=imageFormat(data);
    res.writeHead(200,{'Content-Type':format.type,'Cache-Control':'no-store'});res.end(data);return;
   }
   reply(res,404,{error:'接口不存在'});
  })().catch(error=>{if(!res.headersSent)reply(res,400,{error:error instanceof Error?error.message:'图片导入失败'});});
 };
 return {name:'local-image-import',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
