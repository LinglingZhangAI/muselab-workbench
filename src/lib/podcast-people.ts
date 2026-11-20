export type PodcastPeople={hosts:string[];guests:string[]};

const roles='主持人|主播|本期嘉宾|嘉宾';
const credit=new RegExp('^(?:'+roles+')$');
const inline=new RegExp('^(?:'+roles+')[：:]\\s*(.+)$');
const rolePrefix=new RegExp('^('+roles+')\\s+([^：:]+)[：:]');

function names(value:string){
 return value.replace(/https?:\/\/\S+/gi,'').split(/[｜|：:]/)[0].split(/[、，,；;]|\s+[和与&]\s+/).map(part=>part.trim())
  .filter(name=>name.length>0&&name.length<=40&&!/[。！？!?@/\d《》]/.test(name)&&!/(?:播客|主播|主理人|创始人|产品经理|设计师|工程师|https?|www\.)/i.test(name));
}

/** Read explicit episode credits; titles and topic names are not person credits. */
export function podcastPeople(description:string):PodcastPeople{
 const people:PodcastPeople={hosts:[],guests:[]};let section:keyof PodcastPeople|null=null;
 for(const raw of description.split(/\r?\n/)){
  const line=raw.trim().replace(/^[\p{Emoji_Presentation}\p{Emoji_Modifier}\u200d\ufe0f\s]+/u,'');
  if(!line)continue;
  const heading=line.match(/^[【\[「](.+?)[】\]」][：:]?\s*(.*)$/);
  const label=heading?.[1]||line.replace(/[：:]$/,'');
  if(credit.test(label)){
   section=/嘉宾/.test(label)?'guests':'hosts';
   if(heading?.[2])people[section].push(...names(heading[2]));
   continue;
  }
  const match=line.match(inline);
  const prefix=line.match(rolePrefix);
  if(match||prefix){
   const role=line.match(new RegExp('^('+roles+')'))![1];
   people[/嘉宾/.test(role)?'guests':'hosts'].push(...names(match?.[1]||prefix![2]));
   section=null;continue;
  }
  if(section){
   if(heading||/^\d{1,2}:\d{2}|^(?:时间|相关|联系|关注|节目|收听)/.test(line)){section=null;continue;}
   // A biography must delimit the credited name from its description.
   if(/[｜|]/.test(line)||/^[\p{Script=Han}A-Za-z .·-]{1,40}$/u.test(line))people[section].push(...names(line));
   else section=null;
  }
 }
 // Some show notes introduce guests in a sentence rather than a credit block.
 // Accept only names explicitly paired with a role in that introduction.
 for(const sentence of description.matchAll(/嘉宾是\s*([^。\n]+)/g)){
  for(const person of sentence[1].split(/\s+和\s+|、/)){
   const match=person.match(/(?:创始人|联合创始人|Founding Engineer)\s+([\p{Script=Han}A-Za-z .·-]+)$/iu);
   if(match)people.guests.push(...names(match[1]));
  }
 }
 return {hosts:[...new Set(people.hosts)],guests:[...new Set(people.guests)]};
}
