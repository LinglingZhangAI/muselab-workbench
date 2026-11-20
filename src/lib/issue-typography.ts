import {readingParagraphs} from './reading';

function formatParagraphs(document:Document,splitParagraphs:(text:string)=>string[]){
 const names=new Set<string>();
 for(const card of document.querySelectorAll<HTMLElement>('.card')){
  for(const name of (card.dataset.authorName||'').split(/\s*\/\s*/))if(name.trim())names.add(name.trim());
 }
 // Learn names from explicit source attributions, including people omitted from card headings.
 for(const paragraph of document.querySelectorAll('.intro p,.content-variant p,.section-desc')){
  const text=paragraph.textContent||'';
  for(const match of text.matchAll(/(?:^|[。.!?！？；;」』”'"\n]\s*)([A-Z][\w.-]*(?: [A-Z][\w.-]*){0,3})(?=\s*(?:的|['’]s\b|[：:]|(?:双发|三连推)?[（(]))/g)){
   // A single English word followed by a colon can be a label, such as "Prediction".
   if(match[1].includes(' ')||!/^\s*[:：]/.test(text.slice(match.index!+match[0].length)))names.add(match[1]);
  }
  const speaker=text.match(/^([\u3400-\u9fff]{2,6})[：:]/);if(speaker)names.add(speaker[1]);
 }
 const escapedNames=[...names].filter(Boolean).sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const speakerPattern=escapedNames.length?new RegExp('('+escapedNames.join('|')+')(?=\\s*(?:的|[\u0027’]s\\b|[：:]|(?:双发|三连推)?[（(]|域名经济))','g'):null;
 function speakers(text:string){
  if(!speakerPattern)return [{text,name:''}];
  const starts:{index:number;name:string}[]=[];
  for(const match of text.matchAll(speakerPattern)){
   const prefix=text.slice(0,match.index);const before=prefix.trimEnd().slice(-1);
   // Only start at an attribution boundary, never at a name mentioned inside a sentence.
   if(prefix.trim()&&!/[。.!?！？；;」』”'"\n]/.test(before))continue;
   const opens=(prefix.match(/[「『“]/g)||[]).length;const closes=(prefix.match(/[」』”]/g)||[]).length;
   if(opens>closes)continue;
   starts.push({index:match.index!,name:match[1]});
  }
  if(!starts.length)return [{text,name:''}];
  const groups:{text:string;name:string}[]=[];
  if(starts[0].index)groups.push({text:text.slice(0,starts[0].index),name:''});
  starts.forEach((start,index)=>groups.push({text:text.slice(start.index,starts[index+1]?.index??text.length),name:start.name}));
  return groups;
 }
 function inline(parent:HTMLElement,text:string,englishLikes:Set<string>){
  const tokens=text.split(/(\*\*[^*]+\*\*|`[^`]+`|[（(][\d,]+(?:\s*\/\s*[\d,]+)*\s*赞[^）)]*[）)]|\([\d,]+(?:\/[\d,]+)*\))/g);
  for(const token of tokens){
   const bare=token.replace(/^\*\*|\*\*$/g,'');
   if((/^[（(]?[\d,]+(?:\s*\/\s*[\d,]+)*\s*赞/.test(bare))||(/^\([\d,]+(?:\/[\d,]+)*\)$/.test(bare)&&englishLikes.has(bare.slice(1,-1)))){
    const span=document.createElement('span');span.className='reading-likes';span.textContent=bare;parent.append(span);
   }else if(token.startsWith('**')&&token.endsWith('**')){
    const strong=document.createElement('strong');inline(strong,token.slice(2,-2),englishLikes);parent.append(strong);
   }else if(token.startsWith('`')&&token.endsWith('`')){const code=document.createElement('code');code.textContent=token.slice(1,-1);parent.append(code);}
   else parent.append(document.createTextNode(token));
  }
 }
 for(const paragraph of document.querySelectorAll('.intro p,.content-variant p,.section-desc')){
  if(paragraph.childElementCount)continue;
  const text=paragraph.textContent||'';
  if(!text.trim())continue;
  const englishLikes=new Set<string>();
  const context=paragraph.closest('.card,.intro,.section-header');
  for(const match of (context?.textContent||'').matchAll(/([\d,]+(?:\/[\d,]+)*)\s*赞/g))englishLikes.add(match[1]);
  const fragment=document.createDocumentFragment();
  for(const group of speakers(text)){
   const wrapper=document.createElement('div');wrapper.className=group.name?'reading-speaker':'reading-passage';
   if(paragraph.classList.contains('section-desc'))wrapper.classList.add('section-desc');
   const parts=splitParagraphs(group.text);
   for(const [index,part] of parts.entries()){
    const p=document.createElement('p');
    if(/^【[^】]+】$/.test(part))p.classList.add('reading-subheading');
    if(group.name&&index===0&&part.startsWith(group.name)){
     const strong=document.createElement('strong');strong.className='reading-person';strong.textContent=group.name;p.append(strong);
     let rest=part.slice(group.name.length);
     // Preserve the source wording; a visual colon helps scan narrative attributions too.
     if(!/^\s*[：:]/.test(rest))strong.classList.add('has-colon');
     inline(p,rest,englishLikes);
    }else inline(p,part,englishLikes);
    wrapper.append(p);
   }
   fragment.append(wrapper);
  }
  paragraph.replaceWith(fragment);
 }
}

// Keep the source document and controls; touch only its reading text and typography.
export function issueTypography(html:string,url:string){
 const document=new DOMParser().parseFromString(html,'text/html');
 document.querySelectorAll('base').forEach(base=>base.remove());
 const base=document.createElement('base');base.href=url;document.head.prepend(base);
 const style=document.createElement('style');style.dataset.muselabTypography='true';
 style.textContent=`
 .intro p,.content-variant p,.content-variant li,.section-desc{font-size:15px;line-height:2;overflow-wrap:anywhere;text-wrap:pretty;letter-spacing:.01em}
 .intro p,.content-variant p{margin:0 0 1em}
 .intro p:last-child,.content-variant p:last-child{margin-bottom:0}
 .content-variant .reading-subheading{font-weight:700;margin-top:1.65em;margin-bottom:.65em;color:var(--ink)}
 .intro strong,.content-variant strong,.section-desc strong{font-weight:700;color:var(--ink)}
 .intro code,.content-variant code,.section-desc code{font-size:.88em;padding:.1em .35em;background:#eee9e0;border-radius:3px}
 .content-variant :is(ul,ol){padding-left:1.4em;margin:0 0 1em}.content-variant li{margin-bottom:.65em}
 .content-shell{height:auto!important;transition:none}
 .content-variant{position:relative;inset:auto;display:none;transform:none;transition:none}
 .content-variant.is-active{display:block;transform:none;transition:none}
 .reading-speaker{margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid var(--border)}
 .reading-speaker:last-child{border-bottom:0;padding-bottom:0;margin-bottom:0}
 .reading-speaker .reading-person{font-weight:700;color:var(--ink);font-size:1.08em}
 .reading-person.has-colon::after{content:'：';font-weight:400}
 .reading-speaker p{color:var(--ink)}
 .reading-likes,.reading-likes strong,strong .reading-likes{font-size:11px!important;font-weight:400!important;color:#938c81!important;letter-spacing:0;line-height:1.6}
 .section-desc .reading-speaker,.section-desc.reading-speaker{border:0;padding:0;margin-bottom:8px}
 .reading-passage{margin-bottom:1em}.reading-passage:last-child{margin-bottom:0}
 `;
 document.head.append(style);
 // The source hydrates its editor's note at startup; format after that hydration.
 const script=document.createElement('script');
 script.textContent=`document.addEventListener('DOMContentLoaded',()=>{(${formatParagraphs.toString()})(document,${readingParagraphs.toString()});window.dispatchEvent(new Event('resize'));},{once:true});`;
 document.body.append(script);
 return '<!DOCTYPE html>\n'+document.documentElement.outerHTML;
}
