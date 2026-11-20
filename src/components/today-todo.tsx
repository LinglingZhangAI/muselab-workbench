import {useEffect,useState,type FormEvent} from 'react';
import {Check,Clock3,ListFilter,NotebookPen,Plus,Trash2,X} from 'lucide-react';
import {Modal} from '@/components/dialogs';
import {CodexWorkRecords} from './codex-work-records';

type Subtask={id:string;title:string;done:boolean};
type Entry={id:string;type:'task'|'note';title:string;content:string;start:string;end:string;done:boolean;dueDate:string;subtasks:Subtask[];sample?:boolean};
type Filter='all'|'note'|'pending'|'done';
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
const zone='Asia/Shanghai';
function dateKey(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function currentTime(){return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());}
function minutes(time:string){const [h,m]=time.split(':').map(Number);return h*60+m;}
function displayTime(time:string){const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`;}
function duration(entry:Entry){const value=minutes(entry.end)-minutes(entry.start);return value%60===0?`${value/60} ${value===60?'hour':'hours'}`:`${value} min`;}
function blank(type:Entry['type']):Entry{return {id:crypto.randomUUID(),type,title:'',content:'',start:currentTime(),end:'',done:false,dueDate:'',subtasks:[]};}
function valid(value:unknown):value is Entry{
 if(!value||typeof value!=='object')return false;
 const e=value as Entry;
 return typeof e.id==='string'&&(e.type==='task'||e.type==='note')&&typeof e.title==='string'&&typeof e.content==='string'&&
  (e.type==='task'?!!e.title.trim()&&e.title.length<=120:!!e.content.trim()&&e.content.length<=10000)&&
  typeof e.start==='string'&&timePattern.test(e.start)&&typeof e.end==='string'&&(!e.end||(timePattern.test(e.end)&&minutes(e.end)>minutes(e.start)))&&
  typeof e.done==='boolean'&&typeof e.dueDate==='string'&&(!e.dueDate||/^\d{4}-\d{2}-\d{2}$/.test(e.dueDate))&&Array.isArray(e.subtasks)&&
  e.subtasks.every(s=>s&&typeof s.id==='string'&&typeof s.title==='string'&&typeof s.done==='boolean');
}
function load(day:string):{entries:Entry[];error:string}{
 try{
  const raw=localStorage.getItem('muselab-timeline:v2:'+day);
  if(raw!==null){const data:unknown=JSON.parse(raw);if(!Array.isArray(data)||!data.every(valid))throw new Error();return {entries:data,error:''};}
  const legacy=localStorage.getItem('muselab-todos:v1:'+day);
  if(legacy===null)return {entries:[],error:''};
  const data:unknown=JSON.parse(legacy);if(!Array.isArray(data))throw new Error();
  const entries=data.map(e=>({...e,type:'task',content:'',dueDate:'',subtasks:[]}));
  if(!entries.every(valid))throw new Error();
  return {entries,error:''};
 }catch{return {entries:[],error:'无法读取已保存的记录，原数据已保留。请检查浏览器存储后刷新。'};}
}
function dueLabel(due:string,day:string){
 const days=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86400000);
 return days===0?'今天':days===1?'明天':days<0?`逾期 ${-days} 天`:days<=7?`${days} 天后`:`${Number(due.slice(5,7))}月${Number(due.slice(8))}日`;
}

export function TodayTodo(){
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const tick=()=>setNow(new Date());const timer=window.setInterval(tick,60000);document.addEventListener('visibilitychange',tick);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const dateLabel=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,month:'long',day:'numeric'}).format(now)+' '+new Intl.DateTimeFormat('zh-CN',{timeZone:zone,weekday:'long'}).format(now);
 return <aside className="today-todo" aria-label="今日工作记录与待办"><p className="todo-date">{dateLabel}</p><Timeline key={dateKey(now)} day={dateKey(now)}/></aside>;
}

function Timeline({day}:{day:string}){
 const [initial]=useState(()=>load(day));
 const [view,setView]=useState<'work'|'personal'>('work');
 const [entries,setEntries]=useState(initial.entries);
 const [storageError,setStorageError]=useState(initial.error);
 const [filter,setFilter]=useState<Filter>('all');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [draft,setDraft]=useState<Entry|null>(null);
 const [formError,setFormError]=useState('');
 const [notice,setNotice]=useState('');
 const [removed,setRemoved]=useState<Entry[]>([]);
 useEffect(()=>{if(initial.error)return;try{localStorage.setItem('muselab-timeline:v2:'+day,JSON.stringify(entries));setStorageError('');}catch{setStorageError('记录暂未保存，浏览器存储不可用。');}},[entries,day,initial.error]);
 function edit(entry?:Entry){setDraft(entry?{...entry,subtasks:entry.subtasks.map(s=>({...s}))}:blank('task'));setFormError('');}
 function remove(items:Entry[]){setEntries(old=>old.filter(e=>!items.some(item=>item.id===e.id)));setRemoved(items);setNotice(`已删除 ${items.length} 条记录`);setDraft(null);}
 function undo(){setEntries(old=>[...old,...removed.filter(e=>!old.some(item=>item.id===e.id))]);setRemoved([]);setNotice('已恢复记录');}
 function save(event:FormEvent){
  event.preventDefault();if(!draft)return;
  const clean={...draft,title:draft.title.trim(),content:draft.content.trim(),subtasks:draft.subtasks.filter(s=>s.title.trim()).map(s=>({...s,title:s.title.trim()})),sample:false};
  if(!(clean.type==='task'?clean.title:clean.content)){setFormError(clean.type==='task'?'请输入待办名称':'请输入日记内容');return;}
  if(!timePattern.test(clean.start)||(clean.end&&(!timePattern.test(clean.end)||minutes(clean.end)<=minutes(clean.start)))){setFormError('结束时间需要晚于开始时间');return;}
  if(!valid(clean)){setFormError('请检查记录内容和日期');return;}
  setEntries(old=>old.some(e=>e.id===clean.id)?old.map(e=>e.id===clean.id?clean:e):[...old,clean]);setDraft(null);setFilter('all');setNotice('记录已保存');
 }
 const personal=entries.filter(e=>!e.sample);
 const visible=personal.filter(e=>filter==='all'||(filter==='note'?e.type==='note':e.type==='task'&&e.done===(filter==='done'))).sort((a,b)=>a.start.localeCompare(b.start));
 return <div className="todo-inner">
  <div className="todo-heading"><h2>{view==='work'?'今日工作记录':'我的待办'}</h2><button className="todo-add" aria-label="新增今日待办" onClick={()=>{setView('personal');edit();}}><Plus size={18}/></button></div>
  <div className="todo-view-tabs" role="group" aria-label="工作与待办视图"><button aria-pressed={view==='work'} onClick={()=>setView('work')}>Codex 工作</button><button aria-pressed={view==='personal'} onClick={()=>setView('personal')}>我的待办{personal.length>0?' · '+personal.length:''}</button></div>
  {view==='work'?<CodexWorkRecords day={day}/>:<>
  {filtersOpen&&<div id="timeline-filters" className="timeline-filters" aria-label="记录类型">{([['all','全部'],['note','日记'],['pending','待办'],['done','已完成']] as const).map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>}
  {visible.length?<ul className="todo-list todo-records">{visible.map(entry=>entry.type==='note'?<li key={entry.id} className="todo-note-item"><NotebookPen size={17}/><div className="todo-task-content"><button className="todo-task-title todo-note-text" onClick={()=>edit(entry)} aria-label={'编辑日记：'+entry.content.slice(0,24)}>{entry.content}</button><p>{displayTime(entry.start)} · 日记</p></div></li>:<li className={'todo-item'+(entry.done?' is-done':'')} key={entry.id}>
   <button className="todo-checkbox" role="checkbox" aria-checked={entry.done} aria-label={`${entry.done?'取消完成':'完成'}：${entry.title}`} onClick={()=>setEntries(old=>old.map(e=>e.id===entry.id?{...e,done:!e.done}:e))}>{entry.done&&<Check size={19} strokeWidth={1.8}/>}</button>
   <div className="todo-task-content"><button className="todo-task-title" onClick={()=>edit(entry)} aria-label={'编辑待办：'+entry.title}>{entry.title}</button><p>{displayTime(entry.start)}{entry.end?' - '+displayTime(entry.end):''}</p>{(entry.dueDate||entry.subtasks.length>0)&&<div className="timeline-meta">{entry.dueDate&&<span className={'timeline-due'+(entry.dueDate<day?' overdue':'')}>{dueLabel(entry.dueDate,day)}</span>}{entry.subtasks.length>0&&<span aria-label={`子任务已完成 ${entry.subtasks.filter(s=>s.done).length} / ${entry.subtasks.length}`}>{entry.subtasks.filter(s=>s.done).length}/{entry.subtasks.length}</span>}</div>}</div>
   {entry.end&&<span className="todo-duration"><Clock3 size={12}/>{duration(entry)}</span>}
  </li>)}</ul>:<button className="todo-empty" onClick={()=>edit()}><Plus size={19}/><span>{filter==='all'?'为今天添加一件小事':'暂无这类记录'}</span></button>}
  <footer className="todo-sample-note"><span>{personal.filter(e=>e.type==='note').length} 篇日记 · {personal.filter(e=>e.type==='task'&&!e.done).length} 项待办</span><div className="todo-footer-actions"><button className="todo-filter" aria-label="筛选记录" aria-expanded={filtersOpen} aria-controls="timeline-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><ListFilter size={13}/></button></div></footer>
  {(notice||removed.length>0)&&<div className="timeline-notice" role="status"><span>{notice}</span>{removed.length>0&&<button onClick={undo}>撤销</button>}</div>}
  {storageError&&<p className="todo-form-error" role="alert">{storageError}</p>}
  </>}
  <Modal open={!!draft} onClose={()=>setDraft(null)} title={draft?.type==='note'?'编辑日记':'编辑待办'} className="timeline-modal">{draft&&<form className="timeline-editor" onSubmit={save}>
   <div className="timeline-editor-heading"><h2>{draft.type==='note'?'日记':'今日待办'}</h2><button type="button" className="timeline-icon" aria-label="关闭记录编辑" onClick={()=>setDraft(null)}><X size={20}/></button></div>
   {!entries.some(e=>e.id===draft.id)&&<label>记录类型<select className="field" aria-label="新增记录类型" value={draft.type} onChange={e=>{setDraft({...draft,type:e.target.value as Entry['type'],end:''});setFormError('');}}><option value="task">待办</option><option value="note">日记</option></select></label>}
   {draft.type==='task'?<label>待办名称<input aria-label="待办名称" maxLength={120} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="今天想完成什么？"/></label>:<label>日记内容<textarea aria-label="日记内容" rows={6} maxLength={10000} value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} placeholder="记录今天的想法…"/></label>}
   <div className="todo-time-fields"><label>记录时间<input type="time" aria-label="记录时间" required value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label>{draft.type==='task'&&<label>结束时间（可选）<input type="time" aria-label="结束时间" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label>}</div>
   {draft.type==='task'&&<><label>截止日期（可选）<input type="date" aria-label="截止日期" value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label><fieldset className="timeline-subtasks"><legend>子任务</legend>{draft.subtasks.map((s,index)=><div key={s.id}><input type="checkbox" aria-label={'完成子任务 '+(index+1)} checked={s.done} onChange={e=>setDraft({...draft,subtasks:draft.subtasks.map(item=>item.id===s.id?{...item,done:e.target.checked}:item)})}/><input aria-label={'子任务 '+(index+1)} maxLength={120} value={s.title} onChange={e=>setDraft({...draft,subtasks:draft.subtasks.map(item=>item.id===s.id?{...item,title:e.target.value}:item)})}/><button type="button" className="timeline-icon" aria-label={'删除子任务 '+(index+1)} onClick={()=>setDraft({...draft,subtasks:draft.subtasks.filter(item=>item.id!==s.id)})}><X size={15}/></button></div>)}<button type="button" className="timeline-add-subtask" onClick={()=>setDraft({...draft,subtasks:[...draft.subtasks,{id:crypto.randomUUID(),title:'',done:false}]})}><Plus size={14}/>添加子任务</button></fieldset></>}
   {formError&&<p className="todo-form-error" role="alert">{formError}</p>}
   <div className="todo-editor-actions">{entries.some(e=>e.id===draft.id)&&<button type="button" className="todo-delete" onClick={()=>remove([draft])}><Trash2 size={14}/>删除</button>}<button type="button" onClick={()=>setDraft(null)}>取消</button><button type="submit" className="todo-save">保存</button></div>
  </form>}</Modal>
 </div>;
}
