export const noteCategories=['AI 与技术','产品与商业','设计与创意','工具与效率','认知与成长','行业动态'] as const;
type ArticleNote={id:string;title:string;body:string;folder?:string;folderMode?:'auto'|'manual';source?:{kind?:string;format?:string}};
const topics=[
 {name:'认知与成长',words:['虚无','焦虑','快乐','不快乐','认知','幸福','成长','情绪','人生','心理','思考','意义感','职业发展']},
 {name:'工具与效率',words:['效率','提效','工具','工作流','教程','提示词','prompt','技巧','免费工具','自动化','claude code','codex','skill']},
 {name:'设计与创意',words:['设计','创意','字体','排版','视觉','海报','插画','figma','原型','交互','ui','ux','美学','创作','漫画']},
 {name:'产品与商业',words:['产品','商业','创业','融资','股票','营收','增长','付费','订阅','大生意','社交','用户','市场','商业化']},
 {name:'AI 与技术',words:['ai','人工智能','大模型','模型','llm','agent','算法','编程','开源','训练','推理','gpt','kimi','智谱','claude']},
 {name:'行业动态',words:['发布','上线','行业','新闻','动态','收购','监管','财报','大会','苹果','微信','meta']},
];
function clean(text:string){return text.replace(/!\[[^\]]*\]\([^)]+\)/g,' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,' ').toLowerCase();}
function matches(text:string,word:string){return /^[a-z ]+$/i.test(word)?new RegExp('(?:^|[^a-z])'+word+'(?:$|[^a-z])','i').test(text):text.includes(word);}
const broadNames=new Set(['ai','人工智能','llm','gpt','kimi','智谱','claude','苹果','微信','meta']);
export function classifyNote(title:string,body:string):string|undefined{
 const heading=clean(title),text=clean(body).slice(0,16000);
 // A product name is weaker evidence than the subject of the article.
 const ranked=topics.map(topic=>({name:topic.name,score:topic.words.reduce((score,word)=>score+(matches(heading,word)?word==='大生意'?10:broadNames.has(word)?2:5:0)+(matches(text,word)?1:0),0)})).sort((a,b)=>b.score-a.score);
 return ranked[0]?.score>=3?ranked[0].name:undefined;
}
export function organizeArticle<T extends ArticleNote>(note:T):T&ArticleNote{
 if(note.folder!==undefined||note.folderMode==='manual'||!(note.source?.kind==='article'||note.source?.format==='article'||note.id.startsWith('rewrite-')))return note;
 const folder=classifyNote(note.title,note.body);return folder?{...note,folder,folderMode:'auto'}:note;
}
