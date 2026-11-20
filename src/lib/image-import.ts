import type {Asset} from '@/data/assets';

export const imageTypes=['image/png','image/jpeg','image/webp','image/avif'];
export async function assetFromFile(file:File,folder:string,sourceUrl=''):Promise<Asset>{
 if(!imageTypes.includes(file.type))throw new Error('请选择 PNG、JPG、WebP 或 AVIF 图片');
 if(file.size>3*1024*1024)throw new Error('每张图片请控制在 3 MB 以内');
 const objectUrl=URL.createObjectURL(file);
 let dimensions:{width:number;height:number};
 try{
  dimensions=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('这张图片无法读取，请换一张试试'));image.src=objectUrl;});
 }finally{URL.revokeObjectURL(objectUrl);}
 const response=await fetch('/api/images/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'图片保存失败');
 if(typeof result.imageUrl!=='string'||!/^\/assets\/uploads\/[a-f0-9-]+\.(png|jpg|webp|avif)$/.test(result.imageUrl))throw new Error('图片保存结果无效');
 return {id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'')||'未命名图片',imageUrl:result.imageUrl,...dimensions,prompt:'',sourceUrl,tags:[],folder,palette:[],favorite:false,deleted:false,createdAt:new Date().toLocaleDateString('en-CA'),format:result.format,analysisStatus:'pending'};
}
export async function fileFromUrl(url:string){
 if(url.startsWith('data:image/')){
  if(url.length>4.3*1024*1024)throw new Error('每张图片请控制在 3 MB 以内');
  const blob=await (await fetch(url)).blob();return new File([blob],'粘贴图片.'+(blob.type.split('/')[1]||'png'),{type:blob.type});
 }
 const response=await fetch('/api/images/remote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
 if(!response.ok){const result=await response.json();throw new Error(result.error||'网页图片无法读取');}
 const blob=await response.blob();let name='网页图片';
 try{name=decodeURIComponent(new URL(url).pathname.split('/').pop()||name).slice(0,140);}catch{/* Use the default image name. */}
 return new File([blob],name,{type:blob.type});
}
export function droppedImageUrls(data:DataTransfer){
 const urls:string[]=[];
 const html=data.getData('text/html');
 if(html){const doc=new DOMParser().parseFromString(html,'text/html');for(const img of doc.querySelectorAll('img')){const src=img.getAttribute('src');if(src&&/^(https?:\/\/|data:image\/)/i.test(src))urls.push(src);}}
 if(!urls.length){const text=data.getData('text/uri-list')||data.getData('text/plain');for(const line of text.split(/[\r\n]+/)){const url=line.trim();if(/^(https?:\/\/|data:image\/)/i.test(url))urls.push(url);}}
 return [...new Set(urls)].slice(0,30);
}
