import {useEffect,useRef,useState,type KeyboardEvent} from "react";
import {ImageOff,SearchX,Star} from "lucide-react";
import type {Asset} from "@/data/assets";
import {cn} from "@/lib/utils";
export function Gallery({assets,selectedId,onSelect,onPreview,columns,layout,onClear}:{assets:Asset[];selectedId:string|null;onSelect:(id:string)=>void;onPreview:(id:string)=>void;columns:number;layout:"masonry"|"grid";onClear:()=>void}) {
 const root=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(1000);
 useEffect(()=>{if(!root.current)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(root.current);return()=>observer.disconnect();},[]);
 const actual=Math.max(1,Math.min(columns,Math.floor((width+18)/160)||1));
 const nodes=useRef(new Map<string,HTMLButtonElement>());
 function navigate(event:KeyboardEvent<HTMLButtonElement>,id:string) {
  const index=assets.findIndex(a=>a.id===id);let next=index;
  if(event.key==="ArrowRight")next=Math.min(assets.length-1,index+1);
  else if(event.key==="ArrowLeft")next=Math.max(0,index-1);
  else if(event.key==="ArrowDown")next=Math.min(assets.length-1,index+actual);
  else if(event.key==="ArrowUp")next=Math.max(0,index-actual);
  else if(event.key==="Home")next=0;
  else if(event.key==="End")next=assets.length-1;
  else return;
  event.preventDefault();onSelect(assets[next].id);nodes.current.get(assets[next].id)?.focus();
 }
 function card(asset:Asset){
  return <button key={asset.id} ref={el=>{if(el)nodes.current.set(asset.id,el);else nodes.current.delete(asset.id);}} className={cn("asset-card",selectedId===asset.id&&"selected")} style={{aspectRatio:layout==="grid"?"1 / 1":asset.width+" / "+asset.height}} aria-label={asset.title} aria-pressed={selectedId===asset.id} aria-haspopup="dialog" onClick={()=>{onSelect(asset.id);onPreview(asset.id);}} onKeyDown={e=>navigate(e,asset.id)}>
   <AssetImage asset={asset}/>
   {asset.favorite&&<span className="card-star"><Star size={13} fill="currentColor"/></span>}
   <span className="card-caption">{asset.title}</span>
  </button>;
 }
 return <div className="gallery-body" ref={root}>
  {!assets.length?<div className="empty-gallery"><SearchX size={38} strokeWidth={1}/><h2>没有找到素材</h2><p>试试其他关键词，或清除当前筛选。</p><button className="quiet-button" onClick={onClear}>清除筛选</button></div>:layout==="grid"?<div className="asset-grid" style={{gridTemplateColumns:`repeat(${actual}, minmax(0,1fr))`}}>{assets.map(card)}</div>:<div className="masonry-grid" style={{gridTemplateColumns:`repeat(${actual}, minmax(0,1fr))`}}>{Array.from({length:actual},(_,column)=><div className="masonry-column" key={column}>{assets.filter((_,i)=>i%actual===column).map(card)}</div>)}</div>}
 </div>;
}
export function AssetImage({asset}:{asset:Asset}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[asset.imageUrl]);
 return failed?<span className="image-fallback"><ImageOff size={28}/><span>图片暂不可用</span></span>:<img src={asset.imageUrl} alt="" draggable={false} onError={()=>setFailed(true)}/>;
}
