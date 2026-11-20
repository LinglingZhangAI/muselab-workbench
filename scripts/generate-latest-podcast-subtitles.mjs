// Use the running workbench queue so browser requests and batch work share jobs.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {recommendEpisodes} from '../src/lib/podcasts.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const edition=JSON.parse(await readFile(root+'data/daily-podcasts.json','utf8'));
const endpoint='http://127.0.0.1:4187/api/podcast-transcript?id=';
const requested=[];
for(const episode of recommendEpisodes(edition.episodes).reverse()){
 if(!episode.audio)continue;
 try{
  let response=await fetch(endpoint+episode.id,{signal:AbortSignal.timeout(20000)});
  let state=await response.json();
  if(!response.ok)throw new Error(state.error||'字幕读取失败');
  if(state.status!=='complete'){
   response=await fetch(endpoint+episode.id,{method:'POST',signal:AbortSignal.timeout(20000)});state=await response.json();
   if(!response.ok)throw new Error(state.error||'字幕提交失败');
  }
  requested.push({id:episode.id,show:episode.show,status:state.status});
 }catch(error){requested.push({id:episode.id,show:episode.show,status:'error',error:error.message});}
}
console.log(JSON.stringify({requested}));
process.exitCode=requested.some(item=>item.status==='error')?1:0;
