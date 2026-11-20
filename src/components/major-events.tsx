import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,ChevronLeft,ChevronRight,ExternalLink,RefreshCw,Search,X,Radio,Minus,Plus,Globe2,SlidersHorizontal} from 'lucide-react';
import seed from '@/data/major-events.json';
import {Modal} from '@/components/dialogs';
import {cn} from '@/lib/utils';
import type {MajorEvent,EventsArchive} from '@/lib/major-events-types';
import {eventDateLabel,eventTrackLabel} from '@/lib/major-events-format';
import {eventDateGroups,eventDensityBeads} from '@/lib/major-events-density';
import {NoteFolderSelect} from './note-folder-select';
import './major-events.css';

const origin=65;
export function MajorEvents(){
 const [searchOpen,setSearchOpen]=useState(false);
 const searchInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(searchOpen)searchInput.current?.focus();},[searchOpen]);
 const [zoom,setZoom]=useState(1),[viewportWidth,setViewportWidth]=useState(0);
 const gap=292*zoom,cardWidth=264*zoom;
 const anchor=useRef<{id:string;relative:number}|null>(null),previousFilter=useRef<string|null>(null);
 const [archive,setArchive]=useState<EventsArchive>(seed as EventsArchive),[query,setQuery]=useState(''),[track,setTrack]=useState('全部'),[region,setRegion]=useState('全部'),[category,setCategory]=useState('全部');
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<MajorEvent|null>(null),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false);
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;scroll:number;moved:boolean}|null>(null),suppress=useRef(false),request=useRef(false);
 const mounted=useRef(true);
 const refresh=useCallback(async(force=false)=>{
  if(request.current||(!force&&document.visibilityState==='hidden'))return;request.current=true;setLoading(true);
  try{const response=await fetch('/api/major-events'+(force?'?refresh=1':''),{cache:'no-store'});if(!response.ok)throw new Error('检查暂时不可用，已保留上次事件');const value=await response.json() as EventsArchive;
   if(!Array.isArray(value.events)||!value.events.length)throw new Error('没有收到有效事件，已保留上次资料');
   if(mounted.current)setArchive(value);
  }catch{/* Keep the last valid archive when a refresh is unavailable. */}finally{request.current=false;if(mounted.current)setLoading(false);}
 },[]);
 useEffect(()=>{mounted.current=true;void refresh();const timer=setInterval(()=>void refresh(),30000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[refresh]);
 const events=useMemo(()=>archive.events.filter(e=>(track==='全部'||e.track===track)&&(region==='全部'||e.region===region)&&(category==='全部'||e.category===category)&&`${e.name} ${e.title} ${e.org} ${e.date} ${e.period||""} ${e.track} ${e.summary}`.toLowerCase().includes(query.trim().toLowerCase())),[archive,query,track,region,category]);
 const categories=useMemo(()=>[...new Set(archive.events.map(e=>e.category))],[archive]);
 const years=[...new Set(archive.events.map(e=>e.date.slice(0,4)))];
 const layout=useMemo(()=>eventDateGroups(events,origin,gap,cardWidth),[events,gap,cardWidth]);
 const {width,positions,groups}=layout;
 const beads=useMemo(()=>eventDensityBeads(groups,width),[groups,width]);
 const max=()=>Math.max(0,(viewport.current?.scrollWidth||0)-(viewport.current?.clientWidth||0));
 function scroll(value:number,smooth=true){viewport.current?.scrollTo({left:Math.max(0,Math.min(max(),value)),behavior:smooth?'smooth':'auto'});}
 useEffect(()=>{const view=viewport.current;if(!view)return;const observer=new ResizeObserver(()=>setViewportWidth(view.clientWidth));observer.observe(view);return()=>observer.disconnect();},[]);
 const filterKey=[query,track,region,category,events.map(e=>e.id).join(',')].join('|');
 useLayoutEffect(()=>{
  const view=viewport.current;if(!view)return;
  const changed=previousFilter.current!==filterKey;previousFilter.current=filterKey;
  const last=events[events.length-1],saved=!changed&&anchor.current&&positions[anchor.current.id]!==undefined?anchor.current:null;
  const id=saved?.id||last?.id;
  const position=id?positions[id]+cardWidth/2-view.clientWidth*(saved?.relative??.5):0;
  scroll(position,false);setOffset(view.scrollLeft);
  if(changed)setSelected(last?.id||null);
 },[layout,viewportWidth,filterKey]);
 function changeZoom(next:number){
  const view=viewport.current;if(!view)return;
  const center=view.scrollLeft+view.clientWidth/2;
  const event=events.reduce<MajorEvent|null>((nearest,e)=>!nearest||Math.abs(positions[e.id]+cardWidth/2-center)<Math.abs(positions[nearest.id]+cardWidth/2-center)?e:nearest,null);
  if(event)anchor.current={id:event.id,relative:(positions[event.id]+cardWidth/2-view.scrollLeft)/view.clientWidth};
  setZoom(Math.max(.6,Math.min(1.5,Math.round(next*10)/10)));
 }
 function select(e:MajorEvent,index:number,open=false){setSelected(e.id);if(open)setDetail(e);else scroll(positions[e.id]-((viewport.current?.clientWidth||0)-cardWidth)/2);}
 function jump(year:string){const i=year==='latest'?events.length-1:events.findIndex(e=>e.date.startsWith(year));if(i>=0)select(events[i],i);}
 const checked=archive.lastAttemptAt?new Date(archive.lastAttemptAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'}):null;
 const lowerLane=(event:MajorEvent)=>event.track!=='模型';
 const detailIndex=detail?events.findIndex(e=>e.id===detail.id):-1;
 const centerX=offset+(viewport.current?.clientWidth||0)/2;
 const centerIndex=events.reduce((nearest,event,index)=>Math.abs(positions[event.id]+cardWidth/2-centerX)<Math.abs(positions[events[nearest].id]+cardWidth/2-centerX)?index:nearest,0);
 const visibleEvent=events[centerIndex];
 const year=visibleEvent?.date.slice(0,4);
 const atLatest=events.length>0&&(centerIndex===events.length-1||offset>=max()-2);
 const quarter=visibleEvent&&visibleEvent.date.length>=7?Math.ceil(Number(visibleEvent.date.slice(5,7))/3):0;
 const quarterTitles=['资本开闸 + 春节入口大战','DeepSeek V4 回归，百万上下文成标配','参数军备 + 算力自主','Agent 产品化 + 入口之争'];
 const periodTitle=year==='2026'&&quarter?`2026 Q${quarter}｜${quarterTitles[quarter-1]}`:archive.reference?.yearSummaries.find(item=>item.year===year)?.title;
 const periodCode=year==='2026'&&quarter?`${year} Q${quarter}`:year;
 const periodTheme=year==='2026'&&quarter?quarterTitles[quarter-1]:periodTitle;
 return <section className="major-events" aria-label="重大事件" data-note-scope data-note-title="重大事件 · AI 模型与产品">
  <header className="me-heading"><div><span className="me-eyebrow">THE AI ARCHIVE / 2022—2026</span><h1>重大事件<span>模型跃迁，产业重构。</span></h1></div></header>
  <div className="me-toolbar"><div className="me-tabs" role="group" aria-label="事件分类">{['全部','模型','产品','算力','资本','政策','产业'].map(t=><button key={t} aria-pressed={track===t} className={cn(track===t&&'is-active')} onClick={()=>setTrack(t)}>{t}<small>{archive.events.filter(e=>t==='全部'||e.track===t).length}</small></button>)}</div><div className="me-filter-controls"><div className="me-search-control">{searchOpen||query?<label className="me-search"><Search size={13}/><input ref={searchInput} aria-label="搜索重大事件" value={query} onChange={e=>setQuery(e.target.value)} placeholder="模型、产品或机构" onKeyDown={e=>{if(e.key==='Escape'){setQuery('');setSearchOpen(false);}}}/><button aria-label={query?'清除搜索':'收起搜索'} onClick={()=>{if(query)setQuery('');else setSearchOpen(false);}}><X size={12}/></button></label>:<button className="me-search-toggle" aria-label="搜索重大事件" title="搜索重大事件" aria-expanded={false} onClick={()=>setSearchOpen(true)}><Search size={15}/></button>}</div><NoteFolderSelect label="国内与海外" value={region} options={[{value:'全部',label:'国内外'},{value:'国内',label:'国内'},{value:'海外',label:'海外'}]} onChange={setRegion} variant="filter" menuClassName="me-filter-menu" triggerIcon={<Globe2 size={15} aria-hidden="true"/>} active={region!=='全部'}/><NoteFolderSelect label="事件方向" value={category} options={[{value:'全部',label:'全部方向'},...categories.map(value=>({value,label:value}))]} onChange={setCategory} variant="filter" menuClassName="me-filter-menu" triggerIcon={<SlidersHorizontal size={15} aria-hidden="true"/>} active={category!=='全部'}/></div></div>
  <div className="me-subbar"><nav aria-label="跳转事件年份">{years.map(year=><button key={year} aria-current={year===visibleEvent?.date.slice(0,4)?'date':undefined} className={cn(year===visibleEvent?.date.slice(0,4)&&'is-current')} onClick={()=>jump(year)}>{year}</button>)}<button className={cn('me-jump-latest',atLatest&&'is-current')} aria-pressed={atLatest} onClick={()=>jump('latest')}>最新 <ArrowRight size={11}/></button></nav>{periodTitle&&<div className="me-period-heading" aria-label="阶段总结"><span>阶段总结</span><strong><span className="me-period-code">{periodCode}</span><span className="me-period-divider" aria-hidden="true">｜</span><span className="me-period-theme">{periodTheme}</span></strong></div>}</div>

  <div className="me-timeline" ref={viewport} tabIndex={0} aria-label="可拖动的事件时间轴" onScroll={e=>{setOffset(e.currentTarget.scrollLeft);const center=e.currentTarget.scrollLeft+e.currentTarget.clientWidth/2;const nearest=events.reduce<MajorEvent|null>((best,item)=>!best||Math.abs(positions[item.id]+cardWidth/2-center)<Math.abs(positions[best.id]+cardWidth/2-center)?item:best,null);if(nearest)anchor.current={id:nearest.id,relative:(positions[nearest.id]+cardWidth/2-e.currentTarget.scrollLeft)/e.currentTarget.clientWidth};}} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();scroll(offset+(e.key==='ArrowRight'?gap:-gap));}}}
   onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,scroll:e.currentTarget.scrollLeft,moved:false};}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x;if(Math.abs(dx)>6&&!d.moved){d.moved=true;suppress.current=true;e.currentTarget.setPointerCapture(e.pointerId);}if(d.moved){e.currentTarget.scrollLeft=d.scroll-dx;e.preventDefault();}}}
   onPointerUp={()=>{if(drag.current?.moved)setTimeout(()=>{suppress.current=false;},100);drag.current=null;}} onPointerCancel={()=>{drag.current=null;suppress.current=false;}}>
   <div className={cn('me-scene',zoom<=.7&&'is-compact')} style={{width,'--me-zoom':zoom} as CSSProperties}>
    <div className="me-grids" aria-hidden="true"/>
    <div className="me-axis" role="group" aria-label="事件密度时间轴：圆大小表示日期前后三天的七日事件数量">
     <svg className="me-bead-chain" width={width} height="76" viewBox={`0 0 ${width} 76`} aria-hidden="true">{beads.map((bead,index)=><circle key={index} cx={bead.x} cy={34} r={bead.radius*(bead.radius>10?.45:.7)} className={bead.partial?'is-period':undefined}/>)}</svg>
     {groups.map(group=>{const first=group.members[0],active=group.members.some(e=>e.id===selected);return <div key={group.date}>
      <button className={cn('me-density-dot',active&&'is-selected',group.date.length<10&&'is-period')} style={{left:group.center,'--dot-radius':group.radius*.45+'px'} as CSSProperties} aria-label={eventDateLabel(first)+'，'+group.count+' 个事件'} title={eventDateLabel(first)+' · '+group.count+' 个事件'+(group.nearbyCount===null?'（日期未精确到日）':' · 附近7天 '+group.nearbyCount+' 个事件')} onClick={()=>{if(!suppress.current)select(first,events.findIndex(e=>e.id===first.id));}}/>
      <button className={cn('me-date',active&&'is-selected')} style={{left:group.center}} aria-label={eventDateLabel(first)+'，跳转日期组'} onClick={()=>{if(!suppress.current)select(first,events.findIndex(e=>e.id===first.id));}}><b>{group.date.slice(0,4)}</b><span>{group.date.length===4?(first.period||'全年'):<>{group.date.slice(5,7)}<small>月</small>{group.date.length===10&&<em> / {group.date.slice(8)}日</em>}</>}</span></button>
     </div>;})}
    </div>
    {events.map((event,index)=>{const x=positions[event.id];const laneIndex=events.slice(0,index).filter(e=>lowerLane(e)===lowerLane(event)).length;return <div key={event.id} style={{'--me-stagger-step':laneIndex%2} as CSSProperties}>
      <button className={cn('me-card',lowerLane(event)&&'is-product',selected===event.id&&'is-selected')} style={{left:x}} onClick={()=>{if(!suppress.current)select(event,index,true);}} aria-label={event.title+'，阅读详情'}><img src={import.meta.env.BASE_URL + "assets/astronaut.webp"} alt="" draggable={false}/><span className="me-card-copy"><span className="me-card-meta"><time>{eventDateLabel(event)}</time><small>{event.region} · {event.org}</small></span><strong>{event.title}</strong><span className="me-card-summary">{event.summary}</span><span className="me-card-read">{eventTrackLabel(event)} <ExternalLink size={9}/></span></span></button>
      <button className={cn('me-node',lowerLane(event)&&'is-product')} style={{left:x-18,'--pulse-delay':`${-index*.37}s`} as CSSProperties} onClick={()=>{if(!suppress.current)select(event,index,true);}} aria-label={'查看'+event.name}><span/></button>
    </div>;})}
    {!events.length&&<div className="me-empty">没有找到匹配事件。<button onClick={()=>{setQuery('');setTrack('全部');setRegion('全部');setCategory('全部');}}>重置筛选</button></div>}
   </div>
  </div>
  <div className="me-bottom"><span>{events.length} 个事件</span><div className="me-zoom-controls" role="group" aria-label="时间轴缩放"><button aria-label="缩小时间轴" disabled={zoom<=.6} onClick={()=>changeZoom(zoom-.1)}><Minus size={13}/></button><button className="me-zoom-reset" aria-label="重置时间轴缩放" title="恢复 100%" onClick={()=>changeZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="放大时间轴" disabled={zoom>=1.5} onClick={()=>changeZoom(zoom+.1)}><Plus size={13}/></button></div><input type="range" aria-label="时间轴浏览位置" min={0} max={Math.max(1,width-(viewportWidth||800))} value={offset} onChange={e=>scroll(Number(e.target.value),false)}/><div><button aria-label="更早的事件" disabled={offset<=0} onClick={()=>scroll(offset-gap)}><ChevronLeft size={15}/></button><button aria-label="更晚的事件" disabled={offset>=width-(viewport.current?.clientWidth||800)-1} onClick={()=>scroll(offset+gap)}><ChevronRight size={15}/></button></div></div>
  <div className="me-refresh-row"><span className="me-check"><Radio size={11}/>{archive.running?'正在检测来源':checked?`${checked} 检查 · 每15分钟`:'每15分钟检测'}</span><button aria-label="检查事件更新" title="立即检查官方来源" disabled={loading||archive.running} onClick={()=>void refresh(true)}><RefreshCw size={13} className={cn((loading||archive.running)&&'is-spinning')}/></button></div>

  <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?.title||'事件详情'} className="major-event-modal">{detail&&<><button className="me-modal-close" onClick={()=>setDetail(null)} aria-label="关闭事件详情"><X size={19}/></button><div className={cn('me-detail-layout',lowerLane(detail)&&'is-product')}><aside className={detail.detailImage?'has-event-image':undefined}><img src={(detail.detailImage||detail.image).path} alt={(detail.detailImage||detail.image).alt}/><a href={(detail.detailImage||detail.image).source} target="_blank" rel="noreferrer">{(detail.detailImage||detail.image).label}<ExternalLink size={10}/></a></aside><article><span className="me-eyebrow">{detail.region} / {detail.track} / {detail.org}</span><time>{eventDateLabel(detail)}</time><h2>{detail.title}</h2><small className="me-release">{detail.status}</small><h3 className="me-event-detail-heading">事件详情</h3><p>{detail.body}</p><h3>这一步，改变了什么</h3><p>{detail.impact}</p>{detail.interpretation&&<p className="me-evidence">{detail.interpretation}</p>}{(detail.newsSources?.length||detail.sourceType!=='reference')&&<section className="me-news-sources"><h3>官方公告与新闻</h3>{(detail.newsSources?.length?detail.newsSources:[{title:detail.sourceTitle,url:detail.url}]).map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={11}/></a>)}</section>}{detail.paper&&<a href={detail.paper} target="_blank" rel="noreferrer">补充研究 / 论文 <ExternalLink size={11}/></a>}<nav><button disabled={detailIndex<=0} onClick={()=>setDetail(events[detailIndex-1])}><ArrowLeft size={12}/>上一事件</button><span>{detailIndex+1} / {events.length}</span><button disabled={detailIndex<0||detailIndex>=events.length-1} onClick={()=>setDetail(events[detailIndex+1])}>下一事件<ArrowRight size={12}/></button></nav></article></div></>}</Modal>
 </section>;
}
