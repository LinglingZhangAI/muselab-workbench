import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowDownAZ,ArrowUpAZ,Check,ChevronLeft,ChevronRight,Columns3,Copy,Filter,Grid2X2,ImagePlus,Info,LayoutGrid,Menu,PanelLeft,PanelRight,Plus,Search,SlidersHorizontal,Star,X,Zap} from "lucide-react";
import {initialAssets,demoAssets,pinterestImportInfo,type Asset} from "@/data/assets";
import {Sidebar} from "@/components/sidebar";
import {Gallery} from "@/components/gallery";
import {Inspector} from "@/components/inspector";
import {Modal,Preview} from "@/components/dialogs";
import {IconButton} from "@/components/ui/icon-button";
import {cn,copyText} from "@/lib/utils";
import {usePromptGenerator} from '@/lib/use-prompt-generator';
import {ModelConnectionDialog} from '@/components/prompt-generator';
import {PinterestLibrary} from '@/components/pinterest-library';
import {usePinterestLibrary,useBatchPromptGeneration} from '@/lib/pinterest-library';
import {resolveCategory,categoryLabel,categoryNames} from '@/data/categories';
import {AddContent} from '@/components/add-content';
import {Workbench} from '@/components/workbench';
import {Notebook,SelectionNotes} from '@/components/notes';
import {assetFromFile,fileFromUrl,droppedImageUrls} from '@/lib/image-import';
import {CloudAccount} from '@/components/cloud-account';
import {Whiteboard} from '@/components/whiteboard';
import {useNotes} from '@/lib/notes';
import {DailyPodcasts} from '@/components/daily-podcasts';
import {MajorEvents} from '@/components/major-events';

