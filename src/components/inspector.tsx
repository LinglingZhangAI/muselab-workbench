import {useEffect,useId,useState} from "react";
import {Check,Copy,Expand,ExternalLink,Link2,Plus,RotateCcw,Star,Trash2,X} from "lucide-react";
import type {Asset} from "@/data/assets";
import {IconButton} from "@/components/ui/icon-button";
import {AssetImage} from "@/components/gallery";
import {cn} from "@/lib/utils";
import {PromptGenerator} from '@/components/prompt-generator';
import type {PromptGeneratorState} from '@/lib/use-prompt-generator';
import {categoryNames,categoryLabel} from '@/data/categories';
export function Inspector({asset,onUpdate,onCopy,onPreview,onDelete,onClose,saveError,generator,customFolders=[]}:{asset:Asset|null;onUpdate:(patch:Partial<Asset>)=>void;onCopy:(text:string,message:string)=>void;onPreview:()=>void;onDelete:()=>void;onClose?:()=>void;saveError:boolean;generator:PromptGeneratorState;customFolders?:string[]}) {
 const fieldId=useId();
 const [adding,setAdding]=useState(false);
 const [tag,setTag]=useState("");
 useEffect(()=>{setAdding(false);setTag("");},[asset?.id]);
 if(!asset)return <div className="inspector-empty"><p>选择一张图片</p><span>查看提示词、标签与素材信息</span></div>;
 const addTag=()=>{const clean=tag.trim();if(clean&&!asset.tags.includes(clean))onUpdate({tags:[...asset.tags,clean]});setTag("");setAdding(false);};
 const safeSource=/^https?:\/\//i.test(asset.sourceUrl);
 return <div className="inspector-content" key={asset.id}>
  <div className="inspector-top"><span>素材详情</span><div><IconButton label={asset.favorite?"取消收藏":"收藏素材"} aria-pressed={asset.favorite} onClick={()=>onUpdate({favorite:!asset.favorite})}><Star size={17} className={cn(asset.favorite&&"is-favorite")} fill={asset.favorite?"currentColor":"none"}/></IconButton>{onClose&&<IconButton label="关闭素材详情" onClick={onClose}><X size={19}/></IconButton>}</div></div>
  <button className="inspector-preview" aria-label="预览大图" onClick={onPreview}><AssetImage asset={asset}/><span className="format-badge">{asset.format}</span><span className="expand-hint"><Expand size={18}/></span></button>
  <label className="sr-only" htmlFor={fieldId+'-title'}>素材名称</label>
  <input id={fieldId+'-title'} className="field title-field" value={asset.title} onChange={e=>onUpdate({title:e.target.value})} onBlur={()=>{if(!asset.title.trim())onUpdate({title:"未命名素材"});}}/>
  {asset.analysisStatus==='non-ui'&&<p className="non-ui-label">非 UI 素材 · 已保留图片，不生成界面实现 Prompt</p>}
  <div className="prompt-field-wrap"><PromptGenerator state={generator} onCopy={onCopy}/><label className="current-prompt-label" htmlFor={fieldId+'-prompt'}>当前提示词</label><textarea id={fieldId+'-prompt'} aria-label="Prompt 提示词" className="field prompt-field" value={asset.prompt} placeholder="从图片生成，或在这里写下 UI 实现提示词…" onChange={e=>onUpdate({prompt:e.target.value})}/><div className="prompt-actions"><span><Check size={12}/>{saveError?"未保存 · 存储不可用":"自动保存到本机"}</span><button onClick={()=>onCopy(asset.prompt,"提示词已复制")} className="copy-prompt" disabled={!asset.prompt.trim()}><Copy size={13}/>复制</button></div></div>
  <div className="source-field"><label className="sr-only" htmlFor={fieldId+'-source'}>来源链接</label><input id={fieldId+'-source'} value={asset.sourceUrl} onChange={e=>onUpdate({sourceUrl:e.target.value})} placeholder="添加来源链接"/>{safeSource?<a href={asset.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开素材来源" title="打开素材来源"><Link2 size={18}/></a>:<span className="source-disabled" title="输入 http 或 https 链接"><Link2 size={18}/></span>}</div>
  <section className="metadata-section"><h2>标签</h2><div className="chips">{asset.tags.map((name,index)=><span className={cn("chip",index%2===1&&"chip-blue")} key={name}>{name}<button aria-label={"移除标签 "+name} onClick={()=>onUpdate({tags:asset.tags.filter(t=>t!==name)})}><X size={13}/></button></span>)}{adding?<form className="add-tag-form" onSubmit={e=>{e.preventDefault();addTag();}}><input autoFocus aria-label="新标签" value={tag} onChange={e=>setTag(e.target.value)} onBlur={addTag} onKeyDown={e=>{if(e.key==="Escape"){setAdding(false);setTag("");}}} placeholder="标签名称"/></form>:<IconButton label="添加标签" onClick={()=>setAdding(true)}><Plus size={18}/></IconButton>}</div></section>
  <section className="metadata-section"><h2>分类</h2><div className="chips"><span className="chip">{categoryLabel(asset.folder)}</span><select aria-label="移动到文件夹" value={asset.folder} onChange={e=>onUpdate({folder:e.target.value})}>{[...new Set([asset.folder,...customFolders,...categoryNames,'待分类','未分类'])].map(name=><option key={name} value={name}>{categoryLabel(name)}</option>)}</select></div></section>
  <section className="metadata-section"><h2>基本信息</h2><dl className="asset-info"><div><dt>尺寸</dt><dd>{asset.width} × {asset.height}</dd></div><div><dt>格式</dt><dd>{asset.format}</dd></div><div><dt>添加时间</dt><dd>{asset.createdAt}</dd></div><div><dt>来源</dt><dd>{asset.sourceUrl.includes('pinterest.com')?'Pinterest 收藏':asset.sourceUrl.includes("microsoft")?"Fluent 3D · MIT":"本地图片"}</dd></div></dl></section>
  <button className={cn("delete-button",asset.deleted&&"restore-button")} onClick={onDelete}>{asset.deleted?<RotateCcw size={15}/>:<Trash2 size={15}/>}<span>{asset.deleted?"恢复素材":"移到回收站"}</span></button>
 </div>;
}
