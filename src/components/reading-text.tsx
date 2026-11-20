import {readingParagraphs} from '@/lib/reading';
function InlineText({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part)}</>;}
export function ReadingText({text}:{text:string}){
 const lines=text.trim().split(/\n+/);const blocks:{list:boolean;values:string[]}[]=[];
 for(const line of lines){const item=line.match(/^\s*[-*•]\s+(.+)$/);const previous=blocks[blocks.length-1];if(item){if(previous?.list)previous.values.push(item[1]);else blocks.push({list:true,values:[item[1]]});}else if(line.trim())blocks.push({list:false,values:readingParagraphs(line)});}
 return <>{blocks.map((block,index)=>block.list?<ul key={index}>{block.values.map((value,i)=><li key={i}><InlineText text={value}/></li>)}</ul>:<div className="reader-text-block" key={index}>{block.values.map((part,i)=>/^【[^】]+】$/.test(part)?<h4 key={i}>{part.slice(1,-1)}</h4>:<p key={i}><InlineText text={part}/></p>)}</div>)}</>;
}
