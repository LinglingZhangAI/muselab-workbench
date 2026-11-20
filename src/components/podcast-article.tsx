import {BookOpen,LoaderCircle,NotebookPen} from 'lucide-react';
import {useNotes} from '@/lib/notes';
import {usePodcastArticles} from '@/lib/podcast-articles';
export function PodcastArticleButton({episodeId}:{episodeId:string}){
 const articles=usePodcastArticles();const notes=useNotes();const job=articles.jobs.find(item=>item.episodeId===episodeId);
 const busy=articles.submitting===episodeId||!!job&&['reading','writing'].includes(job.status);
 const saved=job?.status==='completed'&&notes.notes.some(note=>note.id==='podcast-article-'+job.id)&&!notes.error;
 return <button className="podcast-article-button" disabled={!notes.readable||busy} aria-label={busy?'正在转成文章':saved?'查看本期文章笔记':'将本期播客转成文章并存入笔记'} aria-busy={busy} title={saved?'查看本期文章笔记':'基于本期完整字幕，用人话整理为新文章'} onClick={()=>saved&&job?articles.view(job):void articles.start(episodeId)}>{busy?<LoaderCircle size={14} className="is-spinning"/>:saved?<BookOpen size={14}/>:<NotebookPen size={14}/>}<span>{busy?'整理中':saved?'查看文章':'转成文章'}</span></button>;
}
export function PodcastArticleStatus({episodeId}:{episodeId:string}){
 const articles=usePodcastArticles();const notes=useNotes();const job=articles.jobs.find(item=>item.episodeId===episodeId);
 const error=articles.errorEpisode===episodeId?articles.error:'';
 const message=error||(!notes.readable?'笔记暂时无法读取，请先到笔记中重试读取':job?.status==='failed'?job.message:job?.status==='completed'?notes.error||'已保存到笔记，保留节目来源与回听入口':job&&['reading','writing'].includes(job.status)?'正在根据完整字幕整理文章，可继续收听':'' );
 return message?<p className="podcast-article-status" role={error||job?.status==='failed'?'alert':'status'}>{message}</p>:null;
}
