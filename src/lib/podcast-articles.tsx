import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useNotes} from './notes';
import type {ArticleJob} from './article-job';

type Articles={jobs:ArticleJob[];error:string;errorEpisode:string;submitting:string;start:(episodeId:string)=>Promise<void>;view:(job:ArticleJob)=>void};
const Context=createContext<Articles|null>(null);
export function PodcastArticlesProvider({children}:{children:ReactNode}){
 const store=useNotes();const notes=useRef(store);notes.current=store;
 const [jobs,setJobs]=useState<ArticleJob[]>([]);const [error,setError]=useState('');const [errorEpisode,setErrorEpisode]=useState('');const [submitting,setSubmitting]=useState('');const sending=useRef(false);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let cancelled=false;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
  async function poll(){
   controller=new AbortController();
   try{
    const response=await fetch('/api/note-rewrite?podcasts=1',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const data=await response.json();
    if(!response.ok||!Array.isArray(data))throw new Error(data.error||'暂时无法读取文章进度');
    if(cancelled)return;setJobs(data);
    timer=setTimeout(()=>void poll(),data.some((job:ArticleJob)=>['reading','writing'].includes(job.status))?1800:15000);
   }catch{if(!cancelled)timer=setTimeout(()=>void poll(),5000);}
  }
  void poll();return()=>{cancelled=true;controller?.abort();clearTimeout(timer);};
 },[version]);
 useEffect(()=>{
  if(!store.readable)return;
  for(const job of jobs){
   if(job.status!=='completed'||!job.title||!job.body||!job.source)continue;
   const key='muselab-podcast-article-imported:'+job.id;
   try{if(localStorage.getItem(key))continue;}catch{/* A stable note id still prevents duplicate imports. */}
   const saved=notes.current.importArticle({id:'podcast-article-'+job.id,title:job.title,body:job.body,images:job.images,source:{...job.source,format:'article'},createdAt:job.completedAt||job.createdAt,updatedAt:job.completedAt||job.createdAt});
   if(saved)try{localStorage.setItem(key,'1');}catch{/* Retry the same note id after reconnecting. */}
  }
 },[jobs,store.readable]);
 async function start(episodeId:string){
  if(sending.current)return;sending.current=true;setSubmitting(episodeId);setError('');setErrorEpisode(episodeId);
  try{
   const response=await fetch('/api/note-rewrite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({episodeId}),signal:AbortSignal.timeout(30000)});const job=await response.json();
   if(!response.ok)throw new Error(job.error||'暂时无法生成文章');
   setJobs(current=>[job,...current.filter(item=>item.episodeId!==episodeId)]);setVersion(value=>value+1);
  }catch(e){setError(e instanceof Error?e.message:'暂时无法生成文章，请重试');setVersion(value=>value+1);}
  finally{sending.current=false;setSubmitting('');}
 }
 function view(job:ArticleJob){notes.current.select('podcast-article-'+job.id);notes.current.setOpen(true);}
 return <Context.Provider value={{jobs,error,errorEpisode,submitting,start,view}}>{children}</Context.Provider>;
}
export function usePodcastArticles(){const value=useContext(Context);if(!value)throw new Error('PodcastArticlesProvider is required');return value;}
