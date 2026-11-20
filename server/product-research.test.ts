import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type RequestListener} from 'node:http';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {productResearchApi,researchImageBytes} from './product-research-api.ts';
import {validateResearchResult,type ResearchResult} from '../src/lib/research.ts';

const result:ResearchResult={title:'任务入口研究',question:'如何降低首次操作门槛',audience:'新手用户',summary:'待验证的研究方案',limitations:'仅用户输入，无竞品实测',comparisons:[{product:'方案A',task:'开始任务',approach:'先选类型',strength:'可理解',tradeoff:'增加选择',evidenceIds:[]}],findings:[{title:'任务入口假设',observation:'用户要求分析入口',interpretation:'待验证选择成本',recommendation:'减少类型',uncertainty:'尚无测试数据',evidenceIds:[]}],journey:[{step:'选择任务',action:'选择并输入',risk:'命名不清'}],opportunities:[{priority:'P0',title:'验证入口',proposal:'原型测试',rationale:'未知用户偏好',effort:'低',validation:'用户任务测试',successCriteria:'无需帮助完成首个任务',evidenceIds:[]}]};
test('research output rejects invented evidence and image uploads reject invalid contents',()=>{
 assert.equal(validateResearchResult(result,[]).title,result.title);
 assert.throws(()=>validateResearchResult({...result,findings:[{...result.findings[0],evidenceIds:['S99']}]},['S1']),/证据/);
 assert.throws(()=>researchImageBytes('data:image/png;base64,c2VjcmV0'),/格式/);
 assert.throws(()=>researchImageBytes('/etc/passwd'),/PNG/);
});
test('background research persists, deduplicates, retains retry materials, and recovers after restart',async()=>{
 const root=await mkdtemp('/private/tmp/muselab-research-api-test-');let release!:()=>void;let runs=0;const held=new Promise<void>(resolve=>release=resolve);
 let plugin=productResearchApi(root,{generate:async()=>{runs++;await held;if(runs===2)throw new Error('测试断线');return result;}});
 let middleware:RequestListener=(_req,res)=>res.end();const mount=()=>{(plugin.configureServer as Function)({middlewares:{use:(handler:RequestListener)=>{middleware=handler;}}});};mount();
 const server=createServer((req,res)=>middleware(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const post=(body:unknown,from=origin)=>fetch(origin+'/api/product-research',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const input={clientRequestId:randomUUID(),template:'competitor',title:'入口对比',requirements:'请分析首次任务入口的方案取舍和验证计划',links:['https://example.org/reference'],images:[]};
 async function wait(id:string){for(let i=0;i<100;i++){const job=await(await fetch(origin+'/api/product-research?id='+id)).json();if(job.status!=='generating')return job;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Job stalled');}
 try{
  assert.equal((await post(input,'https://evil.example')).status,403);
  assert.equal((await post({...input,images:[{name:'secret',width:20,height:20,dataURL:'/etc/passwd'}]})).status,400);
  const response=await post(input);assert.equal(response.status,202);const first=await response.json();
  assert.equal((await(await post(input)).json()).id,first.id);assert.equal((await post({...input,clientRequestId:randomUUID()})).status,409);
  release();assert.equal((await wait(first.id)).status,'completed');assert.equal(runs,1);
  const saved=JSON.parse(await readFile(path.join(root,'data/product-research',first.id+'.json'),'utf8'));assert.equal(saved.requirements,input.requirements);
  const failed=await(await post({...input,clientRequestId:randomUUID()})).json();assert.equal((await wait(failed.id)).status,'failed');
  const retried=await(await post({clientRequestId:randomUUID(),retryId:failed.id})).json();assert.equal(retried.requirements,input.requirements);assert.equal(retried.links[0],input.links[0]);assert.equal((await wait(retried.id)).status,'completed');
  const interrupted={...first,id:randomUUID(),clientRequestId:randomUUID(),status:'generating'};await writeFile(path.join(root,'data/product-research',interrupted.id+'.json'),JSON.stringify(interrupted));
  plugin=productResearchApi(root);mount();const restored=await(await fetch(origin+'/api/product-research?id='+interrupted.id)).json();assert.equal(restored.status,'failed');assert.match(restored.message,/重启/);
  assert.equal((await(await fetch(origin+'/api/product-research?latest=1')).json()).length,4);
 }finally{release();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
