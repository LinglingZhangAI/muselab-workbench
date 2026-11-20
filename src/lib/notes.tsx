import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {validNoteImage,imageMarkdown,type NoteImage} from './note-images';
import {noteCategories,organizeArticle} from './note-classification';
export type NoteSource={title:string;url:string;quote:string;kind?:'podcast'|'article';format?:'article';show?:string;episodeId?:string;position?:number;playbackUrl?:string};
export type Note={id:string;title:string;body:string;createdAt:string;updatedAt:string;source?:NoteSource;images?:NoteImage[];folder?:string;folderMode?:'auto'|'manual'};
const key='muselab-notes:v1';
const foldersKey='muselab-note-folders:v1';
export const unfiledNotes='未分类';
export function noteFolder(note:Note){return note.folder||unfiledNotes;}
function loadFolders(){try{const data=JSON.parse(localStorage.getItem(foldersKey)||'[]');if(!Array.isArray(data)||!data.every(value=>typeof value==='string'&&!!value.trim()&&value.length<=40))throw new Error();return {folders:[...new Set(data)] as string[],error:''};}catch{return {folders:[],error:'笔记文件夹暂时无法读取，原数据已保留。请重试。'};}}
function validNote(value:unknown):value is Note{
 const n=value as Note;return !!n&&['id','title','body','createdAt','updatedAt'].every(k=>typeof n[k as keyof Note]==='string')&&Number.isFinite(Date.parse(n.createdAt))&&Number.isFinite(Date.parse(n.updatedAt))&&(n.folder===undefined||typeof n.folder==='string'&&n.folder.length<=40)&&(!n.source||['title','url','quote'].every(k=>typeof n.source?.[k as keyof NoteSource]==='string'))&&(!n.images||(Array.isArray(n.images)&&n.images.length<=6&&n.images.every(validNoteImage)));
}
function load(){
 try{const raw=localStorage.getItem(key);if(!raw)return {notes:[],error:''};const data=JSON.parse(raw);if(!Array.isArray(data)||!data.every(validNote))throw new Error();return {notes:data as Note[],error:''};}
 catch{return {notes:[],error:'笔记暂时无法读取，原数据已保留。请先重试读取。'};}
}
type NotesContextValue={notes:Note[];folders:string[];folder:string|null;selectFolder:(folder:string|null)=>void;createFolder:(name:string)=>string|undefined;move:(id:string,folder:string)=>void;foldersError:string;foldersReadable:boolean;retryFolders:()=>void;selected:string|null;select:(id:string)=>void;create:(source?:NoteSource,folder?:string)=>string|null;importArticle:(note:Note)=>boolean;setImages:(id:string,images:NoteImage[])=>void;edit:(id:string,patch:Pick<Note,'title'|'body'>)=>void;remove:(id:string)=>void;undo:()=>void;deleted:Note|null;error:string;retry:()=>void;open:boolean;setOpen:(open:boolean)=>void;readable:boolean};
const NotesContext=createContext<NotesContextValue|null>(null);
export function NotesProvider({children}:{children:ReactNode}){
 const [initial]=useState(load);const [notes,setNotes]=useState<Note[]>(initial.notes);const current=useRef(initial.notes);
 const [initialFolders]=useState(loadFolders);const [folders,setFolders]=useState(initialFolders.folders);const folderCurrent=useRef(initialFolders.folders);
 const [foldersReadable,setFoldersReadable]=useState(!initialFolders.error),[foldersError,setFoldersError]=useState(initialFolders.error),[folder,selectFolder]=useState<string|null>(null);
 const [readable,setReadable]=useState(!initial.error);const [error,setError]=useState(initial.error);
 const [selected,select]=useState<string|null>(initial.notes[0]?.id||null);const [deleted,setDeleted]=useState<Note|null>(null);const [open,setOpen]=useState(false);
 function persist(next:Note[]){
  if(!readable)return false;
  current.current=next;setNotes(next);
  try{localStorage.setItem(key,JSON.stringify(next));setError('');return true;}catch{setError('笔记尚未保存：本机存储空间不足或不可用。请导出备份后重试。');return false;}
 }
 useEffect(()=>{if(!readable)return;const next=current.current.map(organizeArticle);if(next.some((note,index)=>note!==current.current[index]))persist(next);},[readable]);
 useEffect(()=>{const changed=(e:StorageEvent)=>{if(e.key===foldersKey){const result=loadFolders();setFoldersError(result.error);setFoldersReadable(!result.error);if(!result.error){folderCurrent.current=result.folders;setFolders(result.folders);}return;}if(e.key!==key)return;const result=load();if(result.error){setError(result.error);setReadable(false);return;}current.current=result.notes;setNotes(result.notes);setReadable(true);setError('');};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 function createFolder(name:string){
  if(!foldersReadable)return '请先重试读取笔记文件夹';
  const clean=name.trim();if(!clean)return '请输入文件夹名称';if(clean.length>40)return '文件夹名称不能超过 40 个字';
  if([unfiledNotes,'所有笔记',...noteCategories,...folderCurrent.current,...current.current.map(noteFolder)].some(value=>value.toLowerCase()===clean.toLowerCase()))return '这个笔记文件夹已存在，请换一个名称';
  const next=[...folderCurrent.current,clean];try{localStorage.setItem(foldersKey,JSON.stringify(next));}catch{return '笔记文件夹未保存，浏览器存储暂时不可用';}
  folderCurrent.current=next;setFolders(next);setFoldersError('');
 }
 function retryFolders(){const result=loadFolders();setFoldersError(result.error);setFoldersReadable(!result.error);if(!result.error){folderCurrent.current=result.folders;setFolders(result.folders);}}
 function move(id:string,target:string){if(!readable||![unfiledNotes,...noteCategories,...folderCurrent.current,...current.current.map(noteFolder)].includes(target))return;persist(current.current.map(note=>note.id===id?{...note,folder:target,folderMode:'manual',updatedAt:new Date().toISOString()}:note));}
 function create(source?:NoteSource,target?:string){
  if(!readable)return null;
  if(source){const existing=current.current.find(n=>n.source?.url===source.url&&n.source?.quote===source.quote);if(existing){select(existing.id);return existing.id;}}
  const now=new Date().toISOString();const note:Note={id:crypto.randomUUID(),title:source?source.title.slice(0,160):'未命名笔记',body:source?.quote||'',createdAt:now,updatedAt:now,...(target?{folder:target}:{}),...(source?{source}:{} )};
  persist([note,...current.current]);select(note.id);return note.id;
 }
 function edit(id:string,patch:Pick<Note,'title'|'body'>){persist(current.current.map(n=>n.id===id?{...n,title:patch.title.slice(0,200),body:patch.body.slice(0,100000),updatedAt:new Date().toISOString()}:n));}
 function importArticle(note:Note){if(!readable)return false;const saved=persist(current.current.some(n=>n.id===note.id)?current.current:[organizeArticle(note),...current.current]);return saved;}
 function setImages(id:string,images:NoteImage[]){if(!images.every(validNoteImage))return;persist(current.current.map(note=>note.id===id?{...note,images:images.slice(0,6),updatedAt:new Date().toISOString()}:note));}
 function remove(id:string){const note=current.current.find(n=>n.id===id);if(!note)return;setDeleted(note);const next=current.current.filter(n=>n.id!==id);persist(next);select(next[0]?.id||null);}
 function undo(){if(!deleted)return;persist([deleted,...current.current.filter(n=>n.id!==deleted.id)]);select(deleted.id);setDeleted(null);}
 function retry(){if(!readable){const result=load();if(result.error){setError(result.error);return;}current.current=result.notes;setNotes(result.notes);setReadable(true);setError('');}else persist(current.current);}
 return <NotesContext.Provider value={{notes,folders,folder,selectFolder,createFolder,move,foldersError,foldersReadable,retryFolders,selected,select,create,importArticle,setImages,edit,remove,undo,deleted,error,retry,open,setOpen:value=>{if(value)selectFolder(null);setOpen(value);},readable}}>{children}</NotesContext.Provider>;
}
export function useNotes(){const value=useContext(NotesContext);if(!value)throw new Error('NotesProvider is required');return value;}
export function safeNoteUrl(value:string){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function exportNotes(notes:Note[]){
 const content=notes.map(n=>`# ${n.title||'未命名笔记'}\n\n${n.images?.length?n.images.map(image=>imageMarkdown(image)).join('\n\n')+'\n\n':''}${n.body}${n.source?`\n\n---\n${n.source.kind==='podcast'?'播客来源':'来源'}：${n.source.title}${n.source.kind==='podcast'?'\n播放位置：'+Math.floor(n.source.position||0)+' 秒':''}${safeNoteUrl(n.source.url)?'\n'+safeNoteUrl(n.source.url):''}${n.source.quote?'\n\n原始摘录：\n'+n.source.quote.split('\n').map(line=>'> '+line).join('\n'):''}`:''}\n\n记录时间：${n.createdAt}\n`).join('\n---\n\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=notes.length===1?(notes[0].title||'笔记').replace(/[\\/:*?"<>|]/g,'-')+'.md':'Muselab-笔记.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
