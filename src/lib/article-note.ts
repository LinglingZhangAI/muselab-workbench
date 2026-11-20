import type {ArticleContent} from './article-content';
import type {Note} from './notes';
export function articleNoteUrl(value:string){
 if(/^\/article-covers\/[a-f0-9]{24}\.(?:jpg|png|webp|gif|avif)$/.test(value))return value;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function articleMarkdown(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 function visit(node:Node):string{
  if(node.nodeType===Node.TEXT_NODE)return (node.textContent||'').replace(/\s+/g,' ');
  if(!(node instanceof Element))return '';
  const tag=node.tagName.toLowerCase();if(['script','style','iframe','object','form','button'].includes(tag))return '';
  if(tag==='pre')return '\n\n```\n'+(node.textContent||'').trim()+'\n```\n\n';
  if(tag==='img'){const src=articleNoteUrl(node.getAttribute('src')||'');return src?'\n\n!['+(node.getAttribute('alt')||'原文配图').replace(/[\[\]\r\n]/g,' ')+']('+src.replace(/\(/g,'%28').replace(/\)/g,'%29')+')\n\n':'';}
  const text=Array.from(node.childNodes).map(visit).join('');
  if(tag==='br')return '\n';
  if(/^h[1-6]$/.test(tag))return '\n\n'+'#'.repeat(Number(tag[1]))+' '+text.trim()+'\n\n';
  if(tag==='a'){if(node.querySelector('img'))return text;const href=articleNoteUrl(node.getAttribute('href')||'');return href&&text.trim()?'['+text.trim().replace(/[\[\]]/g,'')+']('+href.replace(/\(/g,'%28').replace(/\)/g,'%29')+')':text;}
  if(tag==='strong'||tag==='b')return '**'+text.trim()+'**';
  if(tag==='li')return '\n- '+text.trim();
  if(tag==='blockquote')return '\n\n'+text.trim().split('\n').map(line=>'> '+line).join('\n')+'\n\n';
  if(tag==='td'||tag==='th')return text.trim()+' | ';
  if(['p','div','figure','ul','ol','tr','table','hr'].includes(tag))return '\n\n'+text.trim()+'\n\n';
  return text;
 }
 return Array.from(doc.body.childNodes).map(visit).join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function articleToNote(content:ArticleContent,title:string):Promise<Note>{
 const body=articleMarkdown(content.html);if(!body)throw new Error('正文尚未读取完成，请稍后重试');if(body.length>100000)throw new Error('文章超过笔记长度限制，暂时无法完整收藏');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content.url)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
 const now=new Date().toISOString();return {id:'article-'+hash.slice(0,32),title:title.slice(0,200),body,createdAt:now,updatedAt:now,source:{title,url:content.url,quote:'',kind:'article',format:'article'}};
}
