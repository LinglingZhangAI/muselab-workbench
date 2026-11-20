import {useState} from 'react';
import {Download,FileJson,Image as ImageIcon,LoaderCircle,X} from 'lucide-react';
import {exportToBlob,serializeAsJSON} from '@excalidraw/excalidraw';
import type {ExcalidrawImperativeAPI} from '@excalidraw/excalidraw/types';
import {Modal} from './dialogs';
import {IconButton} from './ui/icon-button';
import {pmResearchId,pmSections} from '@/lib/pm-whiteboard';
import {ExportScope} from './export-scope';

export function WhiteboardExport({open,onClose,editor,section,researches=[]}:{open:boolean;onClose:()=>void;editor:ExcalidrawImperativeAPI|null;section:string;researches?:{id:string;label:string}[]}){
 const [scope,setScope]=useState('current');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function download(format:'png'|'excalidraw'){
  if(!editor||busy)return;setBusy(true);setError('');
  try{
   const visible=editor.getSceneElements().filter(e=>!e.isDeleted);const state=editor.getAppState();
   const current=scope==='current'?section:scope;
   const selected=scope==='selection'?visible.filter(e=>state.selectedElementIds[e.id]):scope==='all'?visible:visible.filter(e=>current.startsWith('research:')?e.customData?.researchJob===current.slice(9):e.customData?.pmResearch===pmResearchId&&e.customData.pmSection===current);
   if(!selected.length)throw new Error('该范围没有可导出的内容，请切换范围或先选中图形。');
   // A scoped export should contain only its referenced image files.
   const files=editor.getFiles();const usedFiles=Object.fromEntries(selected.flatMap(e=>e.type==='image'&&e.fileId&&files[e.fileId]?[[e.fileId,files[e.fileId]]]:[]));
   const blob=format==='png'?await exportToBlob({elements:selected,files:usedFiles,appState:{...state,exportBackground:true,exportWithDarkMode:false,exportEmbedScene:false},mimeType:'image/png',maxWidthOrHeight:8192,exportPadding:32}):new Blob([serializeAsJSON(selected,state,usedFiles,'local')],{type:'application/json'});
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='Muselab-'+(scope==='all'?'完整白板':scope==='selection'?'选中内容':pmSections.find(s=>s.id===current)?.label||'竞品分析')+'.'+format;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);onClose();
  }catch(e){setError(e instanceof Error?e.message:'导出失败，请重试');}finally{setBusy(false);}
 }
 return <Modal open={open} onClose={()=>{if(!busy)onClose();}} title="导出" className="whiteboard-export-modal">
  <IconButton label="关闭导出" className="help-close" onClick={onClose} disabled={busy}><X size={19}/></IconButton>
  <h2>导出</h2><ExportScope value={scope} disabled={busy} onChange={value=>{setScope(value);setError('');}} options={[{id:'current',label:'当前研究 / 分区'},{id:'all',label:'完整白板'},{id:'selection',label:'选中内容'},...pmSections,...researches]}/>
  <div className="whiteboard-export-formats"><button disabled={busy} onClick={()=>void download('png')}><ImageIcon size={22}/><span>PNG 图片<small>方便分享，保留白板背景</small></span><Download size={16}/></button><button disabled={busy} onClick={()=>void download('excalidraw')}><FileJson size={22}/><span>白板文件<small>.excalidraw · 包含图片，可继续编辑</small></span><Download size={16}/></button></div>
  {busy&&<p role="status"><LoaderCircle size={14} className="is-spinning"/>正在导出…</p>}{error&&<p className="analysis-error" role="alert">{error}</p>}
 </Modal>;
}
