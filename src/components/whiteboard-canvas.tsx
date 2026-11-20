import {useCallback,useEffect,useRef,useState} from 'react';
import {CaptureUpdateAction,Excalidraw,getSceneVersion} from '@excalidraw/excalidraw';
import type {AppState,BinaryFiles,ExcalidrawImperativeAPI,ExcalidrawInitialDataState} from '@excalidraw/excalidraw/types';
import type {ExcalidrawElement} from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import {Download,Layers3,PanelLeft,Plus,RefreshCw} from 'lucide-react';
import {IconButton} from './ui/icon-button';
import {ProductAnalysisDialog} from './product-analysis';
import {mobbinAI} from '@/lib/product-analysis';
import {researchElements,researchNavigation} from '@/lib/research-whiteboard';
import type {ResearchJob} from '@/lib/research';
import {readWhiteboard,writeWhiteboard} from '@/lib/whiteboard-storage';
import {cloudStorageEnabled} from '@/lib/cloud-storage';
import {appendPMAnalysis,pmResearchId} from '@/lib/pm-whiteboard';
import {WhiteboardExport} from './whiteboard-export';
import {ResearchNavigator} from './research-navigator';

type SavedScene={elements:readonly ExcalidrawElement[];appState:Partial<AppState>;files:BinaryFiles};
function snapshot(elements:readonly ExcalidrawElement[],state:AppState,files:BinaryFiles):SavedScene{
 return {elements,files,appState:{viewBackgroundColor:state.viewBackgroundColor,scrollX:state.scrollX,scrollY:state.scrollY,zoom:state.zoom,currentItemFontFamily:state.currentItemFontFamily,gridSize:state.gridSize,gridModeEnabled:state.gridModeEnabled}};
}
export default function WhiteboardCanvas({active,onOpenNavigation}:{active:boolean;onOpenNavigation:()=>void}){
 const [initial,setInitial]=useState<ExcalidrawInitialDataState|null>(null);const [loadError,setLoadError]=useState('');
 const [status,setStatus]=useState(cloudStorageEnabled()?'已同步云端':'已保存到本机');const [retry,setRetry]=useState(0);const [dialog,setDialog]=useState(false);
 const [exportOpen,setExportOpen]=useState(false);const [analysisSection,setAnalysisSection]=useState<string>('decision');
 const [researchStatus,setResearchStatus]=useState(''),[navigation,setNavigation]=useState<{id:string;label:string}[]>([]),[editorReady,setEditorReady]=useState(false);
 const preparing=useRef(new Map<string,ReturnType<typeof researchElements>>());const navigationSignature=useRef('');
 const api=useRef<ExcalidrawImperativeAPI|null>(null);const timer=useRef<ReturnType<typeof setTimeout>>();
 const pending=useRef<SavedScene|null>(null);const saving=useRef(false);const signature=useRef('');
 const fitInitial=useRef(false);
 useEffect(()=>{
  let cancelled=false;setLoadError('');
  void readWhiteboard().then(async saved=>{
   if(cancelled)return;
   if(saved&&(typeof saved!=='object'||!Array.isArray((saved as SavedScene).elements)||!(saved as SavedScene).files))throw new Error('白板数据格式异常');
   const previous=(saved||{elements:[],files:{},appState:{viewBackgroundColor:'#fbfaf7',currentItemFontFamily:2}}) as SavedScene;
   const alreadyAdded=previous.elements.some(item=>item.customData?.pmResearch===pmResearchId);
   const next=await appendPMAnalysis(previous.elements,previous.files);
   if(cancelled)return;fitInitial.current=!alreadyAdded;setInitial({...previous,...next});
  }).catch(()=>{if(!cancelled)setLoadError('暂时无法读取白板。请重试，原有内容不会被覆盖。');});
  return()=>{cancelled=true;};
 },[retry]);
 const flush=useCallback(async()=>{
  clearTimeout(timer.current);if(saving.current)return;saving.current=true;
  try{while(pending.current){const scene=pending.current;pending.current=null;try{await writeWhiteboard(scene);}catch{if(!pending.current)pending.current=scene;throw new Error('白板未保存');}}setStatus(cloudStorageEnabled()?'已同步云端':'已保存到本机');}
  catch{setStatus('保存失败，点击重试');}finally{saving.current=false;}
 },[]);
 useEffect(()=>{if(!active)void flush();else api.current?.refresh();},[active,flush]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState==='hidden')void flush();};const leave=(event:BeforeUnloadEvent)=>{if(pending.current||saving.current){void flush();event.preventDefault();event.returnValue='';}};
  document.addEventListener('visibilitychange',hide);window.addEventListener('beforeunload',leave);
  return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('beforeunload',leave);void flush();};
 },[flush]);
 function changed(elements:readonly ExcalidrawElement[],state:AppState,files:BinaryFiles){
  const options=researchNavigation(elements),key=JSON.stringify(options);if(key!==navigationSignature.current){navigationSignature.current=key;setNavigation(options);}
  if(fitInitial.current&&elements.length){fitInitial.current=false;requestAnimationFrame(()=>focusAnalysis('decision'));}
  const scene=snapshot(elements,state,files);const next=getSceneVersion(elements)+'|'+Object.entries(files).map(([id,file])=>id+':'+(file.version||0)).join(',')+'|'+JSON.stringify(scene.appState);
  if(signature.current===next)return;signature.current=next;pending.current=scene;setStatus('正在保存…');clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),450);
 }
 const insert=useCallback(async(job:ResearchJob,focus=false)=>{
  const editor=api.current;if(!editor)throw new Error('白板尚未就绪');
  let items=editor.getSceneElementsIncludingDeleted().filter(item=>item.customData?.researchJob===job.id);
  // Deleted elements count as imported, so removing a research card never resurrects it.
  if(!items.length){
   if(!preparing.current.has(job.id)){const right=Math.max(0,...editor.getSceneElements().map(item=>item.x+Math.abs(item.width)));preparing.current.set(job.id,researchElements(job,right+240));}
   try{
    const result=await preparing.current.get(job.id)!;
    const old=editor.getSceneElementsIncludingDeleted();items=old.filter(item=>item.customData?.researchJob===job.id);
    if(!items.length){items=result.elements;const elements=[...old,...items];editor.addFiles(Object.values(result.files));editor.updateScene({elements,captureUpdate:CaptureUpdateAction.IMMEDIATELY});pending.current=snapshot(elements,editor.getAppState(),{...editor.getFiles(),...result.files});await flush();}
   }finally{preparing.current.delete(job.id);}
  }
  if(focus){setAnalysisSection('research:'+job.id);const first=items.filter(item=>!item.isDeleted&&item.customData?.researchSection==='overview');if(first.length)editor.scrollToContent(first,{fitToContent:true,maxZoom:.9,animate:false});}
 },[flush]);
 function focusAnalysis(id:string){
  const editor=api.current;if(!editor)return;setAnalysisSection(id);
  const items=editor.getSceneElements().filter(e=>id.startsWith('research:')?e.customData?.researchJob===id.slice(9)&&e.customData.researchSection==='overview':e.customData?.pmResearch===pmResearchId&&e.customData.pmSection===id);
  if(items.length)editor.scrollToContent(items,{fitToContent:true,maxZoom:.9,animate:false});
 }
 return <section className="whiteboard-page" aria-label="白板" hidden={!active}>
  <header className="whiteboard-heading research-toolbar"><div className="whiteboard-identity"><IconButton label="打开文件夹导航" className="mobile-nav-toggle" onClick={onOpenNavigation}><PanelLeft size={19}/></IconButton><span className="whiteboard-title-icon"><Layers3 size={19} strokeWidth={1.5}/></span><h1>白板</h1><span className="whiteboard-heading-divider"/><button className={'whiteboard-save'+(status.includes('失败')?' has-error':'')} onClick={()=>void flush()} title="画布保存在当前浏览器，可导出备份" aria-live="polite"><i/>{status}</button></div>
   <div className="whiteboard-actions"><ResearchNavigator value={analysisSection} onChange={focusAnalysis} researches={navigation} disabled={!editorReady}/><a className="whiteboard-mobbin-link" href={mobbinAI} target="_blank" rel="noopener noreferrer" aria-label="在 Mobbin 浏览 AI 产品" title="在 Mobbin 浏览 AI 产品"><svg width="30" height="16" viewBox="0 0 139 64" fill="#000000" aria-hidden="true"><path d="M84.3504 64H48.1695V47.315L32.569 63.9989L0 63.9841V29.9515L28.31 0H67.4439V15.9214L82.6881 0H116.593V26.1874H139V64H99.1163V48.208L84.3504 64Z"/></svg></a><span className="whiteboard-heading-divider"/><button className="whiteboard-analysis-button" disabled={!editorReady} onClick={()=>setDialog(true)}>{researchStatus==='AI 正在研究'?<LoaderIcon/>:<Plus size={15} aria-hidden="true"/>}<span>{researchStatus||'产品分析'}</span></button><button className="whiteboard-export-button" onClick={()=>setExportOpen(true)} disabled={!initial} title="导出 PNG 图片或可编辑白板文件"><Download size={15} aria-hidden="true"/><span>导出</span></button></div>
  </header>
  <div className="whiteboard-canvas">{loadError?<div className="whiteboard-read-error" role="alert"><p>{loadError}</p><button onClick={()=>setRetry(value=>value+1)}><RefreshCw size={14}/>重试读取</button></div>:initial?<Excalidraw initialData={initial} excalidrawAPI={editor=>{api.current=editor;setEditorReady(true);}} onChange={changed} langCode="zh-CN" theme="light" name="Muselab 产品分析" handleKeyboardGlobally={false}/>:<p className="whiteboard-read-error" role="status">正在读取白板…</p>}</div>
  <ProductAnalysisDialog open={dialog} onClose={()=>setDialog(false)} onInsert={insert} ready={editorReady} onStatus={setResearchStatus}/>
  <WhiteboardExport open={exportOpen} onClose={()=>setExportOpen(false)} editor={api.current} section={analysisSection} researches={navigation}/>
 </section>;
}
function LoaderIcon(){return <RefreshCw size={14} className="is-spinning" aria-hidden="true"/>;}
