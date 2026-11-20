import type {MajorEvent} from './major-events-types';

type TimelineEvent=Pick<MajorEvent,'id'|'date'|'track'>;
export function eventDateGroups<T extends TimelineEvent>(events:T[],origin=65,gap=292,cardWidth=264){
 const buckets=new Map<string,T[]>();
 for(const event of events){const group=buckets.get(event.date)||[];group.push(event);buckets.set(event.date,group);}
 const exactDays=events.filter(e=>e.date.length===10).map(e=>Date.parse(e.date+'T00:00:00Z'));
 let cursor=origin;
 const groups=[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([date,members])=>{
  const lanes=[0,0],positions:Record<string,number>={};
  for(const event of members){const lane=event.track==='模型'?0:1;positions[event.id]=cursor+lanes[lane]++*gap;}
  const columns=Math.max(...lanes),count=members.length;
  const day=date.length===10?Date.parse(date+'T00:00:00Z'):null;
  const nearbyCount=day===null?null:exactDays.filter(time=>Math.abs(time-day)<=3*86400000).length;
  // Use exact-day events within the centered seven-day window; never assign partial dates to a day.
  const radius=nearbyCount===null?6*Math.sqrt(count):Math.min(29,4+7*Math.sqrt(nearbyCount));
  const group={date,members,positions,count,start:cursor,span:columns*gap,center:cursor+(columns-1)*gap/2+cardWidth/2,radius,nearbyCount};
  cursor+=columns*gap+36;
  return group;
 });
 return {groups,positions:Object.assign({},...groups.map(group=>group.positions)) as Record<string,number>,width:Math.max(1000,cursor+80)};
}

// The intermediate circles interpolate activity around each dated group.
// They are visual samples, not additional events.
export function eventDensityBeads(groups:{center:number;radius:number;date:string}[],width:number){
 if(!groups.length)return [];
 const peaks=groups.map(group=>({x:group.center,radius:group.radius,partial:group.date.length<10}));
 const beads=[...peaks];
 for(let i=0;i<=peaks.length;i++){
  const left=peaks[i-1],right=peaks[i];
  const start=left?left.x+left.radius+5:0,end=right?right.x-right.radius-5:width;
  let edge=start;
  while(edge+3<=end){
   const middle=edge+1.5;
   const a=left?Math.max(0,1-(middle-start)/75):0;
   const b=right?Math.max(0,1-(end-middle)/75):0;
   // Limit shoulder circles to keep the dated peak distinct and every circle separate.
   const radius=1.5+Math.max(a*(left?Math.min(8,left.radius*.32):0),b*(right?Math.min(8,right.radius*.32):0));
   if(edge+radius*2>end)break;
   beads.push({x:edge+radius,radius:Number(radius.toFixed(2)),partial:false});
   edge+=radius*2+5;
  }
 }
 return beads.sort((a,b)=>a.x-b.x);
}
