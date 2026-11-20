import {convertToExcalidrawElements} from '@excalidraw/excalidraw';
import type {ExcalidrawElementSkeleton} from '@excalidraw/excalidraw/data/transform';
import type {ExcalidrawElement} from '@excalidraw/excalidraw/element/types';
import type {BinaryFiles} from '@excalidraw/excalidraw/types';
import researchSource from '@/data/mobbin-research.json';
const research = {...researchSource, groups: researchSource.groups.filter(() => false)};
import {readAnalysisImage} from './product-analysis';

export const researchId=research.id;
export async function appendMobbinResearch(elements:readonly ExcalidrawElement[],files:BinaryFiles){
 if(elements.some(item=>item.customData?.mobbinResearch===research.id))return {elements,files};
 const pictures=await Promise.all(research.groups.flatMap(group=>group.screens).map(async screen=>{
  const response=await fetch(screen.image);if(!response.ok)throw new Error('无法读取 '+screen.name+' 截图');
  const image=await readAnalysisImage(new File([await response.blob()],screen.name+'.webp',{type:'image/webp'}));
  return {screen,image};
 }));
 const nextFiles={...files};for(const {image} of pictures)nextFiles[image.file.id]=image.file;
 const bottom=Math.max(-180,...elements.filter(e=>!e.isDeleted).map(e=>e.y+Math.abs(e.height)));
 const additions:ExcalidrawElementSkeleton[]=[];
 const text=(value:string,x:number,y:number,size=20,color='#44473f',link?:string)=>additions.push({type:'text',text:value,x,y,fontSize:size,fontFamily:2,strokeColor:color,link});
 for(const [groupIndex,group] of research.groups.entries()){
  const top=bottom+180+groupIndex*1460;
  text(group.title,80,top,32);text(group.intro,80,top+52,17,'#858579');
  text('来源：Mobbin MCP · 检索于 '+research.searchedAt.slice(0,10)+' · 页面版本以来源为准',80,top+84,14,'#858579');
  for(const [index,screen] of group.screens.entries()){
   const x=80+(index%3)*600,y=top+145+Math.floor(index/3)*530;
   const {image}=pictures.find(item=>item.screen.id===screen.id)!;
   additions.push({type:'rectangle',x,y,width:560,height:484,backgroundColor:'#ffffff',strokeColor:'#e1e1d8',fillStyle:'solid',roughness:0,roundness:{type:3}});
   text(screen.name,x+20,y+18,23,'#59624c',screen.source);
   const width=520,height=width*image.height/image.width;
   additions.push({type:'image',x:x+20,y:y+65,width,height,fileId:image.file.id,status:'saved',scale:[1,1],link:screen.source});
   text(screen.observation.match(/.{1,28}/gu)!.join('\n'),x+20,y+65+height+16,17);
   text('查看原始页面 ↗',x+20,y+454,14,'#858579',screen.source);
  }
  additions.push({type:'rectangle',x:80,y:top+1240,width:1760,height:145,backgroundColor:groupIndex?'#edf5e9':'#fff7df',strokeColor:'#dddfd2',fillStyle:'solid',roughness:0,roundness:{type:3}});
  text('设计观察与待验证问题',102,top+1258,20,'#66745a');text(group.summary,102,top+1300,19);
 }
 const converted=convertToExcalidrawElements(additions).map(element=>({...element,customData:{...element.customData,mobbinResearch:research.id}}));
 return {elements:[...elements,...converted],files:nextFiles};
}
