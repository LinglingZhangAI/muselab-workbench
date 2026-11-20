import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePodcastCues,activePodcastCue,savedPodcastTime,savePodcastTime,loadPodcastSession,savePodcastSession,latestPodcastProgress} from './podcast-playback.ts';
import type {PodcastEpisode} from './podcasts';
test('SRT and VTT retain actual timecodes and strip markup',()=>{
 const cues=parsePodcastCues('WEBVTT\n\n00:00.000 --> 00:03.500 align:start\n<v Speaker>第一句</v>\n\n2\n00:00:04,000 --> 00:00:09,000\n第二句\n下一行');
 assert.deepEqual(cues,[{start:0,end:3.5,text:'第一句'},{start:4,end:9,text:'第二句\n下一行'}]);assert.equal(activePodcastCue(cues,1),0);assert.equal(activePodcastCue(cues,3.7),-1);assert.equal(activePodcastCue(cues,8),1);assert.equal(activePodcastCue(cues,9),-1);assert.throws(()=>parsePodcastCues('不含真实时间轴的简介'));
});
test('playback history restores the last played episode and preserves a deliberate reset to zero',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 const episode:PodcastEpisode={id:'0123456789abcdef01234567',sourceId:'silicon101',show:'硅谷101',title:'测试节目',publishedAt:'2026-10-28T00:00:00Z',description:'',duration:'10:00',reason:'',audio:'https://example.com/audio.mp3',url:'https://example.com/episode'};
 try{
  assert.equal(loadPodcastSession(),null);savePodcastSession(episode,120,600);assert.equal(loadPodcastSession()?.episode.id,episode.id);assert.equal(savedPodcastTime(episode.id,120),120);
  savePodcastTime(episode.id,0,600);assert.equal(savedPodcastTime(episode.id,120),0);
  savePodcastSession(episode,600,600);assert.equal(loadPodcastSession()?.time,0);
  values.set('muselab-podcast-progress:v1:'+episode.id,JSON.stringify({time:120,updatedAt:'2026-10-27T00:00:00Z'}));
  const newer={...episode,id:'abcdef0123456789abcdef01'};values.set('muselab-podcast-progress:v1:'+newer.id,JSON.stringify({time:0,updatedAt:'2026-10-28T00:00:00Z'}));
  assert.equal(latestPodcastProgress([episode,newer]),newer.id);
  values.set('muselab-podcast-progress:v1:'+newer.id,'broken JSON');assert.equal(latestPodcastProgress([episode,newer]),episode.id);
  values.set('muselab-podcast-session:v1',JSON.stringify({episode:{...episode,audio:'javascript:alert(1)'},time:0,duration:600}));assert.equal(loadPodcastSession(),null);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
});
