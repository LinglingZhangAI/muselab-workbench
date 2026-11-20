import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Layers3} from 'lucide-react';
import {pmSections} from '@/lib/pm-whiteboard';

export function ResearchNavigator({value,onChange,researches,disabled}:{value:string;onChange:(value:string)=>void;researches:{id:string;label:string}[];disabled:boolean}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({top:0,left:0,maxHeight:500});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 const options=[...pmSections.map(item=>({id:item.id,label:item.label})),...researches];
 const selected=options.find(item=>item.id===value)||options[0];
 function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
 function show(){if(disabled)return;const rect=trigger.current!.getBoundingClientRect();setPosition({top:rect.bottom+8,left:Math.min(Math.max(12,rect.right-292),window.innerWidth-304),maxHeight:Math.max(160,window.innerHeight-rect.bottom-24)});setActive(Math.max(0,options.findIndex(item=>item.id===value)));setOpen(true);}
 useEffect(()=>{
  if(!open)return;
  const pointer=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};
  const resize=()=>setOpen(false);document.addEventListener('pointerdown',pointer);window.addEventListener('resize',resize);
  return()=>{document.removeEventListener('pointerdown',pointer);window.removeEventListener('resize',resize);};
 },[open]);
 useEffect(()=>{if(open)panel.current?.querySelector<HTMLElement>('[data-index="'+active+'"]')?.focus();},[open,active]);
 function choose(index:number){onChange(options[index].id);close(true);}
 return <>
  <button ref={trigger} className={'research-nav-trigger'+(open?' is-open':'')} role="combobox" aria-label="研究导航" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={()=>open?close():show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();show();}}}><Layers3 size={14}/><span>{selected?.label}</span><ChevronDown size={13} className="research-nav-chevron"/></button>
  {open&&createPortal(<div ref={panel} id={id} role="listbox" aria-label="研究导航分区" className="research-nav-panel" style={{top:position.top,left:position.left,maxHeight:position.maxHeight}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==trigger.current)setOpen(false);}} onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
  }}>
   <div className="research-nav-caption">研究示例 <span>COMPETITOR STUDY</span></div>
   {options.map((item,index)=><div key={item.id}>{index===pmSections.length&&<div className="research-nav-caption research-nav-own">我的研究 <span>{researches.length}</span></div>}<button role="option" aria-selected={item.id===value} data-index={index} tabIndex={active===index?0:-1} onClick={()=>choose(index)} className={item.id===value?'is-selected':''}><span className="research-nav-number">{index<pmSections.length?String(index+1).padStart(2,'0'):<Layers3 size={13}/>}</span><span className="research-nav-label">{index<pmSections.length?item.label.replace(/^\d+\s*/,''):item.label}</span>{item.id===value&&<Check size={14}/>}</button></div>)}
  </div>,document.body)}
 </>;
}
