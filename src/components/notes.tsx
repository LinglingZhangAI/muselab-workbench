import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,BookOpen,Check,Download,FileText,FolderPlus,Headphones,NotebookPen,Plus,Search,Trash2,X} from 'lucide-react';
import {useNotes,exportNotes,safeNoteUrl,noteFolder,unfiledNotes,type NoteSource} from '@/lib/notes';
import {Modal} from './dialogs';
import {cloudStorageEnabled} from '@/lib/cloud-storage';
import {NoteCodex} from './note-codex';
import {NoteYuque} from './note-yuque';
import {NoteArticleBody} from './note-article-body';
import {subtitleClock} from '@/lib/podcast-playback';
import {NoteFolderDialog} from './note-folder-dialog';
import {NoteFolderSelect} from './note-folder-select';
import {noteCategories} from '@/lib/note-classification';

function date(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
export function Notebook(){
 const store=useNotes();const [query,setQuery]=useState('');const [sort,setSort]=useState('updated');const [mobileEditor,setMobileEditor]=useState(false);
 const [folderOpen,setFolderOpen]=useState(false);
 const folders=[...new Set([...store.folders,...noteCategories,...store.notes.map(noteFolder),unfiledNotes])];
 const titleRef=useRef<HTMLInputElement>(null);
 const scoped=store.notes.filter(note=>!store.folder||noteFolder(note)===store.folder);
 const notes=scoped.filter(n=>(n.title+' '+n.body+' '+(n.source?.title||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='created'?b.createdAt.localeCompare(a.createdAt):b.updatedAt.localeCompare(a.updatedAt));
 const selected=notes.find(n=>n.id===store.selected)||notes[0];
 function create(){setQuery('');if(store.create(undefined,store.folder||undefined)){setMobileEditor(true);requestAnimationFrame(()=>{titleRef.current?.focus();titleRef.current?.select();});}}
 useEffect(()=>{if(store.selected)setMobileEditor(true);},[store.selected]);
 return <div className={'notebook'+(mobileEditor&&selected?' has-editor':'')}>
  <header className="notebook-heading"><div><span>MY NOTES</span><h1>{store.folder||'我的笔记'}</h1></div><div><button onClick={()=>setFolderOpen(true)} disabled={!store.foldersReadable}><FolderPlus size={14}/><span>新建文件夹</span></button><button onClick={()=>exportNotes(scoped)} disabled={!scoped.length}><Download size={14}/><span>{store.folder?'导出文件夹':'导出全部'}</span></button><button className="notes-create" onClick={create} disabled={!store.readable}><Plus size={16}/><span>新建笔记</span></button></div></header>
  <div className="notebook-surface"><aside className="notes-index" aria-label="笔记列表">
   <div className="notes-index-heading"><h2>{store.folder||'所有笔记'} <small>{scoped.length}</small></h2><NoteFolderSelect label="笔记排序" value={sort} options={[{value:'updated',label:'最近编辑'},{value:'created',label:'创建日期'}]} onChange={setSort} variant="sort"/></div>
   <div className="notes-list-tools"><div className="notes-folder-filter"><NoteFolderSelect label="笔记文件夹" value={store.folder||''} options={[{value:'',label:'所有笔记'},...folders.map(folder=>({value:folder,label:folder}))]} onChange={value=>{store.selectFolder(value||null);setQuery('');setMobileEditor(false);}}/></div>
   <label className="notes-search"><Search size={13}/><input aria-label="搜索笔记" value={query} placeholder="搜索笔记" onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="清空笔记搜索" onClick={()=>setQuery('')}><X size={12}/></button>}</label></div>
   <div className="notes-list">{notes.length?notes.map(n=><button key={n.id} className={selected?.id===n.id?'is-current':''} aria-pressed={selected?.id===n.id} onClick={()=>{store.select(n.id);setMobileEditor(true);}}><strong>{n.title||'未命名笔记'}</strong><span>{n.body||'写下想法，留住灵感。'}</span><small>{date(n.updatedAt)}<i>·</i>{n.source?.kind==='podcast'?(n.source.format==='article'?'播客文章':'播客摘录'):n.source?'文字摘录':'自由笔记'}</small></button>):<p className="notes-list-empty">{query?'没有找到相关笔记':'还没有笔记。在工作台选中文字，记下第一份灵感。'}</p>}</div>
   <p className="notes-local"><BookOpen size={12}/>{cloudStorageEnabled()?'笔记同步到个人云端':'笔记保存在本机浏览器'}</p>
  </aside>
  {selected?<section className="note-editor" aria-label="编辑笔记"><button className="notes-back" onClick={()=>setMobileEditor(false)}><ArrowLeft size={14}/>全部笔记</button><div className="note-editor-meta"><div className="note-editor-context"><span>{selected.source?.kind==='podcast'?(selected.source.format==='article'?'播客文章':'播客摘录'):selected.source?'工作台摘录':'自由笔记'}<i>·</i>{date(selected.createdAt)}</span><div className="note-folder-location"><NoteFolderSelect label="移动笔记到文件夹" value={noteFolder(selected)} options={folders.map(folder=>({value:folder,label:folder}))} disabled={!store.readable||!store.foldersReadable} onChange={value=>store.move(selected.id,value)}/></div></div><div className="note-editor-actions"><NoteYuque key={selected.id} note={selected}/><button aria-label="导出当前笔记" title="导出当前笔记" onClick={()=>exportNotes([selected])}><Download size={15}/></button><button aria-label="删除当前笔记" title="删除当前笔记" onClick={()=>store.remove(selected.id)}><Trash2 size={15}/></button></div></div>
   <input ref={titleRef} className="note-title" aria-label="笔记标题" value={selected.title} placeholder="未命名笔记" maxLength={200} onChange={e=>store.edit(selected.id,{title:e.target.value,body:selected.body})}/>
   {selected.source&&<div className="note-source">{selected.source.kind==='podcast'?<Headphones size={13} aria-label="播客来源"/>:<FileText size={13}/>}<span>{selected.source.kind==='podcast'?'播客 · ':'摘自 '}{selected.source.title}{selected.source.kind==='podcast'&&typeof selected.source.position==='number'?' · '+subtitleClock(selected.source.position):''}</span>{safeNoteUrl(selected.source.url)&&<a href={safeNoteUrl(selected.source.url)!} target="_blank" rel="noopener noreferrer" aria-label="查看笔记来源">查看来源<ArrowUpRight size={12}/></a>}</div>}
   <NoteArticleBody key={selected.id} note={selected}/>
   <footer className="note-editor-footer"><span>{selected.body.length} 字</span><span>{store.error?'尚未保存':<><Check size={12}/>已自动保存</>}</span></footer>
   <NoteCodex/>
  </section>:<section className="notes-empty"><NotebookPen size={34} strokeWidth={1}/><h2>让想法，有处安放。</h2><p>选一段文字，记一份灵感。<br/>也可以从一张空白笔记开始。</p><button onClick={create} disabled={!store.readable}><Plus size={14}/>新建笔记</button></section>}
  </div>
  {!selected&&<NoteCodex/>}
  {store.error&&<div className="notes-warning" role="alert">{store.error}<button onClick={store.retry}>重试</button>{store.notes.length>0&&<button onClick={()=>exportNotes(store.notes)}>导出备份</button>}</div>}
  {store.deleted&&<div className="notes-undo" role="status">已删除「{store.deleted.title||'未命名笔记'}」<button onClick={store.undo}>撤销</button></div>}
  {store.foldersError&&<div className="notes-warning" role="alert">{store.foldersError}<button onClick={store.retryFolders}>重试</button></div>}
  <NoteFolderDialog open={folderOpen} onClose={()=>setFolderOpen(false)}/>
 </div>;
}

type Capture={source:NoteSource;host:HTMLElement;left:number;top:number};
function element(node:Node|null){return node instanceof Element?node:node?.parentElement;}
export function SelectionNotes(){
 const store=useNotes();const [capture,setCapture]=useState<Capture|null>(null);const [saved,setSaved]=useState(false);const savedRef=useRef(false);const toolbar=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let frame=0;
  function read(){
   if(document.activeElement?.closest('.selection-note-action'))return;
   const selection=window.getSelection();
   if(!selection||selection.isCollapsed||!selection.rangeCount){if(!savedRef.current)setCapture(null);return;}
   const range=selection.getRangeAt(0);const start=element(range.startContainer);const end=element(range.endContainer);
   if(!start||!end||start.closest('input,textarea,[contenteditable],.notebook')||end.closest('input,textarea,[contenteditable],.notebook')){setCapture(null);return;}
   const scope=start.closest<HTMLElement>('[data-note-scope]');
   const text=selection.toString().trim();
   if(!scope||!scope.contains(end)||!text||text.length>20000){setCapture(null);return;}
   const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const host=start.closest<HTMLElement>('[role="dialog"]')||document.body;
   const bounds=host===document.body?{left:0,top:0}:host.getBoundingClientRect();
   // Use fixed positioning outside transforms, absolute inside the active dialog.
   const right=host===document.body?window.innerWidth:host.getBoundingClientRect().right;
   const left=Math.max(bounds.left+8,Math.min(right-200,rect.left+rect.width/2-92));const top=rect.top>bounds.top+52?rect.top-43:Math.min(window.innerHeight-44,rect.bottom+8);
   setSaved(false);savedRef.current=false;
   const podcast=scope.dataset.noteKind==='podcast';const cue=start.closest<HTMLElement>('[data-note-time]');const position=Math.max(0,Number(cue?.dataset.noteTime??scope.dataset.notePosition)||0);const episodeId=scope.dataset.noteEpisode||'';
   setCapture({source:{title:scope.dataset.noteTitle||'工作台摘录',url:scope.dataset.noteUrl||'',quote:text,...(podcast?{kind:'podcast' as const,show:scope.dataset.noteShow||'',episodeId,position,playbackUrl:'/?podcast='+encodeURIComponent(episodeId)+'&t='+Math.floor(position)}:{})},host,left:left-bounds.left,top:top-bounds.top});
  }
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(read);};
  const hide=()=>{setCapture(null);setSaved(false);savedRef.current=false;};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&toolbar.current){e.stopPropagation();hide();}};
  document.addEventListener('pointerup',schedule);document.addEventListener('keyup',schedule);document.addEventListener('selectionchange',schedule);
  document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('keydown',escape,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerup',schedule);document.removeEventListener('keyup',schedule);document.removeEventListener('selectionchange',schedule);document.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);document.removeEventListener('keydown',escape,true);};
 },[]);
 function captureNote(){if(!capture)return;if(store.create(capture.source)){savedRef.current=true;setSaved(true);window.getSelection()?.removeAllRanges();}}
 const floating=capture&&capture.host.isConnected?createPortal(<div ref={toolbar} className="selection-note-action" style={{position:capture.host===document.body?'fixed':'absolute',left:capture.left,top:capture.top}} onPointerDown={e=>e.preventDefault()}>
  {saved?<><span role="status"><Check size={13}/>{store.error?'暂未保存':'已记入笔记'}</span><button onClick={()=>{store.setOpen(true);setCapture(null);}}>查看</button></>:<button onClick={captureNote} disabled={!store.readable}><NotebookPen size={14}/>记入笔记</button>}
  <button className="selection-note-close" aria-label="关闭摘录工具" onClick={()=>{setCapture(null);savedRef.current=false;}}><X size={12}/></button>
 </div>,capture.host):null;
 return <>{floating}<Modal open={store.open} onClose={()=>store.setOpen(false)} title="我的笔记" className="notebook-modal"><button className="notebook-modal-close" aria-label="关闭笔记" onClick={()=>store.setOpen(false)}><X size={19}/></button><Notebook/></Modal></>;
}
