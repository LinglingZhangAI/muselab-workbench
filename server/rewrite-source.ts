import {lookup} from 'node:dns/promises';
import {get as httpsGet} from 'node:https';
import {get as httpGet} from 'node:http';
import {isIP} from 'node:net';
import {load} from 'cheerio';
import {articleLink} from '../src/lib/article-link.ts';

export function publicAddress(address:string){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===198&&(b===18||b===19)));}
 return isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:db8:/i.test(address);
}
function publicUrl(value:string,article=false){
 const url=new URL(article?articleLink(value):value);
 const expectedPort=url.protocol==='http:'?'80':'443';
 if(!(article?['http:','https:'].includes(url.protocol):url.protocol==='https:')||url.username||url.password||(url.port&&url.port!==expectedPort)||url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.localhost'))throw new Error('请提供公开的 HTTP 或 HTTPS 网页链接');
 const host=url.hostname.replace(/^\[|\]$/g,'');if(isIP(host)&&!publicAddress(host))throw new Error('不支持本机或内网地址');
 for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key))url.searchParams.delete(key);url.hash='';return url;
}
// Media/transcript callers retain HTTPS-only behavior.
export const rewriteUrl=(value:string)=>publicUrl(value);
export const rewriteArticleUrl=(value:string)=>publicUrl(value,true);
const unavailable='原站未提供可公开读取的完整正文，可能需要登录、订阅或浏览器加载，请换一个公开正文链接';
const challenge=/verify (?:that )?you are human|checking your browser|just a moment|access denied|security verification|安全验证|访问验证|人机验证|环境异常|访问过于频繁/i;

