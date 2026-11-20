import {useEffect,useRef,useState} from 'react';
import type {Asset} from '@/data/assets';
export type ModelConnection={baseUrl:string;model:string;apiKey:string};
export type PromptDraft={isUI:boolean;category:string;categorySlug?:string;summary:string;prompt:string;model:string;assetId:string;originalPrompt:string};

export async function imageData(url:string,signal:AbortSignal):Promise<string> {
 const res=await fetch(url,{signal});if(!res.ok)throw new Error('无法读取当前图片，请重新导入');
 const blob=await res.blob();if(blob.size>3*1024*1024)throw new Error('请使用 3 MB 以内的图片');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);});
}
export function usePromptGenerator(asset:Asset|null,onApply:(id:string,prompt:string,original:string,result:PromptDraft)=>boolean) {
 const [server,setServer]=useState({configured:false,model:''});
 const [statusError,setStatusError]=useState('');
 const [connection,setConnection]=useState<ModelConnection|null>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [draft,setDraft]=useState<PromptDraft|null>(null);
 const [error,setError]=useState('');
 const [preference,setPreference]=useState('');
 const controller=useRef<AbortController|null>(null);
 const generation=useRef(0);
 const activeId=useRef(asset?.id);activeId.current=asset?.id;
 const pendingGeneration=useRef<string|null>(null);
 useEffect(()=>{const abort=new AbortController();fetch('/api/ui-prompt/status',{signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(typeof data.configured!=='boolean')throw new Error();setServer(data);}).catch(()=>{if(!abort.signal.aborted)setStatusError('生成服务未连接，请刷新页面重试');});return()=>abort.abort();},[]);
 useEffect(()=>{generation.current++;controller.current?.abort();pendingGeneration.current=null;setLoading(false);setDraft(null);setError('');},[asset?.id,asset?.imageUrl]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const configured=!!connection||server.configured;
 function cancel(){generation.current++;controller.current?.abort();setLoading(false);}
 async function generate(override?:ModelConnection) {
  if(!asset)return;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  const version=++generation.current;
  setLoading(true);setError('');setStatusError('');setDraft(null);
  const original={id:asset.id,prompt:asset.prompt};
  try{
   const image=await imageData(asset.imageUrl,abort.signal);
   if(abort.signal.aborted)return;
   const response=await fetch('/api/ui-prompt/generate',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({image,preference,connection:override??connection??undefined})});
   const result=await response.json();
   if(abort.signal.aborted||version!==generation.current||activeId.current!==original.id)return;
   if(response.status===503&&result.code==='NOT_CONFIGURED'){
    pendingGeneration.current=original.id;setError('生成服务尚未连接视觉模型。保存连接后会自动继续生成。');setSettingsOpen(true);return;
   }
   if(!response.ok)throw new Error(result.error||'生成失败，请重试');
   if(typeof result.isUI!=='boolean'||typeof result.prompt!=='string'||typeof result.summary!=='string')throw new Error('模型返回格式异常，请重试');
   if(version!==generation.current||activeId.current!==original.id)return;
   setDraft({...result,assetId:original.id,originalPrompt:original.prompt});
  }catch(e){if(!abort.signal.aborted&&version===generation.current)setError(e instanceof Error?e.message:'生成失败，请重试');}
  finally{if(version===generation.current)setLoading(false);}
 }
 function apply(){
  if(!draft?.isUI||!draft.prompt.trim()||activeId.current!==draft.assetId)return;
  if(onApply(draft.assetId,draft.prompt,draft.originalPrompt,draft)){setDraft(null);setError('');}
  else setError('原提示词在生成后已修改。为保留你的编辑，请复制草稿，或重新生成后应用。');
 }
 function saveConnection(value:ModelConnection){const resume=pendingGeneration.current===activeId.current;pendingGeneration.current=null;cancel();setConnection(value);setSettingsOpen(false);setError('');if(resume)void generate(value);}
 return {configured,model:connection?.model||server.model,connection,settingsOpen,setSettingsOpen,saveConnection,loading,draft,setDraft,error:error||statusError,preference,setPreference,generate,cancel,apply};
}
export type PromptGeneratorState=ReturnType<typeof usePromptGenerator>;
