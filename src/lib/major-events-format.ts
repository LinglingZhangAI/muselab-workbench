import type {MajorEvent} from './major-events-types';

export function eventDateLabel(event:Pick<MajorEvent,'date'|'period'>){
 if(event.period&&(/[—－–]/.test(event.period)||event.date.length===4))return event.date.slice(0,4)+' 年 '+event.period;
 return event.date.replaceAll('-','.');
}
export function eventTrackLabel(event:Pick<MajorEvent,'track'|'category'|'sourceType'>){
 return `${event.track} / ${event.category}${event.sourceType==='reference'?' · 待核验':''}`;
}
export function validEventDate(value:string){
 if(!/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 if(month!==undefined&&(month<1||month>12))return false;
 if(day!==undefined){const parsed=new Date(Date.UTC(year,month-1,day));return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;}
 return true;
}
