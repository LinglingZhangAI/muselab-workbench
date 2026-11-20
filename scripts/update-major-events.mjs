import {scanMajorEvents} from '../server/major-events-source.ts';
const result=await scanMajorEvents(process.cwd());
console.log(JSON.stringify({events:result.events.length,candidates:result.candidateCount,lastAttemptAt:result.lastAttemptAt,sources:result.sourceStatus},null,2));
if(result.sourceStatus?.every(source=>!source.ok))process.exitCode=1;
