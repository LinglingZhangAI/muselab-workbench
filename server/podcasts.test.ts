import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePodcastFeed,parsePodcastPage} from './podcasts.ts';
import {podcastSources,podcastDay,recommendEpisodes} from '../src/lib/podcasts.ts';
const now=new Date('2026-10-22T03:00:00Z');
test('RSS preserves real publication date, strips HTML, rejects future entries',()=>{
 const source=podcastSources[1];const xml=`<rss><channel><title>AI每周谈</title><item><title>今天的节目</title><link>https://www.xiaoyuzhoufm.com/episode/test?utm_source=rss</link><pubDate>Wed, 21 Oct 2026 22:30:00 GMT</pubDate><description><![CDATA[<p>真实介绍</p><script>ignore</script>]]></description><enclosure url="https://media.example.com/episode.mp3" type="audio/mpeg"/></item><item><title>未来节目</title><link>https://example.com/future</link><pubDate>Fri, 23 Oct 2026 22:30:00 GMT</pubDate></item></channel></rss>`;
 const episodes=parsePodcastFeed(xml,source,now);assert.equal(episodes.length,1);assert.equal(episodes[0].description,'真实介绍');assert.equal(podcastDay(episodes[0].publishedAt),'2026-10-22');assert(!episodes[0].url.includes('utm_'));assert.throws(()=>parsePodcastFeed(xml,podcastSources[0],now));
});
test('public page only accepts the selected podcast and public audio',()=>{
 const source=podcastSources[5];const data={props:{pageProps:{podcast:{pid:'6959d9f419bb99a4567e7c82',title:'The Z prompt',episodes:[{pid:'6959d9f419bb99a4567e7c82',eid:'6ac7a938195d838e2aeede2a',status:'NORMAL',title:'Agent 话题',pubDate:'2026-10-09T12:00:00Z',duration:2382,description:'节目简介',isPrivateMedia:false,payType:'FREE',enclosure:{url:'https://media.xyzcdn.net/test.m4a'}},{pid:'another-podcast',eid:'6ac7a938195d838e2aeede2b',title:'别人的节目',status:'NORMAL',pubDate:'2026-10-21T12:00:00Z'}]}}}};
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify(data)+'</script>';const episodes=parsePodcastPage(html,source,now);assert.equal(episodes.length,1);assert.equal(episodes[0].duration,'40 分钟');assert.throws(()=>parsePodcastPage(html,podcastSources[0],now));
});
test('recommendations prioritize followed shows without relabeling old releases',()=>{
 const xml=(date:string,title:string)=>`<rss><channel><title>AI每周谈</title><item><title>${title}</title><link>https://example.com/${title}</link><pubDate>${date}</pubDate></item></channel></rss>`;
 const newer=parsePodcastFeed(xml('Wed, 21 Oct 2026 22:30:00 GMT','today'),podcastSources[1],now)[0];const older={...newer,id:'older',sourceId:'crossing',publishedAt:'2026-10-18T16:00:00.000Z'};
 const list=recommendEpisodes([older,newer],now);assert.equal(list[0].id,older.id);assert.equal(podcastDay(list[0].publishedAt),'2026-10-19');assert.equal(list.length,2);
});
test('English feed titles match their verified full title, not another similarly named show',()=>{
 const source=podcastSources.find(item=>item.id==='lenny')!;
 const xml=(title:string)=>`<rss><channel><title>${title}</title><item><title>Product interview</title><link>https://www.lennysnewsletter.com/p/interview</link><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate><enclosure url="https://media.example.com/interview.mp3" type="audio/mpeg"/></item></channel></rss>`;
 assert.equal(parsePodcastFeed(xml("Lenny's Podcast: Product | Career | Growth"),source,now)[0].show,"Lenny's Podcast");
 assert.throws(()=>parsePodcastFeed(xml("Lenny's Daily Podcast"),source,now));
});
test('a publisher without episode links uses its real audio URL and keeps episodes distinct',()=>{
 const source=podcastSources.find(item=>item.id==='no-priors')!;
 const episodes=parsePodcastFeed(`<rss><channel><title>No Priors: Artificial Intelligence | Technology | Startups</title>${['a','b'].map(id=>`<item><title>Interview ${id}</title><guid isPermaLink="false">${id}</guid><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate><enclosure url="https://traffic.megaphone.fm/${id}.mp3" type="audio/mpeg"/></item>`).join('')}</channel></rss>`,source,now);
 assert.equal(episodes.length,2);assert.notEqual(episodes[0].id,episodes[1].id);assert.equal(episodes[0].url,episodes[0].audio);
});
test('selected shows include five recent unique episodes and other shows keep one',()=>{
 const base={id:'a',sourceId:'jun',publishedAt:'2026-10-20T00:00:00Z'} as import('../src/lib/podcasts.ts').PodcastEpisode;
 const episodes=Array.from({length:7},(_,index)=>({...base,id:'jun-'+index,publishedAt:`2026-10-${String(20-index).padStart(2,'0')}T00:00:00Z`}));
 const other={...base,id:'weekly',sourceId:'weekly'};
 const result=recommendEpisodes([...episodes,episodes[0],other,{...other,id:'weekly-old',publishedAt:'2026-10-01T00:00:00Z'}],now,{jun:5});
 assert.equal(result.filter(item=>item.sourceId==='jun').length,5);assert.equal(result.filter(item=>item.sourceId==='weekly').length,1);assert.equal(new Set(result.map(item=>item.id)).size,6);assert.equal(recommendEpisodes(episodes,now).length,1);
});
test('only the latest episode of each followed show gets recommendation priority',()=>{
 const episode=(id:string,sourceId:string,date:string)=>({id,sourceId,publishedAt:date} as import('../src/lib/podcasts.ts').PodcastEpisode);
 const list=recommendEpisodes([episode('jun-old','jun','2026-10-01T00:00:00Z'),episode('other-new','weekly','2026-10-22T01:00:00Z'),episode('jun-new','jun','2026-10-20T00:00:00Z'),episode('cross-new','crossing','2026-10-21T00:00:00Z')],now,{jun:5,crossing:5});
 assert.deepEqual(list.map(item=>item.id),['cross-new','jun-new','other-new','jun-old']);
});
