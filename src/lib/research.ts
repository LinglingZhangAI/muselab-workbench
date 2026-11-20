export type ResearchResult={
 title:string;question:string;audience:string;summary:string;limitations:string;
 comparisons:{product:string;task:string;approach:string;strength:string;tradeoff:string;evidenceIds:string[]}[];
 findings:{title:string;observation:string;interpretation:string;recommendation:string;uncertainty:string;evidenceIds:string[]}[];
 journey:{step:string;action:string;risk:string}[];
 opportunities:{priority:'P0'|'P1'|'P2';title:string;proposal:string;rationale:string;effort:string;validation:string;successCriteria:string;evidenceIds:string[]}[];
};
export type ResearchImage={id:string;name:string;url:string;width:number;height:number};
export type ResearchJob={id:string;clientRequestId:string;template:'competitor';title:string;requirements:string;links:string[];images:ResearchImage[];status:'generating'|'completed'|'failed';message:string;createdAt:string;completedAt?:string;result?:ResearchResult};
export function validateResearchResult(value:unknown,evidenceIds:string[]):ResearchResult{
 if(!value||typeof value!=='object')throw new Error('AI 未返回完整研究，请重试');
 const r=value as ResearchResult;
 const text=(s:unknown,max=1600)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
 const evidence=(ids:unknown)=>Array.isArray(ids)&&ids.length<=12&&ids.every(id=>typeof id==='string'&&evidenceIds.includes(id));
 const rows=(items:unknown,max:number,keys:string[])=>Array.isArray(items)&&items.length>0&&items.length<=max&&items.every(item=>item&&typeof item==='object'&&keys.every(key=>text(item[key],800)));
 if(!['title','question','audience','summary','limitations'].every(key=>text(r[key as keyof ResearchResult],key==='title'?120:1600))||
 !rows(r.comparisons,6,['product','task','approach','strength','tradeoff'])||!r.comparisons.every(item=>evidence(item.evidenceIds))||
 !rows(r.findings,6,['title','observation','interpretation','recommendation','uncertainty'])||!r.findings.every(item=>evidence(item.evidenceIds))||
 !rows(r.journey,6,['step','action','risk'])||!rows(r.opportunities,5,['priority','title','proposal','rationale','effort','validation','successCriteria'])||!r.opportunities.every(item=>['P0','P1','P2'].includes(item.priority)&&evidence(item.evidenceIds)))throw new Error('AI 研究结构或证据引用不完整，请重试');
 return r;
}
