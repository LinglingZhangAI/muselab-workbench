export type MajorEvent={
 id:string;date:string;period?:string;name:string;org:string;track:'模型'|'产品'|'算力'|'资本'|'政策'|'产业';region:'国内'|'海外';category:string;
 title:string;summary:string;body:string;impact:string;status:string;url:string;sourceTitle:string;verification:string;paper?:string;
 image:{path:string;source:string;label:string;alt:string};
 detailImage?:{path:string;source:string;label:string;alt:string};interpretation?:string;
 newsSources?:{title:string;url:string}[];
 sourceType?:'official'|'reference';referenceUrl?:string;referenceNote?:string;
};
export type EventSourceStatus={id:string;name:string;ok:boolean;checkedAt:string;found:number;error?:string};
export type EventsArchive={title:string;checkedAt:string;events:MajorEvent[];lastAttemptAt?:string;lastSuccessAt?:string;sourceStatus?:EventSourceStatus[];running?:boolean;warning?:string;candidateCount?:number;intervalMinutes?:number;reference?:{title:string;date:string;url:string;rows:number;added:number;matched:number;rssVerifiedAdded:number;pendingVerification:number;pending:string[];conflicts:{name:string;referenceDate:string;retainedDate:string}[];yearSummaries:{year:string;title:string;detail:string}[];themes:string[]}};
