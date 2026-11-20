import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PodcastTranslator} from '../server/podcast-translation.ts';
import {podcastSources,recommendEpisodes} from '../src/lib/podcasts.ts';
const root=fileURLToPath(new URL('../',import.meta.url));const edition=JSON.parse(await readFile(root+'data/daily-podcasts.json','utf8'));const engine=new PodcastTranslator(root);
const episodes=recommendEpisodes(edition.episodes).filter(episode=>podcastSources.some(source=>source.id===episode.sourceId&&source.language==='en'));
for(const episode of episodes){
 try{
  const transcript=JSON.parse(await readFile(root+'data/podcast-asr/'+episode.id+'.json','utf8'));if(transcript.status!=='complete'){console.log(JSON.stringify({show:episode.show,status:'awaiting-transcript'}));continue;}
  await engine.request(episode.id,transcript.cues);let previous=-1;
  while(true){const state=await engine.read(episode.id,transcript.cues);if(state?.texts.length!==previous){previous=state?.texts.length||0;console.log(JSON.stringify({show:episode.show,status:state?.status,translated:previous,total:transcript.cues.length}));}if(state?.status==='complete')break;if(state?.status==='error')throw new Error(state.error);await new Promise(resolve=>setTimeout(resolve,1000));}
 }catch(error){console.error(JSON.stringify({show:episode.show,error:error.message}));process.exitCode=1;}
}
