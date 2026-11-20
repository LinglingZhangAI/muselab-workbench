import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,ChevronDown,ChevronUp,ExternalLink,Headphones,Maximize2,Minimize2,Pause,PictureInPicture2,Play,RefreshCw,RotateCcw,RotateCw,X} from 'lucide-react';
import {Modal} from './dialogs';
import {podcastSources,podcastDay,recommendEpisodes,type PodcastEdition,type PodcastEpisode} from '@/lib/podcasts';
import {savePodcastTime,savedPodcastTime,loadPodcastSession,savePodcastSession,latestPodcastProgress} from '@/lib/podcast-playback';
import {podcastPeople} from '@/lib/podcast-people';
import {PodcastText} from './podcast-text';
import {PodcastMiniSubtitles} from './podcast-mini-subtitles';
import {PodcastArticleButton,PodcastArticleStatus} from './podcast-article';
import {NoteFolderSelect} from './note-folder-select';

function published(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(new Date(value));}
const openPodcastEvent='muselab:open-podcasts';
export function PodcastListenButton(){return <button className="brief-listen" onClick={()=>window.dispatchEvent(new Event(openPodcastEvent))} aria-label="查看今天听些什么" aria-haspopup="dialog"><span className="brief-play"><Play size={13} fill="currentColor"/></span><span>今天听些什么<small>AI 行业 · 产品与创业</small></span></button>;}
const englishShowZh:Record<string,string>={'product-leader':'AI 产品领导力','lenny':'产品、职业与增长','latent-space':'AI 工程师播客','no-priors':'AI 投资与创业'};
const englishTitleZh:Record<string,string>={
 '77c56e7815637e81bce3113e':'知道答案的 AI 科学家评测',
 '1772635946261d929c43b993':'让 Agent 网络安全更普惠',
 '1dc843bf93efe69cda632175':'为什么 AI 算力以矩形形态出现',
 '28bf9b94a81b07c34757cd51':'新的顶级捕食者：用 AI Agent 武装的对手',
};
function showLabel(item:PodcastEpisode){const source=podcastSources.find(value=>value.id===item.sourceId);return source?.language==='en'&&englishShowZh[item.sourceId]?englishShowZh[item.sourceId]+' · '+item.show:item.show;}
function titleLabel(item:PodcastEpisode){const source=podcastSources.find(value=>value.id===item.sourceId);const zh=source?.language==='en'?englishTitleZh[item.id]:undefined;return zh?{zh,en:item.title}:{zh:'',en:item.title};}
function clock(seconds:number){const value=Math.max(0,Math.floor(seconds));return (value>=3600?Math.floor(value/3600)+':':'')+String(Math.floor(value/60)%60).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
function length(value:string){if(!value.includes(':'))return value;const seconds=value.split(':').reduce((total,part)=>total*60+Number(part),0);return Math.round(seconds/60)+' 分钟';}
function Artwork({episode}:{episode:PodcastEpisode}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[episode.cover]);
 return <span className={'podcast-artwork tone-'+episode.sourceId}>{episode.cover&&!failed?<img src={episode.cover} alt={episode.show+' 节目封面'} referrerPolicy="no-referrer" loading="lazy" onError={()=>setFailed(true)}/>:<span className="podcast-artwork-fallback"><Headphones size={28} strokeWidth={1}/><strong>{episode.show}</strong><small>MUSELAB · LISTEN</small></span>}</span>;
}
function PodcastPlayer({episode,autoplay,onPlaying,onTime,startAt,container}:{episode:PodcastEpisode;autoplay:boolean;onPlaying:(value:boolean)=>void;onTime:(time:number)=>void;startAt?:number;container:HTMLDivElement|null}){
 const audio=useRef<HTMLAudioElement>(null);const hasPlayed=useRef(false);const restoredSession=loadPodcastSession();const [playing,setPlaying]=useState(false);const [elapsed,setElapsed]=useState(()=>startAt??savedPodcastTime(episode.id));const [duration,setDuration]=useState(()=>restoredSession?.episode.id===episode.id?restoredSession.duration:0);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 function remember(time:number,duration:number){savePodcastTime(episode.id,time,duration);if(hasPlayed.current)savePodcastSession(episode,time,duration);}
 async function play(){const element=audio.current;if(!element)return;setError('');setLoading(true);try{await element.play();}catch(e){setLoading(false);if(e instanceof Error&&e.name==='AbortError')return;setError('暂时无法播放，可到原站收听。');}}
 useEffect(()=>{const element=audio.current;const save=()=>{if(hasPlayed.current&&element?.isConnected&&element.readyState)remember(element.currentTime,element.duration);};window.addEventListener('pagehide',save);const hidden=()=>{if(document.visibilityState==='hidden')save();};document.addEventListener('visibilitychange',hidden);if(autoplay)void play();return()=>{save();window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',hidden);onPlaying(false);};},[]);
 const position=duration?elapsed/duration*100:0;
 function skip(delta:number){if(audio.current&&duration){const value=Math.max(0,Math.min(duration,elapsed+delta));audio.current.currentTime=value;setElapsed(value);onTime(value);hasPlayed.current=true;remember(value,duration);}}
 return <>
  <audio ref={audio} src={episode.audio||undefined} preload="metadata" onTimeUpdate={e=>{if(!e.currentTarget.readyState||!e.currentTarget.isConnected)return;const value=e.currentTarget.currentTime;setElapsed(value);onTime(value);if(hasPlayed.current)remember(value,e.currentTarget.duration);}} onLoadedMetadata={e=>{const value=e.currentTarget.duration;setDuration(Number.isFinite(value)?value:0);const restored=startAt??savedPodcastTime(episode.id);const position=Number.isFinite(value)?Math.min(restored,Math.max(0,value-0.1)):restored;e.currentTarget.currentTime=position;setElapsed(position);onTime(position);}} onPlay={()=>{hasPlayed.current=true;if(audio.current)remember(audio.current.currentTime,audio.current.duration);setPlaying(true);onPlaying(true);}} onPlaying={()=>setLoading(false)} onPause={()=>{if(hasPlayed.current&&audio.current?.isConnected&&audio.current.readyState)remember(audio.current.currentTime,audio.current.duration);setPlaying(false);setLoading(false);onPlaying(false);}} onWaiting={()=>setLoading(true)} onEnded={()=>{remember(0,0);setPlaying(false);onPlaying(false);}} onError={()=>{setLoading(false);setError('暂时无法播放，可到原站收听。');}}/>
  {container&&createPortal(<section className="podcast-player" aria-label="播客播放器"><div className="podcast-transport"><button className="podcast-skip" aria-label="后退 15 秒" disabled={!duration} onClick={()=>skip(-15)}><RotateCcw size={18}/><small>15</small></button><button className="podcast-main-play" disabled={!episode.audio} aria-label={playing?'暂停播放':'播放这一期'} aria-busy={loading} onClick={()=>playing?audio.current?.pause():void play()}>{loading?<RefreshCw size={19} className="is-spinning"/>:playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button><button className="podcast-skip" aria-label="前进 15 秒" disabled={!duration} onClick={()=>skip(15)}><RotateCw size={18}/><small>15</small></button></div>
  <div className="podcast-seek"><div className="podcast-wave" aria-hidden="true">{Array.from({length:52},(_,index)=><i key={index} className={index/51*100<position?'is-played':''} style={{height:8+((index*17+index%5*11)%25)}}/>)}</div><input aria-label="播放进度" type="range" min="0" max={duration||1} step="1" value={elapsed} disabled={!duration} onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);setElapsed(Number(e.target.value));onTime(Number(e.target.value));hasPlayed.current=true;remember(Number(e.target.value),duration);}}/></div>
  <div className="podcast-player-times"><span>{clock(elapsed)}</span><span>{duration?clock(duration):episode.duration||'时长待加载'}</span></div>
  {(error||!episode.audio)&&<p className="podcast-warning" role="status">{error||'这期请前往原站收听。'}</p>}
 </section>,container)}
 </>;
}
function PodcastShell({standalone,open,onClose,focused,children,focusOnClose}:{standalone:boolean;open:boolean;onClose:()=>void;focused:boolean;children:ReactNode;focusOnClose:React.RefObject<HTMLElement>}){
 return standalone?<main className="podcast-modal podcast-standalone is-focused">{children}</main>:<Modal open={open} onClose={onClose} title="今天听些什么" focusOnClose={focusOnClose} className={'podcast-modal'+(focused?' is-focused':'')}>{children}</Modal>;
}
export function DailyPodcasts({standalone=false}:{standalone?:boolean}){
 const [session]=useState(loadPodcastSession);
 const [open,setOpen]=useState(standalone);const [focused,setFocused]=useState(false);const [edition,setEdition]=useState<PodcastEdition|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [selected,setSelected]=useState(()=>standalone?new URLSearchParams(location.search).get('podcast')||'':session?.episode.id||'');const [playRequest,setPlayRequest]=useState(0);const [autoplay,setAutoplay]=useState(false);const [playing,setPlaying]=useState(false);
 const [playhead,setPlayhead]=useState<{id:string;time:number}>({id:'',time:0});
 const [showFilter,setShowFilter]=useState('all');const [timeOrder,setTimeOrder]=useState('desc');
 const [miniCollapsed,setMiniCollapsed]=useState(()=>{try{return localStorage.getItem('muselab-podcast-mini-collapsed:v1')==='true';}catch{return false;}});
 const miniBodyId=useId();
 function toggleMini(){const next=!miniCollapsed;setMiniCollapsed(next);try{localStorage.setItem('muselab-podcast-mini-collapsed:v1',String(next));}catch{/* Keep the toggle usable when storage is unavailable. */}}
 const [minimized,setMinimized]=useState(!standalone);const [dialogPlayerHost,setDialogPlayerHost]=useState<HTMLDivElement|null>(null);const [miniPlayerHost,setMiniPlayerHost]=useState<HTMLDivElement|null>(null);const miniRestore=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(standalone)return;const show=()=>{setMinimized(false);setOpen(true);};window.addEventListener(openPodcastEvent,show);return()=>window.removeEventListener(openPodcastEvent,show);},[standalone]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);
  void fetch('/api/daily-podcasts'+(version?'?refresh=1':''),{signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'播客推荐暂时无法读取');if(!Array.isArray(result.episodes)||!Array.isArray(result.sources))throw new Error('播客数据格式异常');setEdition(result);setSelected(current=>current||latestPodcastProgress(result.episodes));setError(result.warning||'');}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'播客推荐暂时无法读取');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[version]);
 const items=recommendEpisodes(edition?.episodes||[],new Date(),{jun:5,silicon:5,silicon101:5,crossing:5});const today=podcastDay();const active=edition?.episodes.find(item=>item.id===selected)||(session?.episode.id===selected?session.episode:undefined)||items[0];
 const featured=items.slice(0,2);const availableMore=items.slice(2);
 const more=availableMore.filter(item=>showFilter==='all'||item.sourceId===showFilter).sort((a,b)=>(timeOrder==='asc'?1:-1)*(Date.parse(a.publishedAt)-Date.parse(b.publishedAt)));
 const showOptions=[{value:'all',label:'全部节目'},...podcastSources.filter(source=>availableMore.some(item=>item.sourceId===source.id)).map(source=>({value:source.id,label:source.name}))];const category=podcastSources.find(item=>item.id===active?.sourceId);const people=podcastPeople(active?.description||'');
 function choose(item:PodcastEpisode,play=false){setSelected(item.id);setAutoplay(play);if(play)setPlayRequest(value=>value+1);}
 function close(){setOpen(false);setMinimized(!standalone);}
 function restore(){setMinimized(false);setOpen(true);}
 function minimize(){setMinimized(true);setOpen(false);}
 return <>
  <PodcastShell standalone={standalone} open={open} onClose={close} focused={focused} focusOnClose={miniRestore}>
   <header className="podcast-heading"><div className="podcast-heading-actions"><span>{published(today+'T00:00:00+08:00')}</span>{!standalone&&<button aria-label="小窗收听" title="小窗收听" disabled={!active} onClick={minimize}><PictureInPicture2 size={17}/></button>}<button aria-label="刷新播客推荐" title="刷新播客推荐" disabled={loading} onClick={()=>setVersion(value=>value+1)}><RefreshCw size={16} className={loading?'is-spinning':''}/></button>{standalone?<a href={import.meta.env.BASE_URL} aria-label="返回工作台" title="返回工作台"><ArrowLeft size={18}/></a>:<button aria-label="关闭播客推荐" onClick={close}><X size={19}/></button>}</div></header>
   <div className="podcast-layout"><div className="podcast-library">
    <div className="podcast-section-heading podcast-library-title"><h3>今天听些什么</h3><span>留一点时间，给新的想法。</span></div>
    {loading&&!edition&&<p className="podcast-empty" role="status">正在查找最新节目…</p>}
    {!loading&&!items.length&&<p className="podcast-empty">暂未获得可核实的节目，请稍后刷新。</p>}
    <div className="podcast-featured">{featured.map(item=><article key={item.id} className={'podcast-card tone-'+item.sourceId+(active?.id===item.id?' is-selected':'')}>
     <button className="podcast-cover-button" onClick={()=>choose(item)} aria-label={'查看节目：'+item.title} aria-pressed={active?.id===item.id}><Artwork episode={item}/></button>
     <p className="podcast-card-show">{showLabel(item)}</p><h4><button onClick={()=>choose(item)}>{titleLabel(item).zh&&<span className="podcast-title-zh">{titleLabel(item).zh}</span>}<span className={titleLabel(item).zh?'podcast-title-en':''}>{titleLabel(item).en}</span></button></h4>
     <div className="podcast-card-bottom"><button className="podcast-card-play" onClick={()=>choose(item,true)} aria-label={'播放：'+item.title}><Play size={12} fill="currentColor"/><span>{length(item.duration)||'听这一期'}</span></button><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={'打开原站：'+item.title}><ArrowUpRight size={16}/></a></div>
    </article>)}</div>
    {!!availableMore.length&&<><div className="podcast-section-heading podcast-more-heading"><h3>也听听这些</h3><div className="podcast-filters"><NoteFolderSelect label="按播客节目筛选" value={showFilter} options={showOptions} onChange={setShowFilter}/><NoteFolderSelect label="按发布时间排序" value={timeOrder} options={[{value:'desc',label:'最新优先'},{value:'asc',label:'最早优先'}]} onChange={setTimeOrder} variant="sort"/></div></div><div className="podcast-more">{more.map(item=>{const title=titleLabel(item);return <article key={item.id} className={active?.id===item.id?'is-selected':''}><button className="podcast-row-main" onClick={()=>choose(item)} aria-label={'查看节目：'+item.title} aria-pressed={active?.id===item.id}><Artwork episode={item}/><span><small>{showLabel(item)}<i>·</i>{published(item.publishedAt)} 发布</small><strong>{title.zh&&<span className="podcast-title-zh">{title.zh}</span>}<span className={title.zh?'podcast-title-en':''}>{title.en}</span></strong><em>{length(item.duration)}</em></span></button><button className="podcast-row-play" aria-label={'播放：'+item.title} onClick={()=>choose(item,true)}><Play size={14} fill="currentColor"/></button></article>})}</div>{!more.length&&<p className="podcast-empty" role="status">这个节目暂时没有更多内容。<button className="podcast-filter-reset" onClick={()=>setShowFilter('all')}>查看全部节目</button></p>}</>}
    {error&&<p className="podcast-warning" role="status">{error}</p>}
    <footer className="podcast-footnote"><span>每日 7:45 更新 · 关注节目最新一期优先</span>{edition&&<span>检查于 {published(edition.fetchedAt)} {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(edition.fetchedAt))}</span>}</footer>
   </div>
   <aside className="podcast-detail" aria-label="节目详情">{active?<><div className="podcast-detail-scroll" data-note-scope data-note-kind="podcast" data-note-title={active.show+' · '+active.title} data-note-url={active.url} data-note-show={active.show} data-note-episode={active.id} data-note-position={playhead.id===active.id?playhead.time:savedPodcastTime(active.id)}><div className="podcast-detail-label"><span><i className={playing?'is-playing':''}/>{playing?'正在收听':'本期收听'}</span><div className="podcast-detail-actions"><PodcastArticleButton episodeId={active.id}/>{!standalone&&<><a href={active.url} target="_blank" rel="noopener noreferrer" aria-label="打开节目原站" title="打开节目原站"><ExternalLink size={16}/></a><button aria-label={focused?'返回节目列表':'放大收听'} title={focused?'返回节目列表':'放大收听'} onClick={()=>setFocused(value=>!value)}>{focused?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button></>}</div></div><PodcastArticleStatus episodeId={active.id}/><div className="podcast-episode-intro"><div className="podcast-detail-cover"><Artwork episode={active}/></div><p className="podcast-detail-show">{showLabel(active)}</p><h3>{titleLabel(active).zh&&<span className="podcast-title-zh">{titleLabel(active).zh}</span>}<span className={titleLabel(active).zh?'podcast-title-en':''}>{titleLabel(active).en}</span></h3><div className="podcast-detail-tags"><span>{published(active.publishedAt)} 发布</span>{people.hosts.length>0&&<span>主持人 {people.hosts.join('、')}</span>}{people.guests.length>0&&<span>嘉宾 {people.guests.join('、')}</span>}{category&&<span>{category.need}</span>}</div></div><PodcastText key={active.id} episode={active} playing={playing} time={playhead.id===active.id?playhead.time:0}/></div><div className="podcast-player-host" ref={setDialogPlayerHost}/></>:<div className="podcast-detail-empty"><Headphones size={36} strokeWidth={1}/><p>选一期节目，听见新的想法。</p></div>}</aside>
   </div>
  </PodcastShell>
  {minimized&&active&&createPortal(<aside className={'podcast-mini'+(miniCollapsed?' is-collapsed':'')} aria-label="播客小窗"><header><Artwork episode={active}/><div className="podcast-mini-info"><span>{active.show}</span><strong title={active.title}>{active.title}</strong></div><button aria-label={miniCollapsed?'展开播客小窗':'收起播客小窗'} title={miniCollapsed?'展开播客小窗':'收起播客小窗'} aria-expanded={!miniCollapsed} aria-controls={miniBodyId} onClick={toggleMini}>{miniCollapsed?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button><button ref={miniRestore} aria-label="恢复播客大窗口" title="恢复播客大窗口" onClick={restore}><Maximize2 size={16}/></button></header><div id={miniBodyId} hidden={miniCollapsed}><PodcastMiniSubtitles key={active.id} episodeId={active.id} time={playhead.id===active.id?playhead.time:savedPodcastTime(active.id)}/><div className="podcast-player-host" ref={setMiniPlayerHost}/></div></aside>,document.body)}
  {(open||minimized)&&active&&<PodcastPlayer key={active.id+'-'+playRequest} episode={active} autoplay={autoplay} onPlaying={setPlaying} onTime={time=>setPlayhead({id:active.id,time})} container={minimized?miniPlayerHost:dialogPlayerHost} startAt={standalone&&new URLSearchParams(location.search).get('podcast')===active.id&&new URLSearchParams(location.search).has('t')?Math.max(0,Number(new URLSearchParams(location.search).get('t'))||0):session?.episode.id===active.id?savedPodcastTime(active.id,session.time):undefined}/>}
 </>;
}
