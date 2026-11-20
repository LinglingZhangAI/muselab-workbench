import {useId,useState} from 'react';
import {ArrowDown,Check,LoaderCircle,Settings2,Sparkles,X} from 'lucide-react';
import {Modal} from '@/components/dialogs';
import {IconButton} from '@/components/ui/icon-button';
import type {ModelConnection,PromptGeneratorState} from '@/lib/use-prompt-generator';

export function PromptGenerator({state,onCopy}:{state:PromptGeneratorState;onCopy:(value:string,message:string)=>void}) {
 const id=useId();
 return <div className="prompt-generator">
  <div className="generator-heading"><span><Sparkles size={14}/>UI Prompt</span><button className="generator-settings" onClick={()=>state.setSettingsOpen(true)} title="配置图片识别模型"><Settings2 size={13}/>{state.configured?'模型设置':'连接模型'}</button></div>
  <p className="generator-description">从当前图片提取布局、样式与交互规范</p>
  <div className="generate-action-row"><button className="generate-button" disabled={state.loading} aria-busy={state.loading} onClick={()=>void state.generate()}>{state.loading?<LoaderCircle className="spinning" size={15}/>:<Sparkles size={15}/>}<span>{state.loading?'正在分析图片…':'从图片生成 UI Prompt'}</span></button>{state.loading&&<button className="generator-cancel" onClick={state.cancel}>取消</button>}</div>
  <details className="generation-options"><summary>补充要求 <span>可选</span></summary><label className="sr-only" htmlFor={id+'-preference'}>生成偏好</label><textarea id={id+'-preference'} value={state.preference} maxLength={1500} onChange={e=>state.setPreference(e.target.value)} placeholder="例如：保留布局，改为浅色主题；使用 React" rows={2}/></details>
  {state.loading&&<p className="generation-progress" role="status">正在识别 UI 分类与视觉特征，结果将先保存为草稿。</p>}
  {state.error&&<p className="generation-error" role="alert">{state.error}</p>}
  {state.draft&&!state.draft.isUI&&<div className="generation-not-ui" role="status"><strong>这张图片暂未识别到 UI</strong><p>{state.draft.summary}</p><span>请导入网页、App 或组件截图后再试。</span></div>}
  {state.draft?.isUI&&<div className="generated-draft">
   <div className="draft-heading"><span><Check size={13}/>生成草稿</span><IconButton label="丢弃生成草稿" onClick={()=>state.setDraft(null)}><X size={14}/></IconButton></div>
   <p className="draft-category">{state.draft.category}</p><p className="draft-summary">{state.draft.summary}</p>
   <label className="sr-only" htmlFor={id+'-draft'}>生成的 UI Prompt 草稿</label><textarea id={id+'-draft'} className="draft-textarea" value={state.draft.prompt} onChange={e=>{const value=e.target.value;state.setDraft(draft=>draft?{...draft,prompt:value}:null);}}/>
   <p className="draft-note">可先编辑草稿，应用后替换下方提示词。</p>
   <div className="draft-actions"><button className="draft-copy" onClick={()=>state.draft&&onCopy(state.draft.prompt,'草稿已复制')}>复制草稿</button><button className="draft-apply" disabled={!state.draft.prompt.trim()} onClick={state.apply}><ArrowDown size={13}/>应用到提示词</button></div>
  </div>}
 </div>;
}

function ConnectionForm({state}:{state:PromptGeneratorState}) {
 const id=useId();
 const [value,setValue]=useState<ModelConnection>(state.connection??{baseUrl:'https://api.openai.com/v1',model:'gpt-4.1-mini',apiKey:''});
 const [error,setError]=useState('');
 function submit(e:React.FormEvent){
  e.preventDefault();
  try{const url=new URL(value.baseUrl.trim());if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error();}catch{setError('请填写有效的 HTTPS Base URL');return;}
  if(!value.apiKey.trim()||!value.model.trim()){setError('请填写 API Key 和支持图片识别的模型名称');return;}
  state.saveConnection({baseUrl:value.baseUrl.trim().replace(/\/$/,''),model:value.model.trim(),apiKey:value.apiKey.trim()});
 }
 return <form onSubmit={submit} className="model-connection-form">
  <label htmlFor={id+'-url'}>接口地址 <span>OpenAI 兼容 Base URL</span></label><input className="field" id={id+'-url'} type="url" required value={value.baseUrl} onChange={e=>setValue({...value,baseUrl:e.target.value})} placeholder="https://api.openai.com/v1" autoComplete="off"/>
  <label htmlFor={id+'-model'}>视觉模型</label><input className="field" id={id+'-model'} required value={value.model} onChange={e=>setValue({...value,model:e.target.value})} placeholder="支持图片识别的模型名称" autoComplete="off"/>
  <label htmlFor={id+'-key'}>API Key</label><input className="field" id={id+'-key'} type="password" required value={value.apiKey} onChange={e=>setValue({...value,apiKey:e.target.value})} placeholder="填写你的 API Key" autoComplete="off" spellCheck={false}/>
  <p className="connection-note">密钥仅在本次页面会话中使用。点击生成时，当前图片会发送至你配置的模型服务，按该服务的规则计费。</p>
  {error&&<p className="generation-error" role="alert">{error}</p>}
  <div className="connection-actions"><button type="button" className="quiet-button" onClick={()=>state.setSettingsOpen(false)}>取消</button><button type="submit" className="draft-apply">保存并连接</button></div>
 </form>;
}
export function ModelConnectionDialog({state}:{state:PromptGeneratorState}) {
 return <Modal open={state.settingsOpen} onClose={()=>state.setSettingsOpen(false)} title="连接视觉模型" className="model-connection-modal">
  <IconButton className="help-close" label="关闭模型设置" onClick={()=>state.setSettingsOpen(false)}><X size={19}/></IconButton>
  <div className="connection-icon"><Sparkles size={21}/></div><h2>连接视觉模型</h2><p className="connection-intro">让 UI 截图变成可直接用于开发的实现提示词。</p>
  {state.configured&&<p className="connection-existing">当前已配置：{state.model}。保存新设置后将使用新模型。</p>}
  <ConnectionForm state={state}/>
 </Modal>;
}