const storageKey="eagle-prompt-library:v1";
const migrationKey='eagle-pinterest-migration:v2';
const demoIds=new Set(demoAssets.map(a=>a.id));
const folderStorageKey='muselab-folders:v1';
function loadFolders():string[]{try{const raw=JSON.parse(localStorage.getItem(folderStorageKey)||'[]');return Array.isArray(raw)?[...new Set(raw.filter((v):v is string=>typeof v==='string'&&!!v.trim()))]:[];}catch{return [];}}
function migrateAssets(assets:Asset[]):Asset[]{
 const kept=assets.filter(a=>!demoIds.has(a.id));
 const ids=new Set(kept.map(a=>a.id));
 return [...initialAssets.filter(a=>!ids.has(a.id)),...kept];
}
function loadAssets():Asset[] {
 try {
  const raw=JSON.parse(localStorage.getItem(storageKey)??"null");
  if(!Array.isArray(raw))return initialAssets;
  const valid=raw.filter((a):a is Asset=>!!a&&typeof a.id==="string"&&typeof a.title==="string"&&typeof a.prompt==="string"&&typeof a.imageUrl==="string"&&(a.imageUrl.startsWith("/assets/")||a.imageUrl.startsWith(import.meta.env.BASE_URL+"assets/")||a.imageUrl.startsWith("data:image/"))&&Array.isArray(a.tags)&&a.tags.every((v:unknown)=>typeof v==="string")&&Array.isArray(a.palette)&&typeof a.folder==="string"&&typeof a.sourceUrl==="string"&&typeof a.width==="number"&&typeof a.height==="number");
  if(!localStorage.getItem(migrationKey)){
   const merged=migrateAssets(valid);
   try{
    if(!localStorage.getItem('eagle-before-pinterest:v1'))localStorage.setItem('eagle-before-pinterest:v1',JSON.stringify(valid));
    localStorage.setItem(storageKey,JSON.stringify(merged));
    localStorage.setItem(migrationKey,'done');
   }catch{/* Keep the merged data in memory; the save effect reports storage errors. */}
   return merged;
  }
  return valid.length?valid:initialAssets;
 } catch {return initialAssets;}
}
export default function App(){
 const notes=useNotes();
 const [assets,setAssets]=useState<Asset[]>(loadAssets);
 const [selectedId,setSelected]=useState<string|null>(initialAssets[0]?.id??null);
 const [history,setHistory]=useState(["工作台"]);
 const [historyIndex,setHistoryIndex]=useState(0);
 const current=history[historyIndex];
 const isHome=current==='工作台';
 const isNotes=current==='笔记';
 const isWhiteboard=current==='白板';
 const isEvents=current==='重大事件';
 const isLibrary=!isHome&&!isNotes&&!isWhiteboard&&!isEvents;
 const [whiteboardVisited,setWhiteboardVisited]=useState(false);
 const [query,setQuery]=useState("");
 const [columns,setColumns]=useState(4);
 const [layout,setLayout]=useState<"masonry"|"grid">("masonry");
 const [sort,setSort]=useState<"default"|"az"|"za">("default");
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [favoritesOnly,setFavoritesOnly]=useState(false);
 const [tagFilter,setTagFilter]=useState("");
 const [sidebarOpen,setSidebarOpen]=useState(false);
 const [sidebarCollapsed,setSidebarCollapsed]=useState(true);
 const [inspectorOpen,setInspectorOpen]=useState(false);
 const [inspectorHidden,setInspectorHidden]=useState(false);
 const [previewId,setPreview]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [saveError,setSaveError]=useState(false);
 const [importing,setImporting]=useState(false);
 const [customFolders,setCustomFolders]=useState<string[]>(loadFolders);
 const [addOpen,setAddOpen]=useState(false);
 const [addMode,setAddMode]=useState<'add'|'folder'|'paste'>('add');
 const [dragging,setDragging]=useState(false);
 const importLock=useRef(false);
 const dragDepth=useRef(0);
 const input=useRef<HTMLInputElement>(null);
 const search=useRef<HTMLInputElement>(null);
 const tagList=useMemo(()=>[...new Set(assets.filter(a=>!a.deleted).flatMap(a=>a.tags))].sort(),[assets]);
 const targetFolder=customFolders.includes(current)||categoryNames.includes(current)||['待分类','未分类'].includes(current)?current:'待分类';

 useEffect(()=>{
  // Repair sessions kept alive by hot updates after the earlier migration
  // wrote its marker while the old demo collection was still in memory.
  if(!assets.some(a=>demoIds.has(a.id)))return;
  try{if(localStorage.getItem(migrationKey))return;}catch{/* Repair in memory when storage is unavailable. */}
  const merged=migrateAssets(assets);
  try{
   if(!localStorage.getItem('eagle-before-pinterest:v1'))localStorage.setItem('eagle-before-pinterest:v1',JSON.stringify(assets));
   localStorage.setItem(storageKey,JSON.stringify(merged));
   localStorage.setItem(migrationKey,'done');
  }catch{/* The save effect reports storage errors. */}
  setAssets(merged);
 },[assets]);
 useEffect(()=>{
  try{localStorage.setItem(storageKey,JSON.stringify(assets));setSaveError(false);}
  catch{setSaveError(true);}
 },[assets]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),3200);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{
  function keys(e:KeyboardEvent){
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.current?.focus();}
  }
  window.addEventListener("keydown",keys);return()=>window.removeEventListener("keydown",keys);
 },[]);

 const filtered=useMemo(()=>{
  let results=assets.filter(a=>{
   if(current==="回收站"?!a.deleted:a.deleted)return false;
   if(current==="未标签"&&a.tags.length)return false;
   if(current==="收藏"&&!a.favorite)return false;
   if(!["工作台","全部","回收站","未标签","收藏","标签管理"].includes(current)&&a.folder!==current)return false;
   if(favoritesOnly&&!a.favorite)return false;
   if(tagFilter&&!a.tags.includes(tagFilter))return false;
   return (a.title+" "+a.tags.join(" ")+" "+a.prompt).toLowerCase().includes(query.toLowerCase().trim());
  });
  if(sort!=="default")results=[...results].sort((a,b)=>sort==="az"?a.title.localeCompare(b.title):b.title.localeCompare(a.title));
  return results;
 },[assets,current,query,sort,favoritesOnly,tagFilter]);
 const selected=filtered.find(a=>a.id===selectedId)??null;
 useEffect(()=>{if(!filtered.some(a=>a.id===selectedId))setSelected(filtered[0]?.id??null);},[filtered,selectedId]);
 const preview=assets.find(a=>a.id===previewId)??null;
 const generator=usePromptGenerator(selected,(id,prompt,original,result)=>{
  const target=assets.find(a=>a.id===id);
  if(!target||target.deleted||target.prompt!==original)return false;
  const folder=resolveCategory(result.category,result.categorySlug);
  setAssets(prev=>prev.map(a=>a.id===id?{...a,prompt,folder:folder==='待分类'?a.folder:folder,analysisStatus:'complete'}:a));
  setNotice('已应用生成的 UI Prompt');return true;
 });
 const pinterest=usePinterestLibrary(setAssets);
 const batch=useBatchPromptGeneration(assets,setAssets,generator);
 const autoAttempted=useRef(new Set<string>());
 useEffect(()=>{
  if(!generator.configured||pinterest.job.running||batch.progress.running)return;
  const pending=assets.filter(a=>a.pinId&&!a.deleted&&!a.prompt&&a.analysisStatus!=='non-ui'&&!autoAttempted.current.has(a.id));
  if(!pending.length)return;
  pending.forEach(a=>autoAttempted.current.add(a.id));
  void batch.start(true);
 },[assets,generator.configured,pinterest.job.running,batch.progress.running]);

 function navigate(name:string){
  if(name==='笔记')notes.selectFolder(null);
  if(name==='白板')setWhiteboardVisited(true);
  if(name!==current){setHistory(prev=>[...prev.slice(0,historyIndex+1),name]);setHistoryIndex(historyIndex+1);}
  setQuery("");setTagFilter("");setFavoritesOnly(false);setSidebarOpen(false);
 }
 function select(id:string){setSelected(id);}
 function update(patch:Partial<Asset>){
  const id=selected?.id;if(!id)return;
  setAssets(prev=>prev.map(a=>a.id===id?{...a,...patch,id:a.id}:a));
 }
 async function copy(value:string,message:string){try{await copyText(value);setNotice(message);}catch{setNotice("复制失败，请手动选择文字复制");}}
 function clearFilters(){setQuery("");setTagFilter("");setFavoritesOnly(false);}
 function toggleDelete(){
  if(!selected)return;
  update({deleted:!selected.deleted});
  setNotice(selected.deleted?"素材已恢复":"已移到回收站，可随时恢复");
  setInspectorOpen(false);
 }
 function createFolder(name:string){
  const clean=name.trim();
  if(!clean)return '请输入文件夹名称';
  const reserved=[...customFolders,...categoryNames,...categoryNames.map(categoryLabel),'工作台','笔记','白板','重大事件','全部','未分类','待分类','未标签','收藏','回收站','标签管理'];
  if(reserved.some(v=>v.toLowerCase()===clean.toLowerCase()))return '这个文件夹名称已存在，请换一个名称';
  if(clean.length>40)return '文件夹名称不能超过 40 个字';
  const folders=[...customFolders,clean];
  try{localStorage.setItem(folderStorageKey,JSON.stringify(folders));}catch{return '文件夹未保存，浏览器存储暂时不可用';}
  setCustomFolders(folders);navigate(clean);setNotice('文件夹已创建');
 }
 async function importImages(files:File[],urls:string[]=[]){
  if(importLock.current){setNotice('正在导入图片，请稍候');return;}
  if(files.length+urls.length>30){setNotice('一次最多导入 30 张图片');return;}
  importLock.current=true;setImporting(true);
  const folder=targetFolder;
  const imported:Asset[]=[];const errors:string[]=[];
  try{
   for(const file of files){try{imported.push(await assetFromFile(file,folder));}catch(e){errors.push(e instanceof Error?e.message:'图片读取失败');}}
   for(const url of urls){try{imported.push(await assetFromFile(await fileFromUrl(url),folder,/^https?:/i.test(url)?url:''));}catch(e){errors.push(e instanceof Error?e.message:'网页图片读取失败');}}
   if(imported.length){setAssets(prev=>[...imported,...prev]);navigate(folder);setSelected(imported[0].id);setAddOpen(false);}
   setNotice(errors.length?`${imported.length?`已导入 ${imported.length} 张；`:''}${errors.length} 张未导入：${errors[0]}`:`已导入 ${imported.length} 张图片到「${categoryLabel(folder)}」`);
  }finally{importLock.current=false;setImporting(false);if(input.current)input.current.value='';}
 }
 const importCurrent=useRef(importImages);importCurrent.current=importImages;
 useEffect(()=>{
  function pasteImage(e:ClipboardEvent){
   if(isWhiteboard||isEvents)return;
   const target=e.target instanceof Element?e.target:null;
   if(target?.closest('input,textarea,[contenteditable="true"],[role="dialog"]'))return;
   const files=Array.from(e.clipboardData?.files||[]).filter(f=>f.type.startsWith('image/'));
   if(files.length){e.preventDefault();void importCurrent.current(files);}
  }
  window.addEventListener('paste',pasteImage);return()=>window.removeEventListener('paste',pasteImage);
 },[isWhiteboard,isEvents]);
 function receiveDrop(data:DataTransfer){
  const files=Array.from(data.files);
  const urls=files.length?[]:droppedImageUrls(data);
  if(files.length||urls.length)void importImages(files,urls);else setNotice('请拖入图片本身，或复制图片后粘贴');
 }
 const inspector=<Inspector asset={selected} customFolders={customFolders} onUpdate={update} onCopy={copy} onPreview={()=>setPreview(selected?.id??null)} onDelete={toggleDelete} saveError={saveError} generator={generator}/>;
 function openAdd(mode:'add'|'folder'|'paste'='add'){setAddMode(mode);setAddOpen(true);}

 return <div className={cn("app-window",(inspectorHidden||!isLibrary)&&"inspector-is-hidden",isHome&&'is-home',sidebarCollapsed&&'sidebar-is-collapsed')}>
  <aside className="desktop-sidebar"><Sidebar assets={assets} current={current} customFolders={customFolders} onNavigate={navigate} onAdd={()=>openAdd()} collapsed={sidebarCollapsed} onToggleCollapse={()=>setSidebarCollapsed(value=>!value)}/></aside>
  <main className="workspace">
   {isWhiteboard?null:isHome||isNotes||isEvents?<IconButton label="打开文件夹导航" className="home-mobile-nav-toggle" onClick={()=>setSidebarOpen(true)}><PanelLeft size={19}/></IconButton>:<header className="workspace-toolbar">
    <div className="toolbar-leading"><IconButton label="打开文件夹导航" className="mobile-nav-toggle" onClick={()=>setSidebarOpen(true)}><PanelLeft size={19}/></IconButton><IconButton label="后退" disabled={historyIndex===0} onClick={()=>{setHistoryIndex(i=>i-1);clearFilters();}}><ChevronLeft size={21}/></IconButton><IconButton label="前进" disabled={historyIndex===history.length-1} onClick={()=>{setHistoryIndex(i=>i+1);clearFilters();}}><ChevronRight size={21}/></IconButton><h1>{categoryLabel(current)}</h1></div>
    <label className="size-slider" title="调整缩略图大小"><span className="sr-only">缩略图每行数量</span><input aria-label="缩略图每行数量" type="range" min="2" max="6" step="1" value={8-columns} onChange={e=>setColumns(8-Number(e.target.value))}/></label>
    <div className="toolbar-actions"><IconButton label={layout==="masonry"?"切换为规则网格":"切换为瀑布流"} aria-pressed={layout==="grid"} onClick={()=>setLayout(v=>v==="masonry"?"grid":"masonry")}>{layout==="masonry"?<Columns3 size={19}/>:<Grid2X2 size={19}/>}</IconButton><IconButton label="切换名称排序" onClick={()=>setSort(v=>v==="default"?"az":v==="az"?"za":"default")}>{sort==="za"?<ArrowUpAZ size={19}/>:<ArrowDownAZ size={19} className={cn(sort!=="default"&&"active-icon")}/>}</IconButton><IconButton label="显示筛选" aria-expanded={filtersOpen} aria-pressed={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}><Filter size={19}/></IconButton></div>
    <div className="search-field"><Search size={17}/><input ref={search} value={query} onChange={e=>{if(isHome)navigate('全部');setQuery(e.target.value);}} aria-label="搜索素材" placeholder="搜索"/>{query&&<IconButton label="清空搜索" onClick={()=>setQuery("")}><X size={14}/></IconButton>}</div>
    <IconButton label={inspectorHidden?"显示素材详情":"切换素材详情"} className="inspector-toggle" onClick={()=>{if(window.innerWidth<=700)setInspectorOpen(true);else setInspectorHidden(v=>!v);}}><PanelRight size={19}/></IconButton>
   </header>}
   {isLibrary&&<PinterestLibrary assets={assets} state={pinterest} batch={batch}/>}
   {filtersOpen&&isLibrary&&<div className="filter-toolbar"><span className="filter-label"><SlidersHorizontal size={14}/>筛选</span><button className={cn("filter-chip",favoritesOnly&&"active")} aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(v=>!v)}><Star size={13}/>仅收藏</button><select aria-label="按标签筛选" value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="">全部标签</option>{tagList.map(t=><option key={t}>{t}</option>)}</select><button className="clear-filter" onClick={clearFilters}>重置</button></div>}
   {current==="标签管理"&&<div className="tag-browser"><span>按标签浏览</span>{tagList.map(t=><button className={cn("chip",tagFilter===t&&"chip-blue")} key={t} onClick={()=>setTagFilter(v=>v===t?"":t)}>{t}<small>{assets.filter(a=>!a.deleted&&a.tags.includes(t)).length}</small></button>)}</div>}
   <div className={cn('gallery-import-zone',dragging&&'is-dragging')} onDragEnter={e=>{if(!isNotes&&!isWhiteboard&&!isEvents&&e.dataTransfer.types.some(t=>['Files','text/uri-list','text/html','text/plain'].includes(t))){e.preventDefault();dragDepth.current++;setDragging(true);}}} onDragOver={e=>{if(!isNotes&&!isWhiteboard&&!isEvents){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDragLeave={e=>{if(isNotes||isWhiteboard||isEvents)return;e.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}} onDrop={e=>{if(isNotes||isWhiteboard||isEvents)return;e.preventDefault();dragDepth.current=0;setDragging(false);receiveDrop(e.dataTransfer);}}>
    {!isWhiteboard&&(isEvents?<MajorEvents/>:isNotes?<Notebook/>:isHome?<Workbench assets={assets} customFolders={customFolders} onNavigate={navigate} onPreview={id=>{setSelected(id);setPreview(id);}} onAdd={openAdd} onAddToFolder={folder=>{navigate(folder);openAdd();}} onOpenNotes={(folder,id)=>{navigate('笔记');notes.selectFolder(folder);if(id)notes.select(id);}}/>:<Gallery assets={filtered} selectedId={selectedId} onSelect={select} onPreview={setPreview} columns={columns} layout={layout} onClear={clearFilters}/>) }
    {whiteboardVisited&&<Whiteboard active={isWhiteboard} onOpenNavigation={()=>setSidebarOpen(true)}/>}
    {dragging&&<div className="gallery-drop-overlay"><ImagePlus size={36} strokeWidth={1.2}/><strong>松开以导入图片</strong><span>保存到「{categoryLabel(targetFolder)}」</span></div>}
    {importing&&<div className="image-import-progress" role="status">正在导入图片…</div>}
   </div>
  </main>
  <aside className="desktop-inspector" aria-label="素材属性">{inspector}</aside>
  <input className="sr-only" type="file" ref={input} multiple aria-label="导入本地图片" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)void importImages(files);}}/>
  <Modal open={sidebarOpen} onClose={()=>setSidebarOpen(false)} title="文件夹导航" className="sidebar-modal"><Sidebar assets={assets} current={current} customFolders={customFolders} onNavigate={navigate} onAdd={()=>{setSidebarOpen(false);openAdd();}} onClose={()=>setSidebarOpen(false)}/></Modal>
  <Modal open={inspectorOpen} onClose={()=>setInspectorOpen(false)} title="素材详情" className="inspector-modal"><Inspector asset={selected} customFolders={customFolders} onUpdate={update} onCopy={copy} onPreview={()=>setPreview(selected?.id??null)} onDelete={toggleDelete} onClose={()=>setInspectorOpen(false)} saveError={saveError} generator={generator}/></Modal>
  <div className="add-content-host" onDrop={e=>{e.preventDefault();receiveDrop(e.dataTransfer);}} onDragOver={e=>e.preventDefault()}><AddContent open={addOpen} initialMode={addMode} onClose={()=>setAddOpen(false)} onFiles={files=>void importImages(files)} onCreateFolder={createFolder} onError={setNotice} folderLabel={categoryLabel(targetFolder)} busy={importing}/></div>
  <ModelConnectionDialog state={generator}/>
  <SelectionNotes/>
  <CloudAccount/>
  <DailyPodcasts/>
  <Preview asset={preview} onClose={()=>setPreview(null)}/>
  <div className={cn("toast",notice&&"visible")} role="status" aria-live="polite">{notice&&<><Check size={16}/>{notice}</>}</div>
  {saveError&&<div className="storage-error" role="alert">浏览器存储空间不足或不可用，更改暂未保存。请减少导入图片。</div>}
 </div>;
}
