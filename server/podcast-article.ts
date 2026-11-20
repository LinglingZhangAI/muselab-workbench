import {readPodcasts} from './podcasts.ts';
import {PodcastTranscriber} from './podcast-transcription.ts';
import {publicResource} from './rewrite-source.ts';
import {parsePodcastCues,subtitleClock} from '../src/lib/podcast-playback.ts';
import type {PodcastEpisode} from '../src/lib/podcasts';

export function podcastCoverImages(episode:PodcastEpisode){
 if(!episode.cover)return [];
 try{return [{url:new URL(episode.cover).protocol==='https:'?episode.cover:'',alt:episode.show+' · '+episode.title,caption:''}].filter(image=>image.url);}catch{return [];}
}

export async function podcastArticleSource(root:string,id:string){
 if(!/^[a-f0-9]{24}$/.test(id))throw new Error('节目编号无效');
 const episode=(await readPodcasts(root))?.episodes.find(item=>item.id===id);
 if(!episode)throw new Error('未找到这期节目，请刷新节目列表');
 const stored=await new PodcastTranscriber(root).read(episode);
 let cues=stored?.status==='complete'?stored.cues:[];
 if(!cues.length&&episode.transcriptUrl){
  try{const resource=await publicResource(episode.transcriptUrl,'transcript');cues=parsePodcastCues(resource.body.toString('utf8'));}catch{/* A local complete transcript can still be used. */}
 }
 if(!cues.length)throw new Error('本期完整字幕尚未生成，请先打开“字幕”，生成完成后再转成文章');
 const transcript=cues.map(cue=>'['+subtitleClock(cue.start)+'] '+cue.text).join('\n');
 if(transcript.length>200000)throw new Error('本期字幕过长，暂时无法一次整理，请先选择片段记入笔记');
 return {url:episode.url,title:episode.show+' · '+episode.title,images:podcastCoverImages(episode),episodeId:episode.id,show:episode.show,publishedAt:episode.publishedAt,description:episode.description,transcript,
  source:{title:episode.show+' · '+episode.title,url:episode.url,quote:'',kind:'podcast' as const,format:'article' as const,show:episode.show,episodeId:episode.id,position:0,playbackUrl:'/?podcast='+episode.id+'&t=0'}};
}
