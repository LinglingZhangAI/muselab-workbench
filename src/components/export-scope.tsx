import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Layers3} from 'lucide-react';

export function ExportScope({value,onChange,options,disabled}:{value:string;onChange:(value:string)=>void;options:{id:string;label:string}[];disabled:boolean}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0);const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const selected=options.find(item=>item.id===value)||options[0];
 useEffect(()=>{if(open)root.current?.querySelector<HTMLElement>('[data-index="'+active+'"]')?.focus();},[open,active]);
 function show(){setActive(Math.max(0,options.findIndex(item=>item.id===value)));setOpen(true);}
 return <div className="export-scope-select" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
  <span className="export-scope-label">导出范围</span><button ref={trigger} className="export-scope-trigger" disabled={disabled} role="combobox" aria-label="导出范围" aria-expanded={open} aria-haspopup="listbox" aria-controls={id} onClick={()=>open?setOpen(false):show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();show();}}}><Layers3 size={15}/><span>{selected.label}</span><ChevronDown size={14}/></button>
  {open&&<div id={id} role="listbox" aria-label="导出范围选项" className="research-nav-panel export-scope-panel" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}}}>
   {options.map((item,index)=><div key={item.id}>{index===3&&<div className="research-nav-caption research-nav-own">研究分区</div>}<button type="button" role="option" aria-selected={item.id===value} className={item.id===value?'is-selected':''} data-index={index} tabIndex={index===active?0:-1} onClick={()=>{onChange(item.id);setOpen(false);trigger.current?.focus();}}><span className="research-nav-label">{item.label}</span>{item.id===value&&<Check size={14}/>}</button></div>)}
  </div>}
 </div>;
}
