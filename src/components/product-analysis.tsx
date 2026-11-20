import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpRight,Check,CheckCircle2,ImagePlus,Layers3,LoaderCircle,Sparkles,X} from 'lucide-react';
import {Modal} from './dialogs';
import {IconButton} from './ui/icon-button';
import {readAnalysisImage,type AnalysisImage} from '@/lib/product-analysis';
import type {ResearchJob} from '@/lib/research';

async function request(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw new Error(value.error||'暂时无法连接研究服务');return value;
}
export function ProductAnalysisDialog({open,onClose,onInsert,ready,onStatus}:{open:boolean;onClose:()=>void;onInsert:(value:ResearchJob,focus?:boolean)=>Promise<void>;ready:boolean;onStatus:(value:string)=>void}){
 const [title,setTitle]=useState(''),[requirements,setRequirements]=useState(''),[links,setLinks]=useState(''),[images,setImages]=useState<AnalysisImage[]>([]);
 const [job,setJob]=useState<ResearchJob|null>(null),[history,setHistory]=useState<ResearchJob[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[attached,setAttached]=useState('');
 const input=useRef<HTMLInputElement>(null),requestId=useRef(crypto.randomUUID()),attaching=useRef(''),hydrated=useRef(false),edited=useRef(false);
 const generating=job?.status==='generating',locked=busy||generating;
 const restore=useCallback((item:ResearchJob)=>{setJob(item);setTitle(item.title);setRequirements(item.requirements);setLinks(item.links.join('\n'));setImages([]);setError('');requestId.current=crypto.randomUUID();},[]);
 useEffect(()=>{
  let cancelled=false;
  void request('/api/product-research?latest=1').then((items:ResearchJob[])=>{if(cancelled)return;setHistory(items);if(!hydrated.current){hydrated.current=true;if(!edited.current&&items[0])restore(items[0]);}}).catch(()=>{if(open&&!cancelled)setError('研究记录暂时无法读取，请检查本机服务或重试。');});
  return()=>{cancelled=true;};
 },[open,refresh,restore]);
 useEffect(()=>{
  if(!job||job.status!=='generating')return;let cancelled=false;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const value:ResearchJob=await request('/api/product-research?id='+job.id);if(cancelled)return;setJob(value);setError('');if(value.status==='generating')timer=setTimeout(()=>void poll(),2500);else setRefresh(n=>n+1);}catch{if(!cancelled){setError('连接中断，正在重新查询。已提交的研究会继续。');timer=setTimeout(()=>void poll(),7000);}}};
  timer=setTimeout(()=>void poll(),1500);return()=>{cancelled=true;clearTimeout(timer);};
 },[job?.id,job?.status]);
 useEffect(()=>{onStatus(generating?'AI 正在研究':job?.status==='failed'?'研究未完成':job?.status==='completed'&&attached!==job.id?'研究待放入白板':'');},[job,generating,attached,onStatus]);
 useEffect(()=>{
  if(!ready||job?.status!=='completed'||attached===job.id||attaching.current===job.id)return;
  attaching.current=job.id;void onInsert(job,false).then(()=>setAttached(job.id)).catch(()=>setError('研究已生成，放入白板失败，请点击“查看研究白板”重试。')).finally(()=>{attaching.current='';});
 },[job,ready,onInsert,attached]);
 async function add(files:File[]){
  if(locked||!files.length)return;setError('');edited.current=true;
  if(images.length+files.length>12){setError('最多上传 12 张截图。');return;}
  if(files.reduce((sum,file)=>sum+file.size,0)>40*1024*1024){setError('截图总量不超过 40 MB。');return;}
  setBusy(true);try{const additions:AnalysisImage[]=[];for(const file of files)additions.push(await readAnalysisImage(file));setImages(previous=>[...previous,...additions]);}catch(e){setError(e instanceof Error?e.message:'图片读取失败');}finally{setBusy(false);}
 }
 function move(index:number,delta:number){setImages(previous=>{const next=[...previous];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});}
 async function submit(retry=false){
  if(locked)return;setError('');if(!retry&&requirements.trim().length<10){setError('请用至少 10 个字说明希望分析什么。');return;}
  const urls=links.split(/\n/).map(value=>value.trim()).filter(Boolean);
  if(!retry&&(urls.length>6||urls.some(value=>{try{return new URL(value).protocol!=='https:';}catch{return true;}}))){setError('最多填写 6 个完整 HTTPS 链接，每行一个。');return;}
  setBusy(true);edited.current=true;
  try{
   const value:ResearchJob=await request('/api/product-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(retry?{clientRequestId:requestId.current,retryId:job?.id}:{clientRequestId:requestId.current,template:'competitor',title,requirements,links:urls,images:images.map(image=>({name:image.name,width:image.width,height:image.height,dataURL:image.file.dataURL}))})});
   setJob(value);requestId.current=crypto.randomUUID();setRefresh(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'研究未提交，请重试');}finally{setBusy(false);}
 }
 function startNew(){setJob(null);setTitle('');setRequirements('');setLinks('');setImages([]);setError('');edited.current=true;requestId.current=crypto.randomUUID();}
 async function edit(){
  if(!job||busy)return;setBusy(true);setError('');
  try{const restored=await Promise.all(job.images.map(async image=>{const response=await fetch(image.url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('截图读取失败，请重试');const value=await readAnalysisImage(new File([await response.blob()],image.name,{type:response.headers.get('content-type')||'image/webp'}));return {...value,name:image.name};}));setImages(restored);setJob(null);requestId.current=crypto.randomUUID();}catch{setError('原有截图读取失败，可直接重试生成；材料已保留。');}finally{setBusy(false);}
 }
 return <Modal open={open} onClose={onClose} title="创建产品研究" className="product-analysis-modal">
  <IconButton label="关闭产品研究" className="help-close" onClick={onClose}><X size={19}/></IconButton>
  <p className="analysis-eyebrow">RESEARCH STUDIO</p><h2>从一个问题，开始产品研究。</h2><p className="analysis-intro">告诉 AI 你想研究什么。带上真实页面，让判断有据可循。</p>
  {job?<div className="research-progress">
   <div className={'research-job-state '+job.status}>{generating?<LoaderCircle className="is-spinning" size={23}/>:job.status==='completed'?<CheckCircle2 size={23}/>:<Layers3 size={23}/>}<div><h3>{generating?'正在生成竞品研究':job.status==='completed'?'产品研究已生成':'这次研究尚未完成'}</h3><p role="status">{job.message}</p></div></div>
   <h4>{job.result?.title||job.title||'竞品分析'}</h4><p className="research-requirements">{job.requirements}</p>
   {!!job.images.length&&<div className="research-evidence-preview">{job.images.map(image=><figure key={image.id}><img src={image.url} alt={image.name}/><figcaption>{image.id} · {image.name}</figcaption></figure>)}</div>}
   {job.result&&<p className="research-summary">{job.result.summary}</p>}
   {generating&&<p className="research-hint">可以关闭窗口继续工作，完成后会放入白板。通常需要 1–4 分钟。</p>}
   {error&&<p className="analysis-error" role="alert">{error}</p>}
   <div className="research-job-actions">{!generating&&<button type="button" className="research-secondary" disabled={busy} onClick={startNew}>新建研究</button>}{job.status==='failed'&&<><button type="button" className="research-secondary" disabled={busy} onClick={()=>void edit()}>修改要求</button><button className="analysis-submit" disabled={busy} onClick={()=>void submit(true)}>{busy?<LoaderCircle size={15} className="is-spinning"/>:<Sparkles size={15}/>}重试生成</button></>}{job.status==='completed'&&<button className="analysis-submit" disabled={!ready||busy} onClick={()=>{setBusy(true);void onInsert(job,true).then(()=>{setAttached(job.id);onClose();}).catch(()=>setError('暂时无法放入白板，请重试')).finally(()=>setBusy(false));}}>查看研究白板<ArrowUpRight size={15}/></button>}</div>
  </div>:<form onSubmit={event=>{event.preventDefault();void submit();}} onChange={()=>{edited.current=true;requestId.current=crypto.randomUUID();}}>
   <fieldset className="research-template" disabled={locked}><legend>01 <span>选择模板</span></legend><label><input type="radio" name="research-template" value="competitor" defaultChecked/><Layers3 size={21}/><span>竞品分析<small>产品对照 / 页面拆解 / 机会与验证</small></span><Check size={16}/></label></fieldset>
   <div className="research-inputs"><label>02 <span>分析要求</span><textarea required minLength={10} maxLength={6000} rows={4} disabled={locked} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="例如：对比 Krea 和其他 AI 创作产品的首次使用体验。面向新手设计师，重点分析任务入口、生成前的预期管理，以及哪些做法值得借鉴。"/><small>说明产品、目标用户、关注的问题，以及希望做出的决策。</small></label>
    <div className="analysis-fields"><label>研究主题 <small>选填</small><input maxLength={120} value={title} disabled={locked} onChange={e=>setTitle(e.target.value)} placeholder="留空时由 AI 提炼标题"/></label><label>参考链接 <small>选填，每行一个</small><textarea rows={2} disabled={locked} value={links} onChange={e=>setLinks(e.target.value)} placeholder="https://mobbin.com/screens/…"/><small>保存来源索引；分析以要求与截图为依据。</small></label></div>
   </div>
   <div className="research-upload-label">03 <span>参考截图</span><small>选填</small></div>
   <div className="analysis-upload" tabIndex={0} role="group" aria-label="参考截图上传" onDragOver={e=>{e.preventDefault();e.stopPropagation();}} onDrop={e=>{e.preventDefault();e.stopPropagation();void add(Array.from(e.dataTransfer.files));}} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();e.stopPropagation();void add(files);}}}>
    <button type="button" disabled={locked} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="is-spinning" size={20}/>:<ImagePlus size={21}/>}<span>{busy?'正在准备截图…':'上传产品页面'}</span></button><small>拖入、粘贴或点击上传 · 最多 12 张</small><input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" aria-label="选择产品页面截图" disabled={locked} onChange={e=>{void add(Array.from(e.target.files||[]));e.target.value='';}}/>
   </div>
   {!!images.length&&<ol className="analysis-image-list">{images.map((image,index)=><li key={image.file.id}><img src={image.file.dataURL} alt={image.name}/><span><small>S{index+1}</small><input aria-label={'截图 '+(index+1)+' 产品及页面名称'} maxLength={160} value={image.name} disabled={locked} onChange={e=>setImages(previous=>previous.map(item=>item===image?{...item,name:e.target.value}:item))}/></span><button type="button" aria-label={'前移截图 '+(index+1)} disabled={!index||locked} onClick={()=>move(index,-1)}><ArrowUp size={14}/></button><button type="button" aria-label={'后移截图 '+(index+1)} disabled={index===images.length-1||locked} onClick={()=>move(index,1)}><ArrowDown size={14}/></button><button type="button" aria-label={'移除截图 '+(index+1)} disabled={locked} onClick={()=>setImages(previous=>previous.filter(item=>item.file.id!==image.file.id))}><X size={14}/></button></li>)}</ol>}
   <p className="research-outline">生成内容 <span>研究结论 · 竞品对照 · 证据拆解 · 方案流程 · 优先级与验证</span></p>
   {error&&<p className="analysis-error" role="alert">{error}</p>}
   <footer><span>生成后可在白板中编辑、补充和导出</span><button type="submit" className="analysis-submit" disabled={locked}><Sparkles size={15}/>生成产品研究</button></footer>
  </form>}
  {!!history.length&&!generating&&<details className="research-history"><summary>最近的研究 <span>{history.length}</span></summary>{history.map(item=><button key={item.id} disabled={busy} onClick={()=>restore(item)}><span>{item.result?.title||item.title||'竞品分析'}</span><small>{item.status==='completed'?'已生成':item.status==='failed'?'未完成':'生成中'}</small></button>)}</details>}
 </Modal>;
}
