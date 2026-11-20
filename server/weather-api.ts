import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import type {Plugin} from 'vite';
import {weatherCondition,type HangzhouWeather} from '../src/lib/weather';
import {shanghaiDay} from './news-source';
const endpoint='https://api.open-meteo.com/v1/forecast?latitude=30.2741&longitude=120.1551&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=1';
function valid(data:HangzhouWeather){return data&&/^\d{4}-\d{2}-\d{2}$/.test(data.date)&&[data.temperature,data.feelsLike,data.low,data.high,data.rainChance,data.humidity,data.wind,data.code].every(Number.isFinite)&&[data.fetchedAt,data.observedAt].every(t=>Number.isFinite(Date.parse(t)))&&typeof data.isDay==='boolean'&&data.low<=data.high&&data.rainChance>=0&&data.rainChance<=100&&data.humidity>=0&&data.humidity<=100;}
export function weatherApi(root:string):Plugin{
 let cache:HangzhouWeather|null=null;let pending:Promise<HangzhouWeather>|null=null;let attemptedAt=0;
 const file=path.join(root,'data/hangzhou-weather.json');
 async function refresh(){
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('天气服务暂不可用');
  const json=await response.json();const c=json.current;const d=json.daily;
  const result:HangzhouWeather={date:d?.time?.[0],observedAt:c?.time+'+08:00',fetchedAt:new Date().toISOString(),temperature:c?.temperature_2m,feelsLike:c?.apparent_temperature,low:d?.temperature_2m_min?.[0],high:d?.temperature_2m_max?.[0],rainChance:d?.precipitation_probability_max?.[0],humidity:c?.relative_humidity_2m,wind:c?.wind_speed_10m,code:c?.weather_code,isDay:c?.is_day===1,...weatherCondition(c?.weather_code)};
  if(!valid(result)||result.date!==shanghaiDay()||shanghaiDay(new Date(result.observedAt))!==result.date)throw new Error('天气数据日期或格式异常');
  cache=result;const temporary=file+'.tmp';await writeFile(temporary,JSON.stringify(result,null,2)+'\n');await rename(temporary,file);return result;
 }
 const middleware=(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  if(req.url?.split('?')[0]!=='/api/hangzhou-weather')return next();
  const reply=(status:number,data:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='GET')return reply(405,{error:'仅支持读取天气'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin)))return reply(403,{error:'请从 Muselab 读取天气'});
  void(async()=>{
   if(!cache)try{const saved=JSON.parse(await readFile(file,'utf8'));if(valid(saved))cache={...saved,...weatherCondition(saved.code)};}catch{/* Fetch a fresh forecast below. */}
   let warning='';if((!cache||cache.date!==shanghaiDay()||Date.now()-Date.parse(cache.fetchedAt)>1800000)&&Date.now()-attemptedAt>60000&&!pending){attemptedAt=Date.now();pending=refresh().finally(()=>{pending=null;});}
   if(pending)try{cache=await pending;}catch{warning='天气更新失败，显示上次记录';}
   if(!cache)return reply(503,{error:'杭州天气暂时无法读取，请稍后重试'});
   reply(200,{...cache,stale:cache.date!==shanghaiDay()||Date.now()-Date.parse(cache.fetchedAt)>3600000,warning});
  })().catch(()=>reply(503,{error:'杭州天气暂时无法读取'}));
 };
 return {name:'muselab-hangzhou-weather',configureServer(s){s.middlewares.use(middleware);},configurePreviewServer(s){s.middlewares.use(middleware);}};
}
