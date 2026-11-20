import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,FolderPlus} from 'lucide-react';
import type {Asset} from '@/data/assets';
import {categoryLabel} from '@/data/categories';
import GlassFolder,{type FolderFile} from './ui/glass-folder-cards';
import {useNotes,noteFolder,unfiledNotes} from '@/lib/notes';
import {NoteFolderDialog} from './note-folder-dialog';
import {BuildersInsight} from './builders-insight';
import {TodayTodo} from './today-todo';
import {DailyNews} from './daily-news';
import {DailyBrief} from './daily-brief';
import {DesignInsight} from './design-insight';

function FolderCard({name,count,files,kind='素材',index,onNavigate,onPreview,onAdd}:{name:string;count:number;files:FolderFile[];kind?:'素材'|'笔记';index:number;onNavigate:()=>void;onPreview:(index:number)=>void;onAdd:()=>void}){
 const darkNote=kind==='笔记'&&index%2===0;
 const container=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(140);
 useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.min(170,entry.contentRect.width)));observer.observe(el);return()=>observer.disconnect();},[]);
 return <div ref={container} className="home-folder-card">
  <GlassFolder label={name} meta={`${count} ${kind==='笔记'?'篇笔记':'个素材'}`} width={width} tone={darkNote?'dark':'light'} art={darkNote?'ember':index%2===0?'aurora':'none'} seed={darkNote?index+11:index+3} action={darkNote?'none':index%2===0?'add':'more'} labelPlacement={darkNote?'top-right':'bottom-left'} appearDelay={index*70} files={files} onRequestAdd={onAdd} addLabel={kind==='笔记'?'新建笔记到'+name:undefined} previewLabel={kind==='笔记'?name+'笔记预览':undefined} onFileSelect={(_,i)=>onPreview(i)} menu={[{label:'查看全部'+kind,onSelect:onNavigate},{label:kind==='笔记'?'新建笔记':'添加图片',onSelect:onAdd}]} />
  <button className="home-folder-open" onClick={onNavigate} aria-label={`进入${name}${kind==='笔记'?'笔记':''}文件夹`}>查看全部<ArrowRight size={13}/></button>
 </div>;
}

export function Workbench({assets,customFolders,onNavigate,onPreview,onAdd,onAddToFolder,onOpenNotes}:{assets:Asset[];customFolders:string[];onNavigate:(folder:string)=>void;onPreview:(id:string)=>void;onAdd:(mode:'add'|'folder'|'paste')=>void;onAddToFolder:(folder:string)=>void;onOpenNotes:(folder:string,id?:string)=>void}){
 const notes=useNotes();const [noteFolderOpen,setNoteFolderOpen]=useState(false);
 const live=assets.filter(a=>!a.deleted);
 const folders=[...new Set([...customFolders,...live.map(a=>a.folder)])];
 const activeFolders=folders.map(name=>({name,count:live.filter(a=>a.folder===name).length})).sort((a,b)=>Number(customFolders.includes(b.name))-Number(customFolders.includes(a.name))||b.count-a.count).slice(0,6);
 const noteFolders=[...new Set([...notes.folders,...notes.notes.map(noteFolder),unfiledNotes])].map(name=>({name,items:notes.notes.filter(note=>noteFolder(note)===name).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))})).sort((a,b)=>Number(notes.folders.includes(b.name))-Number(notes.folders.includes(a.name))||b.items.length-a.items.length).slice(0,6);
 function addNote(folder:string){const id=notes.create(undefined,folder);if(id)onOpenNotes(folder,id);}
 return <div className="workbench-home" data-note-scope data-note-title="工作台 · 每日灵感">
  <div className="workbench-layout"><div className="home-banner"><DailyBrief onAdd={()=>onAdd('add')}/></div>
  <div className="home-primary" style={{'--home-folder-columns':Math.max(1,activeFolders.length)} as CSSProperties}>
  <div className="home-insight-grid"><BuildersInsight/><DesignInsight/></div>
  <section className="home-section" aria-label="图片文件夹"><div className="home-section-heading"><h3>图片文件夹</h3><button onClick={()=>onAdd('folder')}>新建文件夹<FolderPlus size={14}/></button></div>
   {activeFolders.length?<div className="home-folders">{activeFolders.map((folder,index)=>{const items=live.filter(a=>a.folder===folder.name).slice(0,4);return <FolderCard key={folder.name} name={categoryLabel(folder.name)} count={folder.count} files={items.map(asset=>({name:asset.title,image:asset.imageUrl,meta:asset.format}))} index={index} onNavigate={()=>onNavigate(folder.name)} onPreview={i=>onPreview(items[i].id)} onAdd={()=>onAddToFolder(folder.name)}/>;})}</div>:<p className="home-folders-empty">创建文件夹，开始整理你的素材。</p>}
  </section>
  <section className="home-section" aria-label="笔记文件夹"><div className="home-section-heading"><h3>笔记文件夹</h3><button disabled={!notes.foldersReadable} onClick={()=>setNoteFolderOpen(true)}>新建文件夹<FolderPlus size={14}/></button></div>
   <div className="home-folders home-note-folders">{noteFolders.map(({name,items},index)=><FolderCard key={name} name={name} kind="笔记" count={items.length} files={items.slice(0,4).map(note=>({name:note.title||'未命名笔记',meta:note.source?.kind==='podcast'?'播客笔记':note.source?'文字摘录':'自由笔记'}))} index={index} onNavigate={()=>onOpenNotes(name)} onPreview={i=>onOpenNotes(name,items[i].id)} onAdd={()=>addNote(name)}/>)}</div>
   {(notes.foldersError||notes.error)&&<p className="notes-warning" role="alert">{notes.foldersError||notes.error}<button onClick={()=>{notes.retryFolders();notes.retry();}}>重试</button></p>}
  </section>
  <NoteFolderDialog open={noteFolderOpen} onClose={()=>setNoteFolderOpen(false)}/>
  </div><div className="home-right-rail"><TodayTodo/><DailyNews/></div></div>
 </div>;
}
