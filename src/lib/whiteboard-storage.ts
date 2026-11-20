import {cloudStorageEnabled} from './cloud-storage';
const database='muselab-whiteboard:v1';
let revision='';
function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(database,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('boards');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('无法读取白板存储'));
 });
}
async function readLocalWhiteboard():Promise<unknown>{
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction('boards','readonly');const request=transaction.objectStore('boards').get('main');
  transaction.oncomplete=()=>resolve(request.result??null);transaction.onabort=()=>reject(transaction.error);transaction.onerror=()=>reject(transaction.error);
 });}finally{db.close();}
}
async function writeLocalWhiteboard(scene:unknown,key='main'){
 const db=await openDatabase();
 try{await new Promise<void>((resolve,reject)=>{
  const transaction=db.transaction('boards','readwrite');transaction.objectStore('boards').put(scene,key);
  transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error);transaction.onerror=()=>reject(transaction.error);
 });}finally{db.close();}
}
export async function readWhiteboard():Promise<unknown>{
 const local=await readLocalWhiteboard();if(!cloudStorageEnabled())return local;
 const response=await fetch('/api/user-state?key='+encodeURIComponent(database),{cache:'no-store'});if(!response.ok)throw new Error('云端白板读取失败，已保留本机副本');
 const {state}=await response.json();const entry=state[database];revision=entry?.revision||'';if(!entry)return local;
 const scene=JSON.parse(entry.value);if(local&&JSON.stringify(local)!==entry.value)await writeLocalWhiteboard(local,'before-cloud-sync');
 await writeLocalWhiteboard(scene);return scene;
}
export async function writeWhiteboard(scene:unknown){
 await writeLocalWhiteboard(scene);if(!cloudStorageEnabled())return;
 const response=await fetch('/api/user-state?key='+encodeURIComponent(database),{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revision},body:JSON.stringify(scene)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'云端白板保存失败，已保留本机副本');revision=result.revision;
}
