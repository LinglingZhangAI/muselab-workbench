// Shared by the form and server; the server separately validates public addresses.
export function articleLink(value:string){
 let input=value.trim().replace(/[。，；、】》]+$/u,'');
 if(!/^https?:\/\//i.test(input)){
  if(/^[a-z][a-z0-9+.-]*:/i.test(input)||!/^[^\s/]+\.[^\s/]+(?:\/|$)/u.test(input))throw new Error('请填写公开网页链接');
  input='https://'+input;
 }
 const url=new URL(input);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('请填写公开的 HTTP 或 HTTPS 链接');
 return url.href;
}
