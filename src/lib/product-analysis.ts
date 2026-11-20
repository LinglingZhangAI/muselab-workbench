import type {ExcalidrawElementSkeleton} from '@excalidraw/excalidraw/data/transform';
import type {BinaryFileData} from '@excalidraw/excalidraw/types';

export const mobbinAI='https://mobbin.com/search/apps/web?content_type=apps&sort=popularity&filter=appCategories.AI';
export type AnalysisImage={file:BinaryFileData;width:number;height:number;name:string};
export type ProductAnalysis={title:string;source:string;images:AnalysisImage[];observations:string;ideas:string};
export function mobbinSource(value:string){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='mobbin.com'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
const ink='#44473f',muted='#89887e';
export function analysisElements(input:ProductAnalysis,y=0):ExcalidrawElementSkeleton[]{
 const result:ExcalidrawElementSkeleton[]=[];
 const text=(value:string,x:number,top:number,size=20,color=ink)=>result.push({type:'text',x,y:top+y,text:value,fontSize:size,fontFamily:2,strokeColor:color});
 const rect=(x:number,top:number,width:number,height:number,fill:string,stroke='#e2e1d9',dashed=false)=>result.push({type:'rectangle',x,y:top+y,width,height,backgroundColor:fill,strokeColor:stroke,strokeStyle:dashed?'dashed':'solid',fillStyle:'solid',roughness:0.6,roundness:{type:3}});
 const count=input.images.length||4;const step=330;const width=Math.max(1320,count*step);
 text(input.title,80,32,32);
 const source=mobbinSource(input.source)||mobbinAI;
 result.push({type:'text',x:80,y:y+83,text:'来源 · Mobbin ↗',fontSize:15,fontFamily:2,strokeColor:muted,link:source});
 text(input.images.length?'01  现有产品流程 · 按导入顺序排列':'01  现有产品流程 · 待导入页面截图',80,143,22,'#a66d65');
 const pageHeight=Math.max(280,...input.images.map(image=>Math.min(430,290/image.width*image.height)));
 for(let i=0;i<count;i++){
  const x=80+i*step;const image=input.images[i];
  text(String(i+1).padStart(2,'0'),x+5,193,16,'#a66d65');
  rect(x,227,300,pageHeight+20,'#fff');
  if(image){
   const scale=Math.min(280/image.width,(pageHeight-4)/image.height);const w=image.width*scale,h=image.height*scale;
   result.push({type:'image',x:x+(300-w)/2,y:y+237+(pageHeight-h)/2,width:w,height:h,fileId:image.file.id,status:'saved',scale:[1,1]});
  }else text('导入页面截图\n\n入口 / 核心操作 / 结果',x+32,320,17,muted);
  text(image?(image.name.length>22?image.name.slice(0,20)+'…':image.name):'页面 '+(i+1),x+5,261+pageHeight,15,muted);
  if(i<count-1)result.push({type:'arrow',x:x+306,y:y+230+pageHeight/2,width:19,height:0,points:[[0,0],[19,0]],startArrowhead:null,endArrowhead:'arrow',strokeColor:'#a4a395',roughness:0.5});
 }
 const noteY=320+pageHeight;
 rect(80,noteY,width*.57,210,'#fff1ef','#ecd8d3');
 text('02  问题观察',102,noteY+20,21,'#a66d65');
 text(wrap(input.observations||'待分析：用户想完成什么？\n哪里需要停下来思考？\n有哪些可省略、延后或合并的步骤？',Math.floor(width*.57/19)),102,noteY+65,19);
 rect(105+width*.57,noteY,width*.43-25,210,'#fff7d9','#eee1ae');
 text('研究备注 · 待验证',127+width*.57,noteY+20,21,'#8a7944');
 text('记录实际观察与使用反馈。\n问题假设需要验证，\n不将模板提示当作用户结论。',127+width*.57,noteY+66,18,'#7e765b');
 const ideaY=noteY+285;
 result.push({type:'line',x:80,y:y+ideaY-32,width,height:0,points:[[0,0],[width,0]],strokeStyle:'dashed',strokeColor:'#dddcd3'});
 text('03  改进方案 · 在这里继续画',80,ideaY,23,'#66816c');
 for(let i=0;i<3;i++){
  rect(80+i*260,ideaY+65,220,170,'#fff','#cbd9cd',true);
  text(['用户目标','关键操作','看到结果'][i],105+i*260,ideaY+105,20,'#66816c');
  text('双击编辑，或添加新的页面',99+i*260,ideaY+160,14,muted);
  if(i<2)result.push({type:'arrow',x:308+i*260,y:y+ideaY+140,width:25,height:0,points:[[0,0],[25,0]],startArrowhead:null,endArrowhead:'arrow',strokeColor:'#95a397'});
 }
 rect(880,ideaY+65,Math.max(420,width-800),210,'#edf5e9','#d4e3ce');
 text('希望带来什么变化？',902,ideaY+86,21,'#66816c');
 text(wrap(input.ideas||'待验证：更早看到产品价值\n减少不必要的输入\n在需要的时候再补充信息',Math.floor(Math.max(420,width-800)/19)),902,ideaY+132,19);
 return result;
}
function wrap(value:string,width:number){return value.split('\n').flatMap(line=>line.match(new RegExp('.{1,'+Math.max(12,width)+'}','gu'))||['']).join('\n');}

export async function readAnalysisImage(file:File):Promise<AnalysisImage>{
 if(!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type)||file.size>8*1024*1024)throw new Error('请选择 PNG、JPG、WebP 或 AVIF，每张不超过 8 MB');
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法读取「'+file.name+'」'));img.src=url;});
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('图片尺寸无效');
  const scale=Math.min(1,1600/image.naturalWidth,5000/image.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const context=canvas.getContext('2d');if(!context)throw new Error('暂时无法处理图片');context.drawImage(image,0,0,canvas.width,canvas.height);
  const dataURL=canvas.toDataURL('image/webp',.92) as BinaryFileData['dataURL'];
  return {file:{id:crypto.randomUUID() as BinaryFileData['id'],mimeType:dataURL.startsWith('data:image/webp')?'image/webp':'image/png',dataURL,created:Date.now()},width:canvas.width,height:canvas.height,name:file.name.replace(/\.[^.]+$/,'')};
 }finally{URL.revokeObjectURL(url);}
}
