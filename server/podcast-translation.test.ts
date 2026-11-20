import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PodcastTranslator,validateTranslations} from './podcast-translation.ts';
test('translation preserves cue times and original text, resumes batches and rejects stale translations',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'muselab-translation-test-'));const id='0123456789abcdef01234567';
 const cues=Array.from({length:65},(_,index)=>({start:index*2,end:index*2+1,text:'Original '+index}));let calls=0;
 try{
  const first=new PodcastTranslator(root,async(_root,batch)=>{if(++calls===2)throw new Error('中断');return batch.map(cue=>'译文 '+cue.start);});await first.request(id,cues);
  const wait=async(engine:PodcastTranslator)=>{let state;for(let i=0;i<100;i++){state=await engine.read(id,cues);if(state?.status!=='translating')break;await new Promise(resolve=>setTimeout(resolve,10));}return state!;};
  assert.equal((await wait(first)).status,'error');assert.equal((await first.read(id,cues))?.texts.length,60);
  const resumed=new PodcastTranslator(root,async(_root,batch)=>{assert.equal(batch.length,5);return batch.map(cue=>'译文 '+cue.start);});await resumed.request(id,cues);assert.equal((await wait(resumed)).status,'complete');
  const result=await resumed.attach(id,cues);assert.equal(result.cues.length,65);assert.deepEqual(result.cues.map(({start,end,text})=>({start,end,text})),cues);assert.equal(result.cues[64].textZh,'译文 128');
  assert.equal(await resumed.read(id,[{start:0,end:1,text:'Changed audio text'}]),null);
  assert.throws(()=>validateTranslations({translations:[{index:1,textZh:'错误索引'}]},1));assert.throws(()=>validateTranslations({translations:[]},1));
 }finally{await rm(root,{recursive:true,force:true});}
});
