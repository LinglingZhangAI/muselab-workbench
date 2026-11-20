import {test} from 'node:test';
import assert from 'node:assert/strict';
import {podcastPeople} from './podcast-people.ts';

test('reads credit blocks without treating biographies or timeline as names',()=>{
 assert.deepEqual(podcastPeople('【主持人】\n\n骆轶航｜《硅基立场》主理人；硅星人创始人\n\n【嘉宾】\n姚旭｜NaukNauk创始人\n【时间线】\n00:00:00 产品与创业'),{hosts:['骆轶航'],guests:['姚旭']});
});
test('collects multiple inline hosts and handles emoji-prefixed credits',()=>{
 assert.deepEqual(podcastPeople('主播: 枫影 Justin Yan\n\n主播: 自力 hzlzh\n节目收听方式'),{hosts:['枫影 Justin Yan','自力 hzlzh'],guests:[]});
 assert.deepEqual(podcastPeople('👦🏻 主播 Koji：我创办了十字路口。'),{hosts:['Koji'],guests:[]});
});
test('reads explicitly introduced guest names, not companies or roles',()=>{
 assert.deepEqual(podcastPeople('本周「十字路口」的嘉宾是 Treg 创始人 Jason Zhou 和 Founding Engineer 石天鑫。创业 9 个多月。'),{hosts:[],guests:['Jason Zhou','石天鑫']});
});
test('does not invent identities from topics or promotional prose',()=>{
 assert.deepEqual(podcastPeople('Kimi与智谱：大厂用AI做大生意\n我们讨论模型能力，欢迎订阅。'),{hosts:[],guests:[]});
 assert.deepEqual(podcastPeople('【主持人】\n骆轶航｜主理人\n【关注我们】\n硅基立场pro'),{hosts:['骆轶航'],guests:[]});
});
test('keeps names without comma-separated biographies, show titles or attached links',()=>{
 assert.deepEqual(podcastPeople('嘉宾：空空，AI 产品经理，播客《认知迭代的空》主播https://www.xiaoyuzhoufm.com/podcast/67bdc8aa041f2b854f14e755，持续实践 AI 互动游戏与 AI Coding。'),{hosts:[],guests:['空空']});
 assert.deepEqual(podcastPeople('嘉宾：空空、姚旭\n主持人：Nia，产品经理'),{hosts:['Nia'],guests:['空空','姚旭']});
});