export function extractRewriteSource(html:string,url:string){
 const $=load(html);
 if(new URL(url).hostname==='mp.weixin.qq.com'&&(/\/mp\/wappoc_appmsgcaptcha/.test(new URL(url).pathname)||/环境异常|完成验证后即可继续访问/.test($('body').clone().find('script,style').remove().end().text())))throw new Error('微信要求在浏览器中完成验证。请打开原文，验证后复制正文，粘贴后继续生成。');
 const title=($('meta[property="og:title"]').attr('content')||$('meta[name="twitter:title"]').attr('content')||$('h1').first().text()||$('title').text()).replace(/\s+/g,' ').trim().slice(0,240);
 if(challenge.test($('title').text())||challenge.test($('h1').first().text()))throw new Error(unavailable);
 const structured:{title:string;body:string}[]=[];
 let restricted=false;
 const visit=(value:unknown,depth=0)=>{
  if(!value||typeof value!=='object'||depth>12)return;
  if(Array.isArray(value)){value.forEach(v=>visit(v,depth+1));return;}
  const data=value as Record<string,unknown>;
  const types=[data['@type']].flat();
  if(types.some(t=>typeof t==='string'&&/^(?:Article|NewsArticle|BlogPosting|TechArticle|ScholarlyArticle|Report|DiscussionForumPosting)$/.test(t))){
   if(data.isAccessibleForFree===false||data.isAccessibleForFree==='false')restricted=true;
   else if(typeof data.articleBody==='string')structured.push({title:typeof data.headline==='string'?data.headline:title,body:data.articleBody});
  }
  if(data['@graph'])visit(data['@graph'],depth+1);
  if(data.mainEntity)visit(data.mainEntity,depth+1);
 };
 $('script[type="application/ld+json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()));}catch{/* Never execute embedded scripts. */}});
 if(restricted)throw new Error(unavailable);
 const featured=$('.wp-block-post-featured-image img,.post-thumbnail img,.article-cover img').first();
 const cover=featured.attr('data-src')||featured.attr('src')||$('meta[property="og:image"]').attr('content')||'';
 const coverAlt=featured.attr('alt')||title;
 $('script,style,noscript,nav,footer,aside,form,button,iframe,svg,[role="navigation"],[hidden],[aria-hidden="true"],.ad-unit,.wp-block-techcrunch-inline-cta,.wp-block-techcrunch-event-promo,.cookie-banner,.comments,#comments,.related-posts,.post-navigation').remove();
 const blocks=(element:Parameters<typeof $>[0])=>{
  const scope=$(element).clone();
  scope.find('br').replaceWith('\n');
  scope.find('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr,section,div').append('\n\n');
  return scope.text().replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 };
 const primary='.entry-content,.post-content,.article-content,.article-body,.post-article .article,[itemprop="articleBody"],#js_content,.rich_media_content,.RichText,.Post-RichText,.markdown-body,.theme-doc-markdown,.vp-doc,.md-content__inner,[data-testid="article-body"],[data-component="text-block"],article,main,[role="main"]';
 const candidates=$(primary).toArray();
 if(!candidates.length){
  $('div,section').each((_,el)=>{if($(el).children('p,section').length>=2)candidates.push(el);});
  if(!candidates.length)candidates.push($('body')[0]);
 }
 const ranked=candidates.map(el=>{
  const text=blocks(el),linkText=$(el).find('a').text().replace(/\s+/g,' ').length;
  const density=linkText/Math.max(1,text.length);
  return {el,text,score:text.length*(1-Math.min(.95,density))};
 }).filter(v=>v.text.length>=200).sort((a,b)=>b.score-a.score);
 const best=ranked[0];
 const jsonBody=structured.map(v=>{const doc=load(v.body);doc('script,style,noscript').remove();return {...v,body:doc('body').text().trim()};}).filter(v=>v.body.length>=200).sort((a,b)=>b.body.length-a.body.length)[0];
 // Use JSON-LD only when it exposes substantially more of the actual article.
 const useStructured=!!jsonBody&&(!best||jsonBody.body.length>best.text.length*1.3);
 const text=(useStructured?jsonBody.body:best?.text||'').slice(0,50000);
 const sourceTitle=title||jsonBody?.title||'';
 if(!sourceTitle||text.length<200||challenge.test(text.slice(0,300))||/^(?:enable javascript|please (?:log|sign) in|请先登录|登录后(?:查看|阅读))/i.test(text))throw new Error(unavailable);
 const images:{url:string;alt:string;caption:string}[]=[];const seen=new Set<string>();
 const addImage=(value:string,alt='',caption='')=>{try{const image=rewriteUrl(new URL(value,url).href).href;const key=image.split('?')[0];if(!value||seen.has(key)||/logo|avatar|icon|tracking|pixel|gravatar/i.test(key))return;seen.add(key);images.push({url:image,alt:alt.slice(0,200),caption:caption.slice(0,300)});}catch{/* Unsupported image. */}};
 addImage(cover,coverAlt);
 if(best)$(best.el).find('img').each((_,element)=>{const image=$(element);if(Number(image.attr('width'))>0&&Number(image.attr('width'))<160)return;addImage(image.attr('data-src')||image.attr('data-original')||image.attr('src')||'',image.attr('alt'),image.closest('figure').find('figcaption').text().trim());});
 return {url,title:sourceTitle,text,images:images.slice(0,6)};
}
export function extractTextSource(body:string,url:string){
 const text=body.replace(/^\uFEFF/,'').trim();
 if(text.length<200||challenge.test(text.slice(0,300))||/^(?:enable javascript|please (?:log|sign) in|请先登录|登录后(?:查看|阅读))/i.test(text))throw new Error(unavailable);
 const title=(text.match(/^#\s+(.+)$/m)?.[1]||text.split('\n').find(line=>line.trim())||new URL(url).hostname).trim().slice(0,240);
 return {url,title,text:text.slice(0,50000),images:[]};
}
export async function publicResource(value:string,kind:'article'|'image'|'transcript'){
 const validate=kind==='article'?rewriteArticleUrl:rewriteUrl;
 let url=validate(value);
 for(let redirect=0;redirect<6;redirect++){
  const addresses=await lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true});
  if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw new Error('不支持本机或内网地址');
  const address=addresses[0];
  const result=await new Promise<{status:number;location?:string;body:Buffer;contentType:string}>((resolve,reject)=>{
   const get=url.protocol==='http:'?httpGet:httpsGet;
   const request=get(url,{headers:{Accept:kind==='article'?'text/html,application/xhtml+xml,text/plain,text/markdown':kind==='transcript'?'text/vtt,application/x-subrip,text/plain':'image/avif,image/webp,image/png,image/jpeg,image/gif','User-Agent':'Muselab Article Reader'},lookup:(_host,options,done)=>{if(typeof options==='object'&&options.all)(done as Function)(null,[address]);else done(null,address.address,address.family);}},response=>{
    const status=response.statusCode||0;if(status>=300&&status<400){response.resume();resolve({status,location:response.headers.location,body:Buffer.alloc(0),contentType:''});return;}
    if(status!==200){response.resume();reject(new Error(status===403||status===401?'原站限制访问，无法读取正文，请换一个公开链接':'原文暂时无法读取，请稍后重试'));return;}
    const contentType=response.headers['content-type']||'';
    if(!(kind==='article'?/^(?:text\/(?:html|plain|markdown|x-markdown)|application\/xhtml\+xml)(?:;|$)/i:kind==='transcript'?/text\/(?:vtt|plain)|application\/(?:x-subrip|octet-stream)/i:/image\/(?:jpeg|png|gif|webp|avif)/i).test(contentType)){response.resume();reject(new Error(kind==='article'?'此链接未返回可读取的网页或文本，请提供正文链接':kind==='transcript'?'原站未返回可用字幕':'原站未返回可用图片'));return;}
    const chunks:Buffer[]=[];let size=0;
    response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>(kind==='image'?8:5)*1024*1024){request.destroy(new Error('原文内容过大'));return;}chunks.push(chunk);});
    response.on('end',()=>resolve({status,body:Buffer.concat(chunks),contentType}));response.on('error',reject);
   });
   const timer=setTimeout(()=>request.destroy(new Error('读取原文超时，请稍后重试')),25000);request.on('close',()=>clearTimeout(timer));request.on('error',reject);
  });
  if(result.status>=300&&result.status<400){if(!result.location)throw new Error('文章跳转地址无效');url=validate(new URL(result.location,url).href);continue;}
  return {url:url.href,body:result.body,contentType:result.contentType};
 }
 throw new Error('文章跳转过多，请使用最终文章链接');
}
export async function fetchRewriteSource(value:string){
 const result=await publicResource(value,'article');
 const charset=result.contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]||'utf-8';
 let body:string;try{body=new TextDecoder(charset).decode(result.body);}catch{body=result.body.toString('utf8');}
 return /^text\/(?:plain|markdown|x-markdown)(?:;|$)/i.test(result.contentType)?extractTextSource(body,result.url):extractRewriteSource(body,result.url);
}
