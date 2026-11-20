export type WorkRecord={id:string;title:string;detail:string;start:string;end:string;threadId:string;threadTitle:string;status:string};
export type WorkTask=WorkRecord&{latestStart:string;records:WorkRecord[]};
// Group by the delivered capability, while keeping the original evidence in details.
const topics:[string,string,RegExp][]=[
 ['notes','完善阅读摘录与笔记管理',/笔记|文字摘录|选中文字|记入笔记/],
 ['library','补充与维护灵感素材库',/Pinterest|收藏页|采集.*素材|素材.*采集|灵感库.*同步/i],
 ['reader','完善设计资讯的全文阅读体验',/全文|文章.*(?:正文|配图|阅读)|阅读.*弹窗/],
 ['work-records','完善每日工作回顾与进展同步',/工作记录|Codex.*记录|刷新.*简报|今日.*简报|最新时间/],
 ['member','完善会员运营与客群分析',/会员|会消比|拉新|客群|积分|留存/],
 ['data','核对经营数据并补齐分析维度',/数据对比|补齐.*数据|数据.*补充|两版.*(?:对比|差异)|验证目标/],
 ['operations','完善经营机会与行动任务管理',/任务清单|活动策略|经营机会|商机|负责人|截止日期/],
 ['ai','优化经营分析的 AI 辅助体验',/AI\s*(?:分析|对话)|对话.*分析/],
 ['analytics','优化经营指标与交易分析体验',/指标|交易|同比|环比|趋势|同城|排名|榜单|经营建议|店铺|排行榜|默认.*时间|日期快捷/],
 ['navigation','优化工作台导航与浏览体验',/导航|侧栏|搜索框|数量标签|展开.*收起/],
];
export function summarizeWorkRecords(records:WorkRecord[]):WorkTask[]{
 const groups=new Map<string,WorkTask>();
 for(const record of [...records].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))){
  if(record.status!=='已完成')continue;
  const topic=topics.find(([, ,match])=>match.test(record.title))||topics.find(([, ,match])=>match.test(record.detail));
  const title=topic?.[1]||record.title.replace(/^已(?:经)?(?:完成|调整|更新|实现)[：:，、\s-]*/,'').split(/[。；]/)[0].slice(0,48)||record.threadTitle;
  // Different chats remain separate even if their topics happen to match.
  const key=record.threadId+':'+(topic?.[0]||title);
  const existing=groups.get(key);
  if(existing){existing.records.push(record);if(Date.parse(record.end)>Date.parse(existing.end))existing.end=record.end;existing.latestStart=record.start;}
  else groups.set(key,{...record,id:'task-'+key,title,latestStart:record.start,records:[record]});
 }
 return [...groups.values()].map(task=>({...task,detail:task.records.map(r=>r.detail).join('\n\n')})).sort((a,b)=>Date.parse(b.latestStart)-Date.parse(a.latestStart));
}
export function workItemsFromRecords(records:WorkRecord[]){return summarizeWorkRecords(records).map(({title,threadId,threadTitle,status,records})=>({title,threadId,threadTitle,status,detail:`已归并 ${records.length} 条完成记录。`+records.slice(-2).map(r=>r.detail).join('；').slice(0,440)}));}
