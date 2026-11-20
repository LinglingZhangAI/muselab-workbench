import {convertToExcalidrawElements} from '@excalidraw/excalidraw';
import type {ExcalidrawElementSkeleton} from '@excalidraw/excalidraw/data/transform';
import type {ExcalidrawElement} from '@excalidraw/excalidraw/element/types';
import type {BinaryFiles} from '@excalidraw/excalidraw/types';
import catalogSource from '@/data/mobbin-research.json';
const catalog = {...catalogSource, groups: catalogSource.groups.filter(() => false)};
import {aiComparisons,chartNotes,evidenceNotes,opportunities,pmResearchId,pmSections} from '@/data/pm-analysis';
import {readAnalysisImage} from './product-analysis';

export {pmResearchId,pmSections};
function wrapCell(value:string,maxWidth:number,fontSize:number){
 return value.split('\n').flatMap(line=>{const rows:string[]=[];let row='',width=0;for(const char of line){const next=/[\u0000-\u007f]/.test(char)?fontSize*.55:fontSize;if(width+next>maxWidth&&row){rows.push(row);row='';width=0;}row+=char;width+=next;}rows.push(row);return rows;}).join('\n');
}
export async function appendPMAnalysis(elements:readonly ExcalidrawElement[],files:BinaryFiles){
 if(elements.some(e=>e.customData?.pmResearch===pmResearchId))return {elements,files};
 const screens=catalog.groups.flatMap(g=>g.screens);
 const names=[...evidenceNotes,...chartNotes].map(n=>n.name);
 const nextFiles={...files};
 const pictures=await Promise.all(names.map(async name=>{
  const screen=screens.find(s=>s.name===name)!;
  const old=elements.find(e=>e.type==='image'&&e.link===screen.source);
  if(old?.type==='image'&&old.fileId&&files[old.fileId])return {name,screen,fileId:old.fileId,ratio:old.height/old.width};
  const response=await fetch(screen.image);if(!response.ok)throw new Error('无法读取 '+name);
  const image=await readAnalysisImage(new File([await response.blob()],name+'.webp',{type:'image/webp'}));
  nextFiles[image.file.id]=image.file;return {name,screen,fileId:image.file.id,ratio:image.height/image.width};
 }));
 // Append beside the existing gallery so all previous drawings and edits stay in place.
 const originX=elements.length?Math.max(...elements.filter(e=>!e.isDeleted).map(e=>e.x+Math.abs(e.width)),0)+240:80;
 const shapes:ExcalidrawElementSkeleton[]=[];const sectionForShape:string[]=[];let section='decision',baseY=0;
 function add(shape:ExcalidrawElementSkeleton){shapes.push(shape);sectionForShape.push(section);}
 function text(value:string,x:number,y:number,size=24,color='#30352f',link?:string){add({type:'text',x:originX+x,y:baseY+y,text:value,fontFamily:2,fontSize:size,strokeColor:color,link});}
 function rect(x:number,y:number,w:number,h:number,fill='#fff',stroke='#dcdfd5'){add({type:'rectangle',x:originX+x,y:baseY+y,width:w,height:h,backgroundColor:fill,strokeColor:stroke,roughness:0,fillStyle:'solid',roundness:{type:3}});}
 function arrow(x:number,y:number,w:number,h=0){add({type:'arrow',x:originX+x,y:baseY+y,width:w,height:h,points:[[0,0],[w,h]],endArrowhead:'arrow',strokeColor:'#8a9482',roughness:0});}
 function start(id:typeof pmSections[number]['id'],subtitle:string){
  const meta=pmSections.find(s=>s.id===id)!;section=id;baseY=meta.y;
  rect(0,0,2200,meta.height,'#fbfaf7','#d7dbd0');text(meta.label,48,40,36);text(subtitle,48,101,22,'#777e70');
 }
 function panel(x:number,y:number,w:number,h:number,title:string,body:string,fill='#fff'){rect(x,y,w,h,fill);text(title,x+26,y+24,28);text(body,x+26,y+80,24);}
 function screenshot(name:string,x:number,y:number,width:number,region:{x:number;y:number;w:number;h:number}){
  const p=pictures.find(p=>p.name===name)!;const h=width*p.ratio;
  add({type:'image',x:originX+x,y:baseY+y,width,height:h,fileId:p.fileId,status:'saved',scale:[1,1]});
  add({type:'rectangle',x:originX+x+region.x*width,y:baseY+y+region.y*h,width:region.w*width,height:region.h*h,strokeColor:'#b26848',strokeWidth:3,backgroundColor:'transparent',roughness:0});
  text('来源 ↗',x+width-85,y+h+13,18,'#6f7967',p.screen.source);
  return h;
 }

 start('decision','Muselab · 从界面参考走向产品决策 · 研究日期 2026-10-23');
 text('研究问题：怎样让每天收集的信息，变成下次工作能直接使用的产物？',48,172,32);
 panel(48,255,665,285,'核心使用者 · 本次研究假设','在 Codex 工作的设计师 / 产品经理。\n已有资讯、播客、素材与笔记，\n希望少搬运、能找回、可继续使用。\n依据：Muselab 当前需求与功能。','#edf2e8');
 panel(765,255,665,285,'关键判断 · 优先打通结果去向','更具体的任务入口 + 可解释状态\n+ 可追溯产物，比增加入口更重要。\n证据 A / B / C 支持设计机制借鉴；\n对使用效果的判断仍需验证。','#fff5db');
 panel(1482,255,665,285,'决策建议 · 三个投入顺序','P0  长任务状态与结果找回\nP1  来源、预览与再次使用\nP2  可解释的工作回顾\n建议优先级，尚未排期或实施。');
 text('阅读路径',48,601,26);['对照同一任务','查看截图证据','讨论方案取舍','验证实际效果'].forEach((label,i)=>{rect(48+i*530,655,475,82,'#fff');text(label,72+i*530,680,26);if(i<3)arrow(528+i*530,695,44);});
 text('证据口径：12 张 Mobbin 截图，采集于 2026-10-23；6 张用于重点标注。各产品版本与页面状态可能不同。',48,783,21,'#777e70');
 text('绿色：截图事实    黄色：产品判断    白色：建议 / 待验证。未覆盖完整旅程、价格、性能或真实转化率。',48,826,21,'#777e70');

 start('comparison','按用户任务和交互机制对照；不以主观打分把不同品类排成名次');
 const columns=[240,335,370,340,340,475];const headers=['产品 / 参考角色','用户要完成什么','第一步怎么开始','资料与预期','历史 / 产物线索','取舍与 Muselab 借鉴'];
 let cx=40;for(let i=0;i<columns.length;i++){rect(cx,165,columns[i],66,'#e8ede3');text(headers[i],cx+14,185,22);cx+=columns[i];}
 for(const [i,row] of aiComparisons.entries()){
  const values=[row.name+'\n'+(i<3?'工作助手参考':'机制参考'),row.task,row.entry,row.context,row.returning,row.tradeoff+'\n'+row.lesson];let x=40;
  for(let j=0;j<columns.length;j++){rect(x,231+i*145,columns[j],145,i%2?'#f5f5ef':'#fff');text(wrapCell(values[j],columns[j]-28,22),x+14,255+i*145,22,j===0?'#4d6547':'#30352f',j===0?screens.find(s=>s.name===row.name)?.source:undefined);x+=columns[j];}
 }
 text('比较边界：Dash / ClickUp / Sana 更接近工作助手；Krea 的视觉创作、Pi 的对话、Cohere 的模式选择用于机制借鉴。',48,1140,22,'#777e70');
 text('表格中的“未展示”只描述当前截图，不代表产品没有该能力；本次未覆盖价格、保存权限与完整任务成功率。',48,1190,22,'#777e70');

 start('evidence','从截图区域 → 设计机制 → Muselab 决策，逐条连接；A / B / C 对应后面的机会卡');
 for(const [i,note] of evidenceNotes.entries()){
  const x=40+i*715;rect(x,165,690,1075,'#fff');text(String.fromCharCode(65+i)+' · '+note.name,x+22,184,28);text(note.tag,x+22,228,22,'#777e70');
  const h=screenshot(note.name,x+22,280,646,note.region);const y=280+h+55;
  rect(x+18,y,654,130,'#edf2e8');text('截图事实',x+34,y+15,21,'#59704e');text(note.fact,x+34,y+51,22);
  rect(x+18,y+145,654,130,'#fff5db');text('产品判断 · 待验证',x+34,y+160,21,'#8d7442');text(note.judgment,x+34,y+196,22);
  text('应用建议',x+34,y+302,21,'#59704e');text(note.proposal,x+34,y+340,22);text(note.risk,x+34,y+425,18,'#777e70');
 }

 start('charts','回答“怎样理解今天的工作”，再决定需要哪种图表；D / E / F 是设计机制参考');
 for(const [i,note] of chartNotes.entries()){
  const x=40+i*715;rect(x,165,690,780,'#fff');text(String.fromCharCode(68+i)+' · '+note.name+' / '+note.title,x+22,184,25);
  const h=screenshot(note.name,x+22,244,646,note.region);const y=244+h+48;
  text('截图事实',x+22,y,21,'#59704e');text(note.fact,x+22,y+38,22);text('对 Muselab 的取舍',x+22,y+116,21,'#8d7442');text(note.decision,x+22,y+154,22);
 }
 panel(40,981,2120,165,'建议：优先可追溯的时间线，暂缓通用图表编辑器','Better Stack / Retool / Zendesk 补充了配置器与类型选择参考，原始截图保留在素材区。\n时间线只表示记录区间；未覆盖的聊天、缺失时间和加载失败应显式说明，不推导“实际投入工时”。','#fff5db');

 start('journey','以下为 Muselab 建议流程，并非竞品实际旅程；在现有播客、笔记和语雀能力上讨论优化');
 const steps=[
  ['选定内容','具体节目 / 文章 / 素材','避免重新粘贴资料'],
  ['选择产物','文章 / 摘录 / Prompt','预览结构与处理范围'],
  ['后台整理','状态、来源、失败原因','可离开，不阻断收听'],
  ['编辑与保存','回到同一份结果继续改','保留用户编辑与原始来源'],
  ['再次使用','笔记 / Codex / 语雀','确认去向与真实回执'],
 ];
 steps.forEach((step,i)=>{const x=40+i*430;rect(x,200,400,245,i===2?'#fff5db':'#edf2e8');text(String(i+1).padStart(2,'0'),x+22,221,22,'#777e70');text(step[0],x+22,265,30);text(step[1],x+22,326,22);text(step[2],x+22,381,20,'#777e70');if(i<4)arrow(x+403,320,24);});
 panel(40,512,1040,260,'异常分支也要有出口','字幕未完成 → 展示当前阶段，可继续收听。\n整理失败 → 保留已有内容，允许重试。\n笔记已有文章 → 打开已有结果，避免重复创建。\n语雀失败 → 保留本机笔记，反馈实际失败原因。');
 panel(1120,512,1040,260,'本轮取舍 · 建议而非已实现','采用：任务入口、连续状态、来源与产物关联。\n暂缓：从头搭建通用聊天、复杂模型面板。\n沿用：现有笔记、播放进度、文章任务与导出。\n待补证据：用户是否能自行找回上次的产物。','#fff5db');
 text('建议衡量：从选定内容到第一次打开可用产物的耗时；任务找回成功；重复创建；导出失败与恢复。',48,836,23,'#777e70');
 text('先记录基线，再与改版对照；不给截图附加未经测量的转化提升。',48,888,23,'#777e70');

 start('validation','优先级依据：主任务连续性 → 资产复用 → 回顾增强；成本为分析估计，需工程评估');
 for(const [i,item] of opportunities.entries()){
  const x=40+i*715;rect(x,165,690,950,'#fff');rect(x+20,188,78,50,i===0?'#30352f':'#edf2e8');text(item.priority,x+33,201,24,i===0?'#fff':'#4d6547');text(item.title,x+115,199,26);
  text(item.source,x+24,268,21,'#777e70');text('建议做什么',x+24,327,23,'#59704e');text(item.proposal,x+24,372,23);
  text('取舍与成本',x+24,496,23,'#8d7442');text(item.tradeoff,x+24,542,23);text(item.cost,x+24,628,20,'#777e70');
  text('验证任务与观测',x+24,698,23,'#59704e');text(item.test,x+24,746,22);text(item.gate,x+24,853,22);
 }
 text('验证建议：先请实际使用者完成同一任务并记录困难；样本与周期确定后，再设置量化阈值。当前无真实用户测试结果。',48,1150,21,'#777e70');
 const converted=convertToExcalidrawElements(shapes).map((e,i)=>({...e,customData:{...e.customData,pmResearch:pmResearchId,pmSection:sectionForShape[i]}}));
 return {elements:[...elements,...converted],files:nextFiles};
}
