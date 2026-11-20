import {useId} from 'react';
import {BriefSymbol} from './brief-symbol';
import type {WeatherKind} from '@/lib/weather';
export function WeatherSymbol({kind}:{kind:WeatherKind}){
 const id='weather-'+useId().replace(/:/g,'');
 if(kind==='sun')return <BriefSymbol kind="sun"/>;
 return <svg className="brief-object weather-object" data-weather-kind={kind} viewBox="0 0 48 48" aria-hidden="true">
  <defs><linearGradient id={id+'cloud'} x1=".15" y1="0" x2=".8" y2="1"><stop stopColor="#fff"/><stop offset=".5" stopColor="#e1e2dc"/><stop offset="1" stopColor="#a2a59a"/></linearGradient><linearGradient id={id+'dark'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8e9088"/><stop offset="1" stopColor="#33372f"/></linearGradient><filter id={id+'shadow'} x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="1.1" floodOpacity=".17"/></filter></defs>
  <g filter={`url(#${id}shadow)`}>
   {kind==='moon'?<path d="M34 7a18 18 0 1 0 9 27C28 37 17 24 24 8c3-4 6-4 10-1Z" fill={`url(#${id}cloud)`}/>:<>
    <path d="M13 30C2 30 2 16 12 15c2-12 19-13 23-1 12-1 14 16 2 16Z" fill={`url(#${id}cloud)`}/>
    <path d="M9 20c1-2 3-3 6-3 1-5 5-8 9-8" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".8" strokeLinecap="round"/>
    {kind==='rain'&&<g stroke={`url(#${id}dark)`} strokeWidth="3" strokeLinecap="round"><path d="m15 35-3 6m13-6-3 6m13-6-3 6"/></g>}
    {kind==='storm'&&<path d="m25 29-9 10h7l-2 8 13-14h-8l4-4Z" fill={`url(#${id}dark)`}/>}
    {kind==='snow'&&<g stroke="#8a9083" strokeWidth="1.6" strokeLinecap="round"><path d="M15 34v10m-4-7 8 4m-8 0 8-4M32 34v10m-4-7 8 4m-8 0 8-4"/></g>}
    {kind==='fog'&&<g stroke="#9da194" strokeWidth="2.5" strokeLinecap="round"><path d="M8 36h32M12 42h24"/></g>}
   </>}
  </g>
 </svg>;
}
