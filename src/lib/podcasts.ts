export type PodcastSource={id:string;name:string;need:string;feed:string;url:string;language?:'zh'|'en';feedTitle?:string};
export type PodcastEpisode={id:string;sourceId:string;show:string;title:string;url:string;publishedAt:string;duration:string;description:string;audio:string;reason:string;cover?:string;transcriptUrl?:string};
export type PodcastEdition={date:string;fetchedAt:string;episodes:PodcastEpisode[];sources:(PodcastSource&{status:'updated'|'cached'|'unavailable'|'unconfigured'})[];warnings:string[]};
export const podcastSources:PodcastSource[]=[
 {id:'silicon',name:'硅基立场',need:'追踪 AI 行业变化',feed:'https://feed.xyzfm.space/hnetc83hllku',url:'https://www.xiaoyuzhoufm.com/podcast/655b2870583732e09f301b22'},
 {id:'weekly',name:'AI每周谈',need:'追踪 AI 行业变化',feed:'https://feed.xyzfm.space/ud8vlytu9npy',url:'https://www.xiaoyuzhoufm.com/podcast/688a34636f5a275f1cba40fd'},
 {id:'product-leader',name:'AI Product Leader',need:'学 AI 产品方法论',feed:'https://rss.buzzsprout.com/2366325.rss',url:'https://podcasts.apple.com/podcast/id1747150847',language:'en'},
 {id:'crossing',name:'十字路口 Crossing',need:'判断什么方向值得做',feed:'https://feed.xyzfm.space/68fyjknth9hj',url:'https://www.xiaoyuzhoufm.com/podcast/60502e253c92d4f62c2a9577'},
 {id:'feng',name:'枫言枫语',need:'轻量听，跟上模型更新',feed:'https://justinyan.me/feed/podcast',url:'https://fyfy.fm'},
 {id:'z-prompt',name:'The Z Prompt',need:'看年轻人怎么玩 AI 产品',feed:'https://www.xiaoyuzhoufm.com/podcast/6959d9f419bb99a4567e7c82',url:'https://www.xiaoyuzhoufm.com/podcast/6959d9f419bb99a4567e7c82'},
 {id:'jun',name:'张小珺Jùn｜商业访谈录',need:'深度理解 AI 商业与创业者',feed:'https://feed.xyzfm.space/dk4yh3pkpjp3',url:'https://www.xiaoyuzhoufm.com/podcast/626b46ea9cbbf0451cf5a962',language:'zh'},
 {id:'silicon101',name:'硅谷101',need:'从全球视野看科技竞争',feed:'https://feeds.fireside.fm/sv101/rss',url:'https://www.xiaoyuzhoufm.com/podcast/5e5c52c9418a84a04625e6cc',language:'zh'},
 {id:'onboard',name:'OnBoard!',need:'从投资人视角判断 AI 创业',feed:'https://feed.xyzfm.space/xxg7ryklkkft',url:'https://www.xiaoyuzhoufm.com/podcast/61cbaac48bb4cd867fcabe22',language:'zh'},
 {id:'agi-insider',name:'AI局内人 | AGI Insider',need:'让 AI 能力转化为用户价值',feed:'https://feed.xyzfm.space/jbap8hlxmuev',url:'https://podcasts.apple.com/ch/podcast/id1693183193',language:'zh'},
 {id:'lenny',name:"Lenny's Podcast",feedTitle:"Lenny's Podcast: Product | Career | Growth",need:'学习产品、增长与 AI 实践',feed:'https://api.substack.com/feed/podcast/10845.rss',url:'https://www.lennysnewsletter.com/podcast',language:'en'},
 {id:'latent-space',name:'Latent Space',feedTitle:'Latent Space: The AI Engineer Podcast',need:'理解 AI 工程与产品取舍',feed:'https://podcast.latent.space/feed.xml',url:'https://www.latent.space',language:'en'},
 {id:'no-priors',name:'No Priors',feedTitle:'No Priors: Artificial Intelligence | Technology | Startups',need:'判断 AI 市场的下一个机会',feed:'https://feeds.megaphone.fm/nopriors',url:'https://www.no-priors.com/',language:'en'},
];
export function podcastDay(value:Date|string=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export const preferredPodcastSources=['jun','silicon','silicon101','crossing'];
export function recommendEpisodes(episodes:PodcastEpisode[],now=new Date(),limits:Record<string,number>={}){
 const today=podcastDay(now);
 const available=episodes.filter(item=>Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)<=now.getTime());
 const latest=[...new Set(available.map(item=>item.sourceId))].flatMap(id=>[...new Map(available.filter(item=>item.sourceId===id).map(item=>[item.id,item])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,Math.max(1,Math.min(30,limits[id]||1))));
 const preferredLatest=new Set(preferredPodcastSources.map(id=>latest.filter(item=>item.sourceId===id).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0]?.id).filter(Boolean));
 return latest.sort((a,b)=>Number(preferredLatest.has(b.id))-Number(preferredLatest.has(a.id))||Number(podcastDay(b.publishedAt)===today)-Number(podcastDay(a.publishedAt)===today)||b.publishedAt.localeCompare(a.publishedAt));
}
