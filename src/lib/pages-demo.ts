import {podcastSources, type PodcastEpisode} from './podcasts';

const date = '2026-11-20';
const fetchedAt = date + 'T00:00:00+08:00';
const asset = (name: string) => import.meta.env.BASE_URL + 'assets/' + name + '.webp';

const episode: PodcastEpisode = {
  id: 'public-demo-podcast',
  sourceId: 'jun',
  show: '张小珺Jùn｜商业访谈录',
  title: '157. 复盘 Personal Agent 集体诞生背后',
  publishedAt: '2026-11-18T03:08:54.000Z',
  duration: '02:43:40',
  description: '张小珺和蔡伟聊 AI 产品史、需求真伪、入口与未来想象。',
  reason: '从日常任务出发，理解 Personal Agent 的产品选择。',
  url: 'https://www.xiaoyuzhoufm.com/episode/6afd12c6a4a79edf137afd61',
  audio: 'https://media.xyzcdn.net/626b46ea9cbbf0451cf5a962/ltU-y2wl0s2fvaEJBluGHouM2hO0.m4a',
  cover: 'https://image.xyzcdn.net/FvLuA_xazPI-w8wrJm-BAVbLja5k.png',
};

const demoNews = [
  {id:'demo-news', title:'用一份简报开始今天', content:'本例演示如何在工作台集中阅读资讯并保留来源。运行本地版后，可以从优设读取最新栏目内容。', tag:'演示', url:'https://www.uisdc.com/news', images:[asset('astronaut')]},
  {id:'demo-notes', title:'把值得回看的内容收进笔记', content:'选中文字即可保存摘录，之后可以在笔记里找到它。', tag:'演示', url:'https://www.uisdc.com/news', images:[asset('owl')]},
];
const demoArticles = [
  {id:'design-demo', title:'如何整理设计参考', description:'试着把参考图、来源和可复用的 Prompt 放在一起。', author:'Muselab', tag:'演示', url:'https://www.uisdc.com/', image:asset('butterfly')},
  {id:'design-demo-2', title:'从收藏到动手', description:'按项目归类，下一次做页面时更容易找到合适的参考。', author:'Muselab', tag:'演示', url:'https://www.uisdc.com/', image:asset('fox')},
];

export function installPagesDemo() {
  const original = window.fetch.bind(window);
  const routes: Record<string, unknown> = {
    '/api/daily-brief': {date, updatedAt:fetchedAt, work:[], updates:[], timeline:[], newsCount:demoNews.length, coverage:'公开演示使用示例数据。'},
    '/api/daily-news': {date, fetchedAt, items:demoNews, source:'https://www.uisdc.com/news', stale:false, warning:''},
    '/api/design-articles': {date, fetchedAt, items:demoArticles, stale:false, warning:''},
    '/api/builders-directory': {fetchedAt, entries:[{date:'2026-11-18', title:'重播日：软件工厂与 Stanford 课', description:'AI Builders’ Insight 往期示例。', issue:'Issue 176', url:'https://luolan0214.github.io/follow-builders-newsletter/issues/ai-builders-digest-2026-11-18-rerun.html'}]},
    '/api/daily-podcasts': {date, fetchedAt, episodes:[episode], sources:podcastSources, warnings:[]},
    '/api/podcast-transcript': {cues:[], available:false, status:'error', error:'公开演示提供节目和播放入口。字幕可在本地版生成。'},
    '/api/pinterest/library': {assets:[], job:{running:false, processed:0, total:0, added:0, skipped:0, errors:[]}},
    '/api/ui-prompt/status': {configured:false},
    '/api/hangzhou-weather': {},
  };
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return original(input, options);
    if (options?.signal?.aborted) return Promise.reject(new DOMException('Aborted','AbortError'));
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const article = method === 'GET' && url.pathname === '/api/design-article-content'
      ? demoArticles.find(item => item.id === url.searchParams.get('id'))
      : undefined;
    const value = article
      ? {url:article.url, title:article.title, html:'<p>' + article.description + '</p>'}
      : method === 'GET' ? routes[url.pathname] : undefined;
    const response = value === undefined
      ? Response.json({error:'此功能可在本地版使用。'}, {status:404})
      : Response.json(value);
    return Promise.resolve(response);
  };
}
