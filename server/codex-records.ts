import {spawn} from 'node:child_process';
import {access,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {shanghaiDay} from './news-source';
import {workItemsFromRecords} from '../src/lib/work-task-summary';

type Message={type:string;text?:string;phase?:string;content?:{type:string;text?:string}[]};
type Turn={id:string;status:string;startedAt:number|null;completedAt:number|null;items:Message[]};
type Thread={id:string;name:string|null;updatedAt:number;parentThreadId?:string|null};
type Item={title:string;detail:string;status:string;threadId:string;threadTitle:string};
type RecordItem=Item&{id:string;start:string;end:string};
export type BriefData={date:string;updatedAt:string;greeting:string;work:Item[];updates:Item[];timeline:RecordItem[];coverage:string;[key:string]:unknown};
type Page<T>={data:T[];nextCursor?:string|null};
const cliCandidates=[process.env.MUSELAB_CODEX_CLI,'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','/Applications/Codex.app/Contents/Resources/codex'].filter((p):p is string=>!!p);

// This client can only list/read history. It never starts turns or invokes models.
async function historyClient(){
 let binary='';for(const candidate of cliCandidates){try{await access(candidate);binary=candidate;break;}catch{/* Try the next installed CLI. */}}
 if(!binary)throw new Error('未找到本机 Codex，请打开 Codex 后重试');
 const child=spawn(binary,['app-server','--stdio'],{stdio:['pipe','pipe','ignore']});
 const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 let sequence=0;let closed=false;
 function fail(){closed=true;for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Codex 记录服务连接中断'));}pending.clear();}
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{
  let message;try{message=JSON.parse(line);}catch{return;}
  const request=pending.get(message.id);if(!request)return;
  clearTimeout(request.timer);pending.delete(message.id);
  if(message.error)request.reject(new Error('该聊天记录暂不支持读取'));else request.resolve(message.result);
 });
 child.on('error',fail);child.on('exit',fail);
 async function call<T>(method:string,params:unknown):Promise<T>{
  if(!['initialize','thread/list','thread/turns/list'].includes(method))throw new Error('仅支持读取工作记录');
  if(closed)throw new Error('Codex 记录服务未连接');
  return new Promise((resolve,reject)=>{
   const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('读取 Codex 记录超时，请稍后重试'));},15000);
   pending.set(id,{resolve:value=>resolve(value as T),reject,timer});
   child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(new Error('Codex 记录服务未连接'));}});
  });
 }
 function close(){lines.close();child.stdin.destroy();child.kill();fail();}
 try{await call('initialize',{clientInfo:{name:'muselab-work-records',version:'1.0.0'},capabilities:{experimentalApi:true}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');}catch(error){close();throw error;}
 return {call,close};
}

// Only short final-answer summaries enter the library; tools/reasoning/user inputs do not.
function summary(text:string){
 return text.replace(/<heartbeat>[\s\S]*?<\/heartbeat>/g,'').replace(/```[\s\S]*?```/g,'')
  .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+|codex:\/\/\S+/g,'')
  .replace(/\b(?:sk|sess|ghp|github_pat)[-_][a-zA-Z0-9_-]{10,}\b/g,'[已隐藏]')
  .replace(/(?:api[_ -]?key|authorization|password|secret|token|密钥|令牌)\s*[:=：]\s*\S+/gi,'[敏感字段已隐藏]')
  .replace(/(?:\/Users\/|\/private\/|\/var\/|\/tmp\/)[^\s，。；）)]+/g,'本地文件')
  .replace(/[*#`_>]/g,'').replace(/\s+/g,' ').trim().slice(0,320);
}
function finalResult(turn:Turn){
 return turn.items.filter(i=>i.type==='agentMessage'&&i.phase==='final_answer').map(i=>i.text||'').join('\n');
}
function automated(turn:Turn){return turn.items.some(i=>i.type==='userMessage'&&i.content?.some(c=>c.type==='text'&&/<heartbeat>/.test(c.text||'')));}
const success=/(?:已(?:经)?(?:完成|实现|修复|接入|更新|调整|统一|新增|设置|去掉|改|保存|补充|将|把|验证|生成)|(?:构建|验证|检查|测试)通过|本次新增\s*\d|新增\s*\d+\s*张|均已保存|完成了)/;
const blocked=/(?:失败|无法|未能|未生成|未发送|暂未|需要.{0,12}(?:登录|授权|输入)|空白|受阻)/;
const hasBlocker=(text:string)=>blocked.test(text.replace(/(?:遇到|如果|如遇|一旦|若)[^。；！？]*(?:[。；！？]|$)/g,''));

export async function collectCodexBrief(root:string):Promise<{brief:BriefData;warning:string}>{
 const day=shanghaiDay();const now=Date.now();const deadline=now+70000;
 const client=await historyClient();
 const threads:Thread[]=[];const failures:string[]=[];const turnsByThread=new Map<string,Turn[]>();let limited=false;
 try{
  for(const archived of [false,true]){
   let cursor:string|null=null;
   for(let page=0;page<4;page++){
    const result:Page<Thread>=await client.call('thread/list',{limit:50,cursor,sortKey:'updated_at',sortDirection:'desc',archived,useStateDbOnly:true});
    threads.push(...result.data.filter(t=>!t.parentThreadId&&shanghaiDay(new Date(t.updatedAt*1000))>=day));
    if(!result.nextCursor||result.data.some(t=>shanghaiDay(new Date(t.updatedAt*1000))<day))break;
    cursor=result.nextCursor;if(page===3)limited=true;
   }
  }
  const unique=[...new Map(threads.map(t=>[t.id,t])).values()];
  for(const thread of unique){
   if(Date.now()>deadline){failures.push(thread.id);continue;}
   const turns:Turn[]=[];let cursor:string|null=null;
   try{
    for(let page=0;page<20;page++){
     const result:Page<Turn>=await client.call('thread/turns/list',{threadId:thread.id,cursor,limit:25,sortDirection:'desc',itemsView:'summary'});
     turns.push(...result.data.filter(t=>t.startedAt&&shanghaiDay(new Date(t.startedAt*1000))===day));
     if(!result.nextCursor||result.data.some(t=>t.startedAt&&shanghaiDay(new Date(t.startedAt*1000))<day))break;
     cursor=result.nextCursor;if(page===19||Date.now()>deadline){limited=true;break;}
    }
    turnsByThread.set(thread.id,turns);
   }catch{failures.push(thread.id);}
  }
  if(unique.length&&!turnsByThread.size)throw new Error('今天的聊天记录暂时无法读取，已保留上次记录');
 }finally{client.close();}
 const work:Item[]=[];const updates:Item[]=[];const timeline:RecordItem[]=[];
 for(const thread of [...new Map(threads.map(t=>[t.id,t])).values()]){
  // Untitled history cannot be represented faithfully; do not invent a chat name.
  if(!thread.name||!turnsByThread.has(thread.id))continue;
  const completed=(turnsByThread.get(thread.id)||[]).filter(t=>t.status==='completed'&&!automated(t)&&finalResult(t).trim()).sort((a,b)=>(a.startedAt||0)-(b.startedAt||0));
  const results=completed.map(turn=>({turn,detail:summary(finalResult(turn))})).filter(r=>r.detail);
  const delivered=results.filter(r=>success.test(r.detail));
  if(delivered.length){const last=delivered.at(-1)!;work.push({title:summary(thread.name).slice(0,80),detail:delivered.slice(-3).map(r=>r.detail.slice(0,160)).join('；').slice(0,480),status:'已完成',threadId:thread.id,threadTitle:thread.name});}
  const issue=results.filter(r=>hasBlocker(r.detail)).at(-1);
  const latest=results.at(-1);
  if(issue&&issue===latest){updates.push({title:summary(thread.name).slice(0,80)+' · 需要关注',detail:issue.detail,status:success.test(issue.detail)?'部分完成':'失败',threadId:thread.id,threadTitle:thread.name});}
  for(const {turn,detail}of delivered){
   if(!turn.startedAt||!turn.completedAt||turn.completedAt<turn.startedAt||shanghaiDay(new Date(turn.completedAt*1000))!==day)continue;
   const title=detail.split(/[。！\n]/)[0].slice(0,48)||thread.name;
   timeline.push({id:'codex-'+turn.id,title,detail,status:'已完成',start:new Date(turn.startedAt*1000).toISOString(),end:new Date(turn.completedAt*1000).toISOString(),threadId:thread.id,threadTitle:thread.name});
  }
 }
 const file=path.join(root,'data/daily-brief.json');let previous:Partial<BriefData>={};
 try{previous=JSON.parse(await readFile(file,'utf8'));}catch{/* A valid new snapshot can initialize the brief. */}
 if(previous.date===day&&failures.length){
  for(const key of ['work','updates','timeline'] as const){const retained=(previous[key]||[]).filter(i=>failures.includes(i.threadId));if(key==='work')work.push(...retained);else if(key==='updates')updates.push(...retained);else timeline.push(...retained as RecordItem[]);}
 }
 timeline.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 const warning=failures.length?`${failures.length} 个聊天暂不可读，保留这些聊天的上次记录`:limited?'本次读取达到数量上限，可能未覆盖全部记录':'';
 const brief:BriefData={...previous,date:day,updatedAt:new Date().toISOString(),greeting:'看看今天的新进展。',work:timeline.length?workItemsFromRecords(timeline):work,updates,timeline,
  coverage:`按上海日期 ${day} 读取本机 Codex 中当日活跃的 ${turnsByThread.size} 个聊天（含归档），从有最终回复和完成时间的轮次提取短摘要，按聊天汇总工作。只将明确报告交付的轮次列入时间线；不将计划、问题、未结束轮次视为完成。不含远程及未同步到本机的聊天。${warning?warning+'。':''}时间为聊天记录区间，允许重叠，不代表持续工时。`};
 delete brief.newsCount;delete brief.stale;delete brief.today;
 if(shanghaiDay()!==day)throw new Error('日期已切换，请重新刷新，旧记录已保留');
 if(new Set(timeline.map(t=>t.id)).size!==timeline.length||timeline.some(t=>Date.parse(t.end)<Date.parse(t.start)))throw new Error('工作记录校验失败，旧记录已保留');
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(brief,null,2)+'\n',{flag:'wx',mode:0o600});JSON.parse(await readFile(temp,'utf8'));await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
 return {brief,warning};
}
