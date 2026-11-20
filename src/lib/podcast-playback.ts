import type {PodcastEpisode} from './podcasts';
export type PodcastCue={start:number;end:number;text:string;textZh?:string};
export function subtitleClock(seconds:number){const value=Math.max(0,Math.floor(seconds));return (value>=3600?Math.floor(value/3600)+':':'')+String(Math.floor(value/60)%60).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
function stamp(value:string){const parts=value.replace(',','.').split(':');if(parts.length<2||parts.length>3||parts.some(part=>!/^\d+(?:\.\d+)?$/.test(part)))return NaN;return parts.reduce((sum,part)=>sum*60+Number(part),0);}
export function parsePodcastCues(input:string):PodcastCue[]{
 if(input.length>2*1024*1024)throw new Error('字幕文件过大，请使用 2 MB 以内的文件');
 const cues:PodcastCue[]=[];
 for(const block of input.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/)){
  const lines=block.split('\n');const index=lines.findIndex(line=>line.includes('-->'));if(index<0)continue;
  const [a,b]=lines[index].split('-->').map(value=>value.trim().split(/\s+/)[0]);
  const start=stamp(a),end=stamp(b);const text=lines.slice(index+1).join('\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
  if(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&text)cues.push({start,end,text:text.slice(0,3000)});
 }
 if(!cues.length||cues.length>20000)throw new Error('未找到有效时间轴，请使用 SRT 或 VTT 字幕');
 return cues.sort((a,b)=>a.start-b.start||a.end-b.end);
}
export function activePodcastCue(cues:PodcastCue[],time:number){let low=0,high=cues.length-1,found=-1;while(low<=high){const mid=(low+high)>>1;if(cues[mid].start<=time){found=mid;low=mid+1;}else high=mid-1;}return found>=0&&time<cues[found].end?found:-1;}
const progressKey=(id:string)=>'muselab-podcast-progress:v1:'+id;
export function savedPodcastTime(id:string,fallback=0){try{const value=JSON.parse(localStorage.getItem(progressKey(id))||'null');return value&&Number.isFinite(value.time)&&value.time>=0?value.time:fallback;}catch{return fallback;}}
export function savePodcastTime(id:string,time:number,duration:number){if(!Number.isFinite(time)||time<0)return;try{localStorage.setItem(progressKey(id),JSON.stringify({time:duration>0&&time>=duration-1?0:time,updatedAt:new Date().toISOString()}));}catch{/* Playback continues when browser storage is full. */}}
const sessionKey='muselab-podcast-session:v1';
export function loadPodcastSession():{episode:PodcastEpisode;time:number;duration:number}|null{
 try{const value=JSON.parse(localStorage.getItem(sessionKey)||'null');const episode=value?.episode;
  if(!episode||!/^[a-f0-9]{24}$/.test(episode.id)||!['sourceId','show','title','publishedAt','description','duration','reason','audio','url'].every(key=>typeof episode[key]==='string')||!Number.isFinite(Date.parse(episode.publishedAt))||!Number.isFinite(value.time)||value.time<0||!Number.isFinite(value.duration)||value.duration<0)return null;
  for(const target of [episode.audio,episode.url].filter(Boolean)){const url=new URL(target);if(url.protocol!=='https:'||url.username||url.password)return null;}
  return value;
 }catch{return null;}
}
export function savePodcastSession(episode:PodcastEpisode,time:number,duration:number){
 if(!Number.isFinite(time)||time<0)return;
 try{localStorage.setItem(sessionKey,JSON.stringify({episode,time:duration>0&&time>=duration-1?0:time,duration:Number.isFinite(duration)?Math.max(0,duration):0}));}catch{/* Listening remains available without storage. */}
}
export function latestPodcastProgress(episodes:PodcastEpisode[]){
 let latest='',timestamp=-Infinity;
 for(const episode of episodes)try{const value=JSON.parse(localStorage.getItem(progressKey(episode.id))||'null');const updated=Date.parse(value?.updatedAt);if(Number.isFinite(value?.time)&&value.time>=0&&Number.isFinite(updated)&&updated>timestamp){latest=episode.id;timestamp=updated;}}catch{/* Ignore invalid history. */}
 return latest;
}
export function loadPodcastCues(id:string):PodcastCue[]{try{const input=localStorage.getItem('muselab-podcast-subtitles:v1:'+id);return input?parsePodcastCues(input):[];}catch{return [];}}
export function savePodcastCues(id:string,input:string){const cues=parsePodcastCues(input);localStorage.setItem('muselab-podcast-subtitles:v1:'+id,input);return cues;}
