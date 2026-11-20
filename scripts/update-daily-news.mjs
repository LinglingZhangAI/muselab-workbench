import {fileURLToPath} from 'node:url';
import {refreshNews,shanghaiDay} from '../server/news-source.ts';
import {refreshArticles} from '../server/design-articles.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [refresh,file] of [[refreshNews,'daily-news.json'],[refreshArticles,'design-articles.json']]){
 try{const result=await refresh(root);console.log(JSON.stringify({updated:true,date:result.date,today:shanghaiDay(),count:result.items.length,file:root+'data/'+file,stale:result.date!==shanghaiDay()}));}catch(error){console.error(file+': '+(error instanceof Error?error.message:'更新失败'));process.exitCode=1;}
}
