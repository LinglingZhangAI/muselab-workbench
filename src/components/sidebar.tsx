import {useEffect,useId,useRef,useState} from "react";
import {Archive,Bookmark,ChevronDown,ChevronRight,Folder,GraduationCap,Inbox,Lightbulb,Plus,Search,SlidersHorizontal,Star,Tags,Trash2,BriefcaseBusiness,PanelLeftClose} from "lucide-react";
import {NavigationSymbol} from '@/components/navigation-symbol';
import {folderGroups,type Asset} from "@/data/assets";
import {IconButton} from "@/components/ui/icon-button";
import {cn} from "@/lib/utils";
import {categoryLabel} from '@/data/categories';

export function Sidebar({assets,current,onNavigate,customFolders,onClose,collapsed=false,onToggleCollapse}:{assets:Asset[];current:string;onNavigate:(name:string)=>void;onAdd:()=>void;customFolders:string[];onClose?:()=>void;collapsed?:boolean;onToggleCollapse?:()=>void}) {
 const [open,setOpen]=useState(["custom","pages","components","materials"]);
 const [query,setQuery]=useState("");
 const isLibrary=!['工作台','笔记','白板','重大事件'].includes(current);
 const [directoryOpen,setDirectoryOpen]=useState(isLibrary);
 const panelId=useId();
 const lastLibrary=useRef('全部');
 useEffect(()=>{if(isLibrary){lastLibrary.current=current;setDirectoryOpen(true);}},[current,isLibrary]);
 function go(name:string){onNavigate(name);if(name!=='工作台')setDirectoryOpen(true);}
 const live=assets.filter(a=>!a.deleted);
 const count=(name:string)=> name==="全部"?live.length:name==="未分类"?live.filter(a=>a.folder==="未分类").length:name==="未标签"?live.filter(a=>!a.tags.length).length:name==="收藏"?live.filter(a=>a.favorite).length:name==="回收站"?assets.filter(a=>a.deleted).length:live.filter(a=>a.folder===name).length;
 const shortcuts=[{name:"全部",Icon:Inbox},{name:"未分类",Icon:Archive},{name:"未标签",Icon:Bookmark},{name:"收藏",Icon:Star},{name:"回收站",Icon:Trash2}];
 const Brand=onToggleCollapse?'button':'div';
 return <div className={cn('sidebar-content reference-sidebar',collapsed&&'is-collapsed')}>
  {onClose&&<IconButton className="sidebar-drawer-close" label="关闭文件夹导航" onClick={onClose}><PanelLeftClose size={18}/></IconButton>}
  <Brand className="library-brand" onClick={onToggleCollapse} aria-label={onToggleCollapse?(collapsed?'展开侧栏':'收起侧栏'):undefined} aria-expanded={onToggleCollapse?!collapsed:undefined} title={onToggleCollapse?(collapsed?'展开侧栏':'收起侧栏'):undefined}><img src={import.meta.env.BASE_URL + "favicon.svg"} width="26" height="26" alt="Muselab"/><span>Muselab</span><ChevronDown size={14}/><span className="local-indicator" title="本地资料库"/></Brand>
  <nav aria-label="主导航" className="quick-nav primary-nav">
   <button className={cn('nav-row',current==='工作台'&&'is-current')} aria-label="工作台" data-tooltip="工作台" aria-current={current==='工作台'?'page':undefined} onClick={()=>go('工作台')}><NavigationSymbol kind="home"/><span>工作台</span></button>
   <button className={cn('nav-row',isLibrary&&'is-current')} aria-label="灵感库" data-tooltip="灵感库" aria-current={isLibrary?'page':undefined} aria-expanded={!collapsed&&isLibrary&&directoryOpen} aria-controls={panelId} onClick={()=>{if(collapsed){onToggleCollapse?.();setDirectoryOpen(true);if(!isLibrary)onNavigate(lastLibrary.current);}else if(isLibrary)setDirectoryOpen(value=>!value);else{setDirectoryOpen(true);onNavigate(lastLibrary.current);}}}><NavigationSymbol kind="folder"/><span>灵感库</span><ChevronDown className={cn('library-chevron',isLibrary&&directoryOpen&&'is-open')} size={16}/></button>
  {!collapsed&&isLibrary&&directoryOpen&&<div id={panelId} className="inspiration-directory" aria-label="灵感库目录">
  <nav aria-label="灵感库筛选" className="quick-nav library-nav">
   {shortcuts.map(({name,Icon})=><button key={name} className={cn("nav-row",current===name&&"is-current")} onClick={()=>go(name)} aria-current={current===name?"page":undefined}><Icon size={18} strokeWidth={1.5}/><span>{name}</span><small>{count(name)}</small></button>)}
   <button className={cn("nav-row",current==="标签管理"&&"is-current")} onClick={()=>go("标签管理")}><Tags size={18} strokeWidth={1.5}/><span>标签管理</span><small>{new Set(live.flatMap(a=>a.tags)).size}</small></button>
  </nav>
  <div className="folder-scroll">
   <p className="sidebar-caption folder-label">组件与页面</p>
   {[...(customFolders.length?[{id:'custom',title:'我的文件夹',color:'gray',children:customFolders}]:[]),...folderGroups].map(group=>{
     const visible=group.children.filter(name=>(categoryLabel(name)+' '+name).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>count(b)-count(a));
     if(!visible.length)return null;
     const expanded=open.includes(group.id)||!!query;
     const GroupIcon=group.id==='custom'?Folder:group.id==='pages'?Lightbulb:group.id==='components'?BriefcaseBusiness:GraduationCap;
     return <div className={cn("folder-group",group.color)} key={group.id}>
       <button className="folder-group-toggle" aria-expanded={expanded} onClick={()=>setOpen(values=>values.includes(group.id)?values.filter(v=>v!==group.id):[...values,group.id])}>
        {expanded?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<GroupIcon size={21} strokeWidth={1.5}/><span>{group.title}</span><small>{live.filter(a=>group.children.includes(a.folder)).length}</small>
       </button>
       {expanded&&<div className="folder-children">{visible.map(name=><button key={name} className={cn("nav-row folder-row",current===name&&"is-current")} aria-current={current===name?"page":undefined} onClick={()=>go(name)}><Folder size={18} strokeWidth={1.5}/><span>{categoryLabel(name)}</span><small>{count(name)}</small></button>)}</div>}
     </div>;
   })}
  </div>
  <div className="sidebar-footer"><Search size={16}/><input aria-label="筛选文件夹" placeholder="筛选文件夹" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="清空文件夹筛选" onClick={()=>setQuery("")}><Plus size={15} className="rotate-45"/></IconButton>}<SlidersHorizontal size={15}/></div>
  </div>}
   <button className={cn('nav-row',current==='重大事件'&&'is-current')} aria-label="重大事件" data-tooltip="重大事件" aria-current={current==='重大事件'?'page':undefined} onClick={()=>go('重大事件')}><NavigationSymbol kind="events"/><span>重大事件</span></button>
   <button className={cn('nav-row',current==='笔记'&&'is-current')} aria-label="笔记" data-tooltip="笔记" aria-current={current==='笔记'?'page':undefined} onClick={()=>go('笔记')}><NavigationSymbol kind="notes"/><span>笔记</span></button>
   <button className={cn('nav-row',current==='白板'&&'is-current')} aria-label="白板" data-tooltip="白板" aria-current={current==='白板'?'page':undefined} onClick={()=>go('白板')}><NavigationSymbol kind="whiteboard"/><span>白板</span></button>
  </nav>
 </div>;
}
