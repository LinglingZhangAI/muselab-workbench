import {useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {initialAssets,type Asset} from '@/data/assets';
import {resolveCategory} from '@/data/categories';
import {imageData,type PromptGeneratorState} from './use-prompt-generator';
type ImportJob={running:boolean;processed:number;total:number;added:number;skipped:number;errors:string[]};
export function usePinterestLibrary(setAssets:Dispatch<SetStateAction<Asset[]>>){
 const [job,setJob]=useState<ImportJob>({running:false,processed:0,total:0,added:0,skipped:0,errors:[]});
 const [error,setError]=useState('');
 const [open,setOpen]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch('/api/pinterest/library');if(!response.ok)throw new Error('收藏导入服务未连接，请刷新后重试');
   const data=await response.json();if(!mounted.current)return;
   if(!Array.isArray(data.assets)||!data.job)throw new Error('收藏导入服务返回格式异常');
   setJob(data.job);setError('');
   const imported:Asset[]=data.assets.filter((a:Asset)=>typeof a.id==='string'&&/^\/assets\/pinterest\/[0-9]+\.(webp|png|jpg|avif)$/.test(a.imageUrl)&&typeof a.prompt==='string'&&Array.isArray(a.tags));
   setAssets(previous=>{
    const map=new Map(previous.map(a=>[a.id,a]));let changed=false;
    for(const asset of imported){const existing=map.get(asset.id);if(!existing){map.set(asset.id,asset);changed=true;continue;}const placeholderTitle=/^(其中包括图片：|Pinterest 收藏 )/.test(existing.title);if(!existing.deleted&&!existing.prompt&&existing.analysisStatus==='pending'&&['complete','non-ui'].includes(asset.analysisStatus||'')){map.set(asset.id,{...existing,title:placeholderTitle?asset.title:existing.title,prompt:asset.prompt,folder:asset.folder,tags:asset.tags,analysisStatus:asset.analysisStatus});changed=true;}else if(placeholderTitle&&existing.title!==asset.title){map.set(asset.id,{...existing,title:asset.title});changed=true;}}
    return changed?[...map.values()]:previous;
   });
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'无法读取收藏');}
 },[setAssets]);
 useEffect(()=>{void refresh();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[refresh]);
 useEffect(()=>{if(!job.running)return;const timer=setInterval(()=>void refresh(),2000);return()=>clearInterval(timer);},[job.running,refresh]);
 async function importFile(file:File){
  try{if(file.size>2*1024*1024)throw new Error('采集文件超过 2 MB');const body=JSON.parse(await file.text());const res=await fetch('/api/pinterest/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw new Error(data.error||'导入失败');await refresh();}catch(e){setError(e instanceof Error?e.message:'导入文件无效');}
 }
 return {job,error,open,setOpen,refresh,importFile};
}
export type PinterestLibraryState=ReturnType<typeof usePinterestLibrary>;
export function useBatchPromptGeneration(assets:Asset[],setAssets:Dispatch<SetStateAction<Asset[]>>,generator:PromptGeneratorState){
 const [progress,setProgress]=useState({running:false,done:0,total:0,error:''});
 const abort=useRef<AbortController|null>(null);
 const active=useRef(false);
 const currentAssets=useRef(assets);currentAssets.current=assets;
 const seedIds=new Set(initialAssets.map(a=>a.id));
 const pending=assets.filter(a=>!a.deleted&&!a.prompt&&a.analysisStatus!=='non-ui');
 useEffect(()=>()=>abort.current?.abort(),[]);
 function cancel(){abort.current?.abort();}
 async function start(pinterestOnly=false){
  if(active.current||!pending.length)return;
  if(!generator.configured){generator.setSettingsOpen(true);return;}
  const queue=pinterestOnly?pending.filter(a=>!!a.pinId):[...pending];if(!queue.length)return;active.current=true;const controller=new AbortController();abort.current=controller;
  setProgress({running:true,done:0,total:queue.length,error:''});
  try{
   for(const [index,asset] of queue.entries()){
    if(controller.signal.aborted)break;
    const image=await imageData(asset.imageUrl,controller.signal);
    const response=await fetch('/api/ui-prompt/generate',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({image,connection:generator.connection??undefined,preference:'按 21st.dev 实际分类自动归类，默认生成中文实现提示词。'})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'生成失败');
    if(typeof result.isUI!=='boolean'||(result.isUI&&(typeof result.prompt!=='string'||!result.prompt.trim())))throw new Error('模型返回无效结果，已停止批量生成');
    const patch:Partial<Asset>={prompt:result.isUI?result.prompt:'',folder:result.isUI?resolveCategory(result.category||'',result.categorySlug):'Images',analysisStatus:result.isUI?'complete':'non-ui',tags:[...new Set([...asset.tags,...(result.isUI?['UI']:['非 UI'])])]};
    const current=currentAssets.current.find(a=>a.id===asset.id);
    if(!current||current.deleted||current.prompt!==asset.prompt){setProgress(p=>({...p,done:index+1}));continue;}
    setAssets(previous=>previous.map(a=>a.id===asset.id&&!a.deleted&&a.prompt===asset.prompt?{...a,...patch}:a));
    if(asset.pinId&&!seedIds.has(asset.id)){
     const saved=await fetch('/api/pinterest/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:asset.id,...patch}),signal:controller.signal});
     if(!saved.ok)throw new Error('结果已应用到当前浏览器，但服务器保存失败。请稍后重试。');
    }
    setProgress({running:true,done:index+1,total:queue.length,error:''});
   }
  }catch(e){if(!controller.signal.aborted)setProgress(p=>({...p,error:e instanceof Error?e.message:'批量生成失败'}));}
  finally{active.current=false;setProgress(p=>({...p,running:false}));}
 }
 return {pending:pending.length,progress,start,cancel};
}
export type BatchPromptState=ReturnType<typeof useBatchPromptGeneration>;
