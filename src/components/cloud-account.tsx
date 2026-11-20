import {useEffect,useState} from 'react';
import {cloudStorageEnabled} from '@/lib/cloud-storage';
export function CloudAccount(){
 const [message,setMessage]=useState('');
 useEffect(()=>{const update=(event:Event)=>setMessage((event as CustomEvent<string>).detail);window.addEventListener('muselab:cloud-save-status',update);return()=>window.removeEventListener('muselab:cloud-save-status',update);},[]);
 if(!cloudStorageEnabled())return null;
 return <div className="cloud-account">{message&&<span role="status">{message}{message!=='正在同步云端…'&&<button onClick={()=>window.dispatchEvent(new Event('muselab:cloud-save-retry'))}>重试</button>}</span>}<form action="/logout" method="post"><button>退出登录</button></form></div>;
}
