import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type RequestListener} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {noteRewriteApi} from './note-rewrite-api.ts';

test('public links reach article generation and save a recoverable note with the final source URL',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-public-link-'));let prompt='',received='',reads=0;
 const plugin=noteRewriteApi(root,{
  binary:async()=>'/test/codex',writingSkill:async()=>'写作规则',
  fetchSource:async url=>{reads++;received=url;return {url:'https://news.example.org/final',title:'公开报道',text:'这是来自公开网页的实际报道材料。'.repeat(30),images:[]};},
  generate:async(_root,value)=>{prompt=value;return {title:'网页文章',body:'根据来源报道整理的文章内容。'.repeat(20)};}
 });
 let middleware:RequestListener=(_req,res)=>res.end();(plugin.configureServer as Function)({middlewares:{use:(handler:RequestListener)=>{middleware=handler;}}});
 const server=createServer((req,res)=>middleware(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const post=(url:string,sourceText?:unknown)=>fetch(origin+'/api/note-rewrite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({url,requirements:'面向产品经理',...(sourceText!==undefined?{sourceText}:{})})});
 try{
  for(const url of ['http://127.0.0.1/private','file:///etc/passwd','https://user:pass@example.org/'])assert.equal((await post(url)).status,400);
  const first=await post('http://news.example.org/story?utm_source=share&id=4');assert.equal(first.status,202);const job=await first.json();
  let result;const deadline=Date.now()+5000;
  do{await new Promise(resolve=>setTimeout(resolve,20));result=await (await fetch(origin+'/api/note-rewrite?id='+job.id)).json();}while(['reading','writing'].includes(result.status)&&Date.now()<deadline);
  assert.equal(result.status,'completed');assert.equal(received,'http://news.example.org/story?id=4');assert.equal(result.url,'https://news.example.org/final');
  assert.match(prompt,/来自公开网页的实际报道材料/);assert.match(prompt,/面向产品经理/);
  const saved=JSON.parse(await readFile(path.join(root,'data/note-rewrites',job.id+'.json'),'utf8'));assert.equal(saved.status,'completed');
  const document=await (await fetch(origin+'/api/note-rewrite?id='+job.id+'&download=1')).text();assert.match(document,/网页文章/);assert.match(document,/https:\/\/news.example.org\/final/);
  const bare=await post('news.example.org/other');assert.equal(bare.status,202);const next=await bare.json();
  const until=Date.now()+5000;let last;
  do{await new Promise(resolve=>setTimeout(resolve,20));last=await (await fetch(origin+'/api/note-rewrite?id='+next.id)).json();}while(['reading','writing'].includes(last.status)&&Date.now()<until);
  assert.equal(last.status,'completed');assert.equal(received,'https://news.example.org/other');
  const wechat='https://mp.weixin.qq.com/s/vOd0HrmfgOCPbj4CfsddsQ';
  for(const text of ['短正文',42,'字'.repeat(50001)])assert.equal((await post(wechat,text)).status,400);
  const pasted=await post(wechat,'# 公众号原文标题\n\n'+'这是用户从原文复制的公开内容，不能编造报道事实。'.repeat(20));assert.equal(pasted.status,202);const pastedJob=await pasted.json();
  const pasteDeadline=Date.now()+5000;let pastedResult;
  do{await new Promise(resolve=>setTimeout(resolve,20));pastedResult=await (await fetch(origin+'/api/note-rewrite?id='+pastedJob.id)).json();}while(['reading','writing'].includes(pastedResult.status)&&Date.now()<pasteDeadline);
  assert.equal(pastedResult.status,'completed');assert.equal(reads,2);assert.equal(pastedResult.url,wechat);assert.equal(pastedResult.sourceTitle,'公众号原文标题');assert.match(prompt,/这是用户从原文复制的公开内容/);

 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});

test('unreadable public pages fail without calling the writer or creating an article',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-unreadable-link-'));let writes=0;
 const plugin=noteRewriteApi(root,{binary:async()=>'/test/codex',writingSkill:async()=>'规则',fetchSource:async()=>{throw new Error('原站限制访问，无法读取正文，请换一个公开链接');},generate:async()=>{writes++;return {title:'不应生成',body:'不可使用'};}});
 let middleware:RequestListener=(_req,res)=>res.end();(plugin.configureServer as Function)({middlewares:{use:(handler:RequestListener)=>{middleware=handler;}}});
 const server=createServer((req,res)=>middleware(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try{
  const response=await fetch(origin+'/api/note-rewrite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({url:'https://news.example.org/locked',requirements:''})});
  assert.equal(response.status,202);const job=await response.json();let result;const deadline=Date.now()+5000;
  do{await new Promise(resolve=>setTimeout(resolve,20));result=await (await fetch(origin+'/api/note-rewrite?id='+job.id)).json();}while(['reading','writing'].includes(result.status)&&Date.now()<deadline);
  assert.equal(result.status,'failed');assert.match(result.message,/原站限制访问/);assert.equal(writes,0);
  await assert.rejects(readFile(path.join(root,'data/note-rewrites',job.id+'.md')));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
