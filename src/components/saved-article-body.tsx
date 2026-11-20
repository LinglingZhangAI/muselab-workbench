import {useState} from 'react';
import {Check,PencilLine} from 'lucide-react';
import {useNotes,type Note} from '@/lib/notes';
import {articleNoteUrl} from '@/lib/article-note';
function Inline({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part,index)=>{if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{part.slice(2,-2)}</strong>;const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);const href=link&&articleNoteUrl(link[2]);return href?<a key={index} href={href} target="_blank" rel="noopener noreferrer">{link![1]}</a>:part;})}</>;}
function Image({src,alt}:{src:string;alt:string}){const [failed,setFailed]=useState(false);return failed?<p>配图暂不可用，请<a href={src} target="_blank" rel="noopener noreferrer">查看图片</a>或查看原文。</p>:<figure><img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></figure>;}
export function SavedArticleBody({note}:{note:Note}){
 const store=useNotes(),[editing,setEditing]=useState(false);
 return <><div className="saved-article-tools"><span>已收藏完整文章 · 保留原文来源</span><button onClick={()=>setEditing(value=>!value)}>{editing?<Check size={13}/>:<PencilLine size={13}/>}<span>{editing?'完成编辑':'编辑正文'}</span></button></div>{editing?<textarea className="note-body" aria-label="笔记正文" maxLength={100000} value={note.body} onChange={event=>store.edit(note.id,{title:note.title,body:event.target.value})}/>:<article className="saved-article-content reader-prose" aria-label="收藏的文章正文">{note.body.split(/\n{2,}/).map((block,index)=>{
  const image=block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);if(image){const src=articleNoteUrl(image[2]);return src?<Image key={index+src} src={src} alt={image[1]}/>:null;}
  const heading=block.match(/^(#{1,6}) (.+)$/);if(heading)return heading[1].length<3?<h2 key={index}><Inline text={heading[2]}/></h2>:<h3 key={index}><Inline text={heading[2]}/></h3>;
  if(block.startsWith('```'))return <pre key={index}><code>{block.replace(/^```[^\n]*\n?/,'').replace(/\n?```$/,'')}</code></pre>;
  if(block.startsWith('> '))return <blockquote key={index}><Inline text={block.replace(/^> ?/gm,'')}/></blockquote>;
  if(block.split('\n').every(line=>line.startsWith('- ')))return <ul key={index}>{block.split('\n').map((line,i)=><li key={i}><Inline text={line.slice(2)}/></li>)}</ul>;
  return <p key={index}><Inline text={block}/></p>;
 })}</article>}</>;
}
