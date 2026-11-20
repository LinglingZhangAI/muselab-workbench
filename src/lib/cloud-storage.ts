// Hydrate before React reads browser storage. Local development keeps its existing storage behavior.
let cloud=false;
export const cloudStorageEnabled=()=>cloud;
export async function initializeCloudStorage(){
 let response:Response;try{response=await fetch('/api/user-state');}catch{return;}
 if(response.status===401){location.assign('/login');throw new Error('请登录工作台');}
 if(response.status===404||response.headers.get('content-type')?.includes('text/html'))return;
 if(!response.ok)throw new Error('云端资料暂时无法读取，请刷新重试。');
 const {state}=await response.json();cloud=true;
 const revisions=new Map<string,string>();
 for(const [key,entry] of Object.entries(state as Record<string,{value:string;revision:string}>)){
  if(localStorage.getItem(key)!==entry.value&&localStorage.getItem(key)!==null)localStorage.setItem('muselab-cloud-backup:'+key,localStorage.getItem(key)!);
  localStorage.setItem(key,entry.value);revisions.set(key,entry.revision);
 }
 const original=Storage.prototype.setItem;const pending=new Map<string,string>();let timer:number|undefined;let running=false;
 const allowed=(key:string)=>['muselab-notes:v1','muselab-folders:v1','muselab-note-folders:v1','eagle-prompt-library:v1'].includes(key)||/^muselab-timeline:v2:\d{4}-\d{2}-\d{2}$/.test(key);
 const message=(text:string)=>{window.dispatchEvent(new CustomEvent('muselab:cloud-save-status',{detail:text}));};
 async function flush(){
  if(running)return;running=true;
  let failed=false;try{for(const [key,value] of pending){
   const result=await fetch('/api/user-state?key='+encodeURIComponent(key),{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revisions.get(key)||''},body:value});
   const data=await result.json();if(!result.ok)throw new Error(data.error||'云端保存失败，内容保留在本机');revisions.set(key,data.revision);if(pending.get(key)===value)pending.delete(key);
  }if(!pending.size)message('');}catch(e){failed=true;message(e instanceof Error?e.message:'云端保存失败，内容保留在本机');}finally{running=false;if(!failed&&pending.size)timer=window.setTimeout(()=>void flush(),600);}
 }
 Storage.prototype.setItem=function(key:string,value:string){original.call(this,key,value);if(this===localStorage&&allowed(key)){pending.set(key,String(value));message('正在同步云端…');window.clearTimeout(timer);timer=window.setTimeout(()=>void flush(),600);}};
 window.addEventListener('online',()=>void flush());
 window.addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
 window.addEventListener('muselab:cloud-save-retry',()=>void flush());
}
