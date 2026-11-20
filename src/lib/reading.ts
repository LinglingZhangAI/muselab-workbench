// Split at sentence boundaries without rewriting, shortening or adding facts.
export function readingParagraphs(value:string){
 const parts=value.trim().split(/\n\s*\n/).filter(Boolean);const result:string[]=[];
 for(const part of parts){
  if(part.length<=240){result.push(part);continue;}
  const sentences=Array.from(new Intl.Segmenter(/[\u3400-\u9fff]/.test(part)?'zh':'en',{granularity:'sentence'}).segment(part),item=>item.segment);
  let group='';for(const sentence of sentences){if(group&&group.length+sentence.length>240){result.push(group.trim());group='';}group+=sentence;}if(group)result.push(group.trim());
 }
 return result;
}
