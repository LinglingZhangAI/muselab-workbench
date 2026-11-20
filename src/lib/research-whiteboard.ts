import {convertToExcalidrawElements} from '@excalidraw/excalidraw';
import type {ExcalidrawElementSkeleton} from '@excalidraw/excalidraw/data/transform';
import type {ExcalidrawElement} from '@excalidraw/excalidraw/element/types';
import type {BinaryFiles} from '@excalidraw/excalidraw/types';
import {readAnalysisImage} from './product-analysis';
import {validateResearchResult,type ResearchJob} from './research';

export async function researchElements(job:ResearchJob,originX:number){
 if(job.status!=='completed'||!job.result)throw new Error('研究尚未完成');
 const r=validateResearchResult(job.result,job.images.map(image=>image.id));
 const files:BinaryFiles={};
 const images=await Promise.all(job.images.map(async image=>{
  if(!/^\/assets\/research\/[0-9a-f-]{36}\/\d+\.(webp|png|jpg)$/.test(image.url))throw new Error('研究截图地址无效');
  const response=await fetch(image.url);if(!response.ok)throw new Error('研究截图无法读取');
  const value=await readAnalysisImage(new File([await response.blob()],image.name,{type:response.headers.get('content-type')||'image/webp'}));
  files[value.file.id]=value.file;return {...image,fileId:value.file.id};
 }));
 const shapes:ExcalidrawElementSkeleton[]=[];const sections:string[]=[];let section='overview',y=0;
 const context=document.createElement('canvas').getContext('2d')!;
 const wrap=(value:string,width:number,size:number)=>{context.font=`${size}px Arial`;return value.split('\n').flatMap(line=>{const rows:string[]=[];let row='';for(const char of line){if(row&&context.measureText(row+char).width>width){rows.push(row);row='';}row+=char;}rows.push(row);return rows;}).join('\n');};
 function add(value:ExcalidrawElementSkeleton){shapes.push(value);sections.push(section);}
 function text(value:string,x:number,top:number,width=1240,size=21,color='#333830',link?:string){const content=wrap(value,width,size);add({type:'text',x:originX+x,y:top,text:content,fontFamily:2,fontSize:size,strokeColor:color,link});return content.split('\n').length*size*1.4+8;}
 function box(x:number,top:number,width:number,height:number,fill='#fff'){add({type:'rectangle',x:originX+x,y:top,width,height,backgroundColor:fill,fillStyle:'solid',strokeColor:'#dedfd7',strokeWidth:1,roughness:0,roundness:{type:3}});}
 function heading(number:string,title:string,subtitle:string){y+=65;y+=text(number+'  '+title,0,y,1280,31,'#20261f');y+=text(subtitle,0,y,1280,17,'#7b8176')+15;}
 function card(title:string,items:[string,string][],x:number,top:number,width:number,fill='#fff'){
  const index=shapes.length;box(x,top,width,100,fill);let cursor=top+24;
  cursor+=text(title,x+24,cursor,width-48,24,'#283526')+12;
  for(const [label,value] of items){cursor+=text(label,x+24,cursor,width-48,16,'#77806e');cursor+=text(value,x+24,cursor,width-48,20)+16;}
  shapes[index]={...shapes[index],height:cursor-top+8};return cursor+8;
 }
 y+=text('MUSELAB / PRODUCT RESEARCH',0,y,1280,16,'#858a7c');y+=20;
 y+=text(r.title,0,y,1280,42,'#20261f');y+=text('竞品分析 · '+new Date(job.createdAt).toLocaleDateString('zh-CN')+' · AI 辅助研究，可编辑',0,y,1280,17,'#7d8277');
 heading('01','研究结论','先回答决策问题，再区分已知事实和待验证项。');
 y=card(r.question,[['目标用户',r.audience],['核心判断',r.summary],['研究边界 / 待补信息',r.limitations]],0,y,1280,'#f0f2e9');
 section='comparison';heading('02','竞品对照','以相同任务比较；未提供的产品事实以假设或待补充标注。');
 for(let index=0;index<r.comparisons.length;index+=2){let bottom=y;for(const [offset,item] of r.comparisons.slice(index,index+2).entries())bottom=Math.max(bottom,card(item.product,[['用户任务',item.task],['实现方式',item.approach],['值得借鉴',item.strength],['取舍与限制',item.tradeoff],['截图依据',item.evidenceIds.join(' / ')||'无截图依据，见材料及待验证项']],offset*652,y,628));y=bottom+24;}
 section='evidence';heading('03','证据与判断','观察 → 解释 → 建议。截图编号对应下方原始参考。');
 for(const item of r.findings)y=card(item.title,[['观察事实 · '+(item.evidenceIds.join(' / ')||'无截图依据'),item.observation],['产品判断',item.interpretation],['应用建议',item.recommendation],['待验证',item.uncertainty]],0,y,1280)+24;
 for(let index=0;index<images.length;index+=3){let bottom=y;for(const [offset,image] of images.slice(index,index+3).entries()){
  const x=offset*432,width=400,height=Math.min(580,width*image.height/image.width);box(x,y,416,height+110,'#fff');
  text(image.id+' · '+image.name,x+12,y+14,392,18);add({type:'image',x:originX+x+8+(400-height*image.width/image.height)/2,y:y+70,width:height*image.width/image.height,height,fileId:image.fileId,link:new URL(image.url,location.origin).href});bottom=Math.max(bottom,y+height+110);
 }y=bottom+24;}
 section='journey';heading('04','建议任务流程','以下是建议方案，需要通过真实任务验证。');
 for(const [index,item] of r.journey.entries()){y=card(String(index+1).padStart(2,'0')+'  '+item.step,[['用户动作 / 产品响应',item.action],['关键风险',item.risk]],0,y,1280,'#f5f4ee');if(index<r.journey.length-1){add({type:'arrow',x:originX+640,y:y+8,width:0,height:34,points:[[0,0],[0,34]],startArrowhead:null,endArrowhead:'arrow',strokeColor:'#8c967c',roughness:0});y+=58;}}
 section='validation';heading('05','优先级与验证','优先级为当前材料下的建议，验证后再决定投入。');
 for(const item of r.opportunities)y=card(item.priority+'  '+item.title,[['建议方案',item.proposal],['判断依据 · '+(item.evidenceIds.join(' / ')||'待验证假设'),item.rationale],['投入与依赖',item.effort],['验证方法',item.validation],['建议通过标准',item.successCriteria]],0,y,1280,item.priority==='P0'?'#edf1e6':'#fff')+24;
 section='sources';heading('06','研究输入与来源','保留要求与来源，便于复核和后续补充。');
 y=card('原始分析要求',[['用户输入',job.requirements]],0,y,1280);
 for(const link of job.links)y+=text(link,0,y+16,1280,18,'#5d7351',link)+16;
 const elements=convertToExcalidrawElements(shapes).map((element,index)=>({...element,customData:{researchJob:job.id,researchTitle:r.title,researchSection:sections[index]}}));
 return {elements,files};
}

export function researchNavigation(elements:readonly ExcalidrawElement[]){
 const found=new Map<string,string>();for(const item of elements)if(!item.isDeleted&&typeof item.customData?.researchJob==='string')found.set(item.customData.researchJob,String(item.customData.researchTitle||'产品研究'));
 return [...found].map(([id,label])=>({id:'research:'+id,label}));
}
