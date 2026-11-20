import {useId} from 'react';

/** Small, monochrome objects matching the soft lighting of the brief reference. */
export function BriefSymbol({kind}:{kind:'chat'|'mail'|'sun'|'bell'}){
 const id=useId().replace(/:/g,'');
 return <svg className={'brief-object brief-object-'+kind} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+'-dark'} x1=".1" y1="0" x2=".85" y2="1"><stop offset="0" stopColor="#777876"/><stop offset=".3" stopColor="#393a38"/><stop offset="1" stopColor="#121311"/></linearGradient>
   <linearGradient id={id+'-light'} x1=".15" y1="0" x2=".8" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".4" stopColor="#ecece9"/><stop offset="1" stopColor="#a8a9a5"/></linearGradient>
   <linearGradient id={id+'-fold'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".62" stopColor="#dedfdb"/><stop offset="1" stopColor="#8d8f8a"/></linearGradient>
   <radialGradient id={id+'-orb'} cx=".28" cy=".22" r=".85"><stop offset="0" stopColor="#fff"/><stop offset=".45" stopColor="#f4f4f0"/><stop offset=".78" stopColor="#d5d6d0"/><stop offset="1" stopColor="#9c9e96"/></radialGradient>
   <filter id={id+'-shadow'} x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="1.25" floodColor="#2b2b25" floodOpacity=".2"/></filter>
   <filter id={id+'-blur'}><feGaussianBlur stdDeviation="1.7"/></filter>
  </defs>
  <ellipse cx="25" cy="42" rx="15" ry="2.4" fill="#797b75" opacity=".18" filter={'url(#'+id+'-blur)'}/>
  {kind==='chat'&&<g filter={'url(#'+id+'-shadow)'}>
   <path d="M25 5C34 4 41 9 41 17c0 4-1 7-4 10l2 7-9-4c-9 1-16-4-17-11S16 6 25 5Z" fill={'url(#'+id+'-dark)'}/>
   <path d="M21 6c5-1 10 0 13 3" fill="none" stroke="#b2b3af" strokeWidth="1.4" opacity=".5" strokeLinecap="round"/>
   <path d="M17 17C9 17 4 22 5 28c0 3 2 5 4 7l-2 6 8-3c8 2 16-2 16-9S25 17 17 17Z" fill={'url(#'+id+'-light)'}/>
   <path d="M9 23c3-3 7-4 12-3" fill="none" stroke="#fff" strokeWidth="1.3" opacity=".8" strokeLinecap="round"/>
  </g>}
  {kind==='mail'&&<g filter={'url(#'+id+'-shadow)'}>
   <rect x="4" y="11" width="40" height="29" rx="6" fill={'url(#'+id+'-dark)'}/>
   <path d="m6 37 14-13c2-2 6-2 8 0l14 13" fill="none" stroke="#777872" opacity=".55" strokeWidth="1"/>
   <path d="M5 14c0-3 2-5 5-5h28c3 0 5 2 5 5L28 28c-2 2-6 2-8 0Z" fill={'url(#'+id+'-fold)'}/>
   <path d="M8 12h31" fill="none" stroke="#fff" opacity=".95" strokeWidth="1.5" strokeLinecap="round"/>
   <path d="m6 16 14 13c3 2 5 2 8 0l14-13" fill="none" stroke="#111" opacity=".18" strokeWidth="1.5"/>
  </g>}
  {kind==='bell'&&<g filter={'url(#'+id+'-shadow)'}>
   <circle cx="24" cy="7" r="3.5" fill={'url(#'+id+'-dark)'}/>
   <circle cx="24" cy="37" r="5" fill={'url(#'+id+'-dark)'}/>
   <path d="M11 24c0-10 4-15 13-15s13 5 13 15c0 5 2 7 4 10 1 2-1 3-3 3H10c-2 0-4-1-3-3 2-3 4-5 4-10Z" fill={'url(#'+id+'-light)'}/>
   <ellipse cx="24" cy="36" rx="16" ry="2" fill="#9b9d95" opacity=".55"/>
   <path d="M16 24c0-7 2-10 7-11" fill="none" stroke="#fff" strokeWidth="2" opacity=".85" strokeLinecap="round"/>
  </g>}
  {kind==='sun'&&<g filter={'url(#'+id+'-shadow)'}>
   <g stroke="#7a7c73" strokeWidth="3" strokeLinecap="round"><path d="M24 3v4M24 41v4M3 24h4M41 24h4M9 9l3 3M36 36l3 3M9 39l3-3M36 12l3-3"/></g>
   <circle cx="24" cy="24" r="13" fill={'url(#'+id+'-orb)'}/>
   <path d="M15 20a10 10 0 0 1 11-6" stroke="#fff" opacity=".85" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </g>}
 </svg>;
}
