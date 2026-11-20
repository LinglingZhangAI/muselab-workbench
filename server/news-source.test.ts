import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseNews,newsNeedsRefresh} from './news-source.ts';

const now=new Date('2026-10-22T01:00:00Z');
function fixture(content:string,escapeApostrophes=false,time=0){
 const editions=[{id:22,status:'publish',time,dubao:[{title:"It's Nice That",content,tag:'设计动态',url:'https://www.uisdc.com/news',images:'https://image.uisdc.com/db-20261022-1.jpg'}]}];
 let literal=JSON.stringify(JSON.stringify(editions));
 if(escapeApostrophes)literal=literal.replace(/'/g,"\\'");
 return 'var uisdc_news = '+literal+';';
}
test('decodes JavaScript apostrophe escapes without corrupting JSON or backslashes',()=>{
 const content="It's Nice That 与 Affinity；保留 \\'、\\n 和双引号 \"原文\"。";
 for(const escaped of [false,true]){
  const edition=parseNews(fixture(content,escaped),now);
  assert.equal(edition.date,'2026-10-22');
  assert.equal(edition.items[0].title,"It's Nice That");
  assert.equal(edition.items[0].content,content);
 }
});
test('rejects other invalid escapes instead of evaluating or silently repairing source',()=>{
 assert.throws(()=>parseNews(fixture('invalid').replace('invalid','\\q'),now),SyntaxError);
 assert.throws(()=>parseNews('var uisdc_news = runUntrustedCode();',now));
});
test('keeps checking for today’s edition even after successfully fetching yesterday’s news today',()=>{
 const current=parseNews(fixture('今日内容'),now);current.items[0].images=[];
 assert.equal(newsNeedsRefresh(current,now),false);
 assert.equal(newsNeedsRefresh({...current,date:'2026-10-21'},now),true);
 assert.equal(newsNeedsRefresh({...current,fetchedAt:'invalid'},now),true);
 assert.equal(newsNeedsRefresh(null,now),true);
 assert.equal(newsNeedsRefresh(parseNews(fixture('尚未缓存配图'),now),now),true);
});
test('extracts ordered images from source slots, deduplicating and rejecting untrusted URLs',()=>{
 const first='https://image.uisdc.com/db-20261022-1.jpg';
 const second='https://image.uisdc.com/db-20261022-2.webp';
 const html=fixture('含配图的正文').replace(first,[first,'',first,second,'https://other.example/image.png','javascript:alert(1)','https://user@image.uisdc.com/a.png','https://image.uisdc.com/not-image.svg'].join('|'));
 assert.deepEqual(parseNews(html,now).items[0].images,[first,second]);
 const noImage=fixture('无配图',false,now.getTime()/1000).replace(first,'');
 assert.deepEqual(parseNews(noImage,now).items[0].images,[]);
});
