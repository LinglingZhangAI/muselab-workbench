import {fileURLToPath} from 'node:url';
import {refreshPodcasts,readPodcasts} from '../server/podcasts.ts';
import {podcastDay,recommendEpisodes} from '../src/lib/podcasts.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
try{
 const edition=await refreshPodcasts(root);
 const saved=await readPodcasts(root);
 if(!saved||saved.fetchedAt!==edition.fetchedAt||saved.date!==podcastDay())throw new Error('播客数据保存校验失败');
 console.log(JSON.stringify({date:saved.date,fetchedAt:saved.fetchedAt,recommendations:recommendEpisodes(saved.episodes).length,sources:saved.sources.map(({name,status})=>({name,status})),warnings:saved.warnings}));
 if(saved.warnings.length)process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:'播客更新失败');process.exitCode=1;}
