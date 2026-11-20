import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyNote,organizeArticle} from './note-classification.ts';

test('classifies the article subject rather than incidental AI or product names',()=>{
 const cases=[
  ['AI越来越强，我却越来越不快乐：聊聊 AI 时代的虚无主义','认知与成长'],
  ['Claude Code 工作流教程：自动化提效技巧','工具与效率'],
  ['AI 时代的字体设计与排版','设计与创意'],
  ['【LLM】Kimi与智谱：大厂用AI“做大生意”，它们靠AI做“大生意”','产品与商业'],
  ['大模型训练与推理算法详解','AI 与技术'],
  ['苹果大会新闻：新功能发布与监管动态','行业动态'],
 ];
 for(const [title,category] of cases)assert.equal(classifyNote(title,''),category,title);
});
test('uses body evidence while ignoring image alt text and URL keywords',()=>{
 assert.equal(classifyNote('一份观察','正在讨论字体、排版、视觉和交互。'),'设计与创意');
 assert.equal(classifyNote('周末随记','![AI 模型训练 算法](https://example.com/ai) https://example.com/ai/prompt/codex'),undefined);
});
test('organizes existing and new articles without altering their content or timestamps',()=>{
 const article={id:'article-1',title:'AI 时代的虚无主义',body:'原文与我的批注',source:{kind:'article'},createdAt:'2026-10-26T02:00:00Z',updatedAt:'2026-10-26T03:00:00Z'};
 const result=organizeArticle(article);
 assert.deepEqual(result,{...article,folder:'认知与成长',folderMode:'auto'});
 assert.equal(organizeArticle(result),result);
 assert.equal(organizeArticle({...article,id:'rewrite-1',source:undefined}).folder,'认知与成长');
 assert.equal(organizeArticle({...article,source:{kind:'podcast',format:'article'}}).folder,'认知与成长');
});
test('preserves manual folders, manual unclassified articles, and ordinary notes',()=>{
 const base={id:'one',title:'大模型训练算法',body:'原文',source:{kind:'article'}};
 for(const folder of ['个人收藏','未分类','']){const note={...base,folder};assert.equal(organizeArticle(note),note);}
 const manual={...base,folderMode:'manual' as const};assert.equal(organizeArticle(manual),manual);
 const note={...base,source:undefined};assert.equal(organizeArticle(note),note);
 const excerpt={...base,source:{kind:'podcast'}};assert.equal(organizeArticle(excerpt),excerpt);
 const unknown={...base,title:'周末随记'};assert.equal(organizeArticle(unknown),unknown);
});
