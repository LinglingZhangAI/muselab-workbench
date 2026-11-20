import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,Check,ChevronDown,Clock3,Folder} from 'lucide-react';

type Option={value:string;label:string};
export function NoteFolderSelect({label,value,options,onChange,disabled=false,variant='folder',menuClassName='',triggerIcon,active:filterActive=false}:{label:string;value:string;options:Option[];onChange:(value:string)=>void;disabled?:boolean;variant?:'folder'|'sort'|'filter';menuClassName?:string;triggerIcon?:ReactNode;active?:boolean}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[host,setHost]=useState<HTMLElement|null>(null);
 const [position,setPosition]=useState({top:0,left:0,width:220,maxHeight:280});
 const selected=options.find(option=>option.value===value)||options[0];
 function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
 function show(){
  if(disabled||!trigger.current||!options.length)return;
  const target=trigger.current.closest<HTMLElement>('[role="dialog"]')||document.body;const rect=trigger.current.getBoundingClientRect();
  const bounds=target===document.body?{left:0,right:window.innerWidth,top:0,bottom:window.innerHeight}:target.getBoundingClientRect();
  const width=Math.min(Math.max(rect.width,variant==='folder'?220:160),bounds.right-bounds.left-16);const below=bounds.bottom-rect.bottom-8,above=rect.top-bounds.top-8;
  const upwards=below<Math.min(options.length*36+12,240)&&above>below;const maxHeight=Math.min(280,Math.max(0,upwards?above:below));
  const height=Math.min(options.length*36+12,maxHeight);const left=Math.max(bounds.left+8,Math.min(variant==='sort'?rect.right-width:rect.left,bounds.right-width-8));
  setPosition({left:left-(target===document.body?0:bounds.left),top:(upwards?rect.top-height-5:rect.bottom+5)-(target===document.body?0:bounds.top),width,maxHeight});
  setHost(target);setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);
 }
 useEffect(()=>{
  if(!open)return;
  const pointer=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close();};
  const resize=()=>close();const scroll=(event:Event)=>{if(event.target instanceof Node&&panel.current?.contains(event.target))return;close();};
  document.addEventListener('pointerdown',pointer);window.addEventListener('resize',resize);document.addEventListener('scroll',scroll,true);
  return()=>{document.removeEventListener('pointerdown',pointer);window.removeEventListener('resize',resize);document.removeEventListener('scroll',scroll,true);};
 },[open]);
 useEffect(()=>{if(open){const option=panel.current?.querySelector<HTMLElement>('[data-index="'+active+'"]');option?.focus({preventScroll:true});option?.scrollIntoView({block:'nearest'});}},[open,active]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 return <span className={'note-folder-select'+(variant==='sort'?' notes-sort-select':'')}><button ref={trigger} type="button" className={'note-folder-trigger'+(open?' is-open':'')+(triggerIcon?' is-icon-only':'')+(filterActive?' is-filtered':'')} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled} title={triggerIcon?label+'：'+selected?.label:selected?.label} onClick={()=>open?close():show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();show();}}}>{triggerIcon||<><span>{selected?.label}</span><ChevronDown size={13} aria-hidden="true"/></>}</button>
  {open&&host&&createPortal(<div ref={panel} id={id} className={'note-folder-menu '+menuClassName} role="listbox" aria-label={label+'选项'} style={{...position,position:host===document.body?'fixed':'absolute'}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==trigger.current)close();}} onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}else if(event.key==='Tab'){close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
  }}>{options.map((option,index)=>{const Icon=variant==='folder'?Folder:option.value==='created'?CalendarDays:Clock3;return <button key={option.value} type="button" role="option" aria-selected={option.value===value} className={option.value===value?'is-selected':''} tabIndex={index===active?0:-1} data-index={index} title={option.label} onClick={()=>{onChange(option.value);close(true);}}>{variant!=='filter'&&<Icon size={13} aria-hidden="true"/>}<span>{option.label}</span>{option.value===value&&<Check size={13} aria-hidden="true"/>}</button>;})}</div>,host)}
 </span>;
}
