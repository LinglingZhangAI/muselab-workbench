import {useId} from 'react';

/** Sculpted graphite and frosted glass, lit from the upper left. */
export function NavigationSymbol({kind}:{kind:'home'|'folder'|'notes'|'whiteboard'|'events'}){
 const id='nav-'+useId().replace(/:/g,'');
 const paint=(name:string)=>`url(#${id}-${name})`;
 return <svg className="navigation-object" data-kind={kind} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+'-graphite'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#737473"/><stop offset=".42" stopColor="#434443"/><stop offset="1" stopColor="#202120"/></linearGradient>
   <linearGradient id={id+'-roof'} x1=".1" y1="0" x2=".9" y2="1"><stop stopColor="#e3e4e1"/><stop offset=".38" stopColor="#a0a29e"/><stop offset=".72" stopColor="#757773"/><stop offset="1" stopColor="#d4d5d1"/></linearGradient>
   <linearGradient id={id+'-side'} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#858782"/><stop offset="1" stopColor="#353733"/></linearGradient>
   <linearGradient id={id+'-glass'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eff0ed" stopOpacity=".93"/><stop offset=".18" stopColor="#d6d7d3" stopOpacity=".88"/><stop offset=".55" stopColor="#a5a7a1" stopOpacity=".94"/><stop offset="1" stopColor="#f0f0eb"/></linearGradient>
   <linearGradient id={id+'-board-surface'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fcfcfa"/><stop offset=".55" stopColor="#e4e7df"/><stop offset="1" stopColor="#c8cec0"/></linearGradient>
   <linearGradient id={id+'-door'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4f4f0"/><stop offset="1" stopColor="#b8bab3"/></linearGradient>
   <filter id={id+'-shadow'} x="-40%" y="-30%" width="180%" height="190%"><feDropShadow dx="0" dy="1.4" stdDeviation=".85" floodColor="#2d3029" floodOpacity=".16"/></filter>
   <filter id={id+'-blur'} x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="1.6"/></filter>
  </defs>
  <ellipse cx="24" cy="42" rx="15" ry="1.5" fill="#6b6d66" opacity=".16" filter={paint('blur')}/>
  {kind==='home'?<g filter={paint('shadow')}>
   <path d="M6 20 23.5 6.5 42 20.3l-2 3.4-16.5-12L8 24Z" fill={paint('roof')}/>
   <path d="m10 23 14-10.5L38 23v14.7c0 2-1.7 3.3-3.7 3.3H14c-2.2 0-4-1.5-4-3.7Z" fill={paint('graphite')}/>
   <path d="m10 23 3 1.5V38c0 1.2.4 2.1 1.2 3-2.5 0-4.2-1.5-4.2-3.7Z" fill={paint('side')}/>
   <path d="m9 22 15-11.2L39 22" fill="none" stroke="#f6f6f1" strokeOpacity=".55" strokeWidth="1" strokeLinecap="round"/>
   <path d="M20 41V31a4.2 4.2 0 0 1 8.4 0v10" fill={paint('door')}/>
   <path d="M20 40V31a4.2 4.2 0 0 1 4.2-4.2" fill="none" stroke="#111" strokeOpacity=".25" strokeWidth="1"/>
   <path d="M15 39h4M30 39h4" stroke="#fff" strokeOpacity=".09" strokeLinecap="round"/>
  </g>:kind==='whiteboard'?<g filter={paint('shadow')}>
   <g transform="rotate(-5 24 24)">
    <rect x="5.5" y="10.5" width="36" height="28" rx="4.5" fill={paint('side')}/>
    <rect x="4" y="8" width="36" height="28" rx="4.5" fill={paint('graphite')}/>
    <rect x="6" y="10" width="32" height="24" rx="3" fill={paint('board-surface')}/>
    <path d="M9 11h25a3 3 0 0 1 3 3" fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="1" strokeLinecap="round"/>
    <path d="M17 17h5a3 3 0 0 1 3 3v6h5M13 20v6" fill="none" stroke="#72796f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="10" y="14" width="8" height="6" rx="1.8" fill={paint('graphite')}/>
    <rect x="10" y="25" width="7" height="5.5" rx="1.6" fill="#9ba294" stroke="#fff" strokeOpacity=".6" strokeWidth=".6"/>
    <rect x="29" y="23" width="5" height="6" rx="1.5" fill="#8a9085"/>
    <path d="M9 35h25" stroke="#e9ebe5" strokeOpacity=".6" strokeWidth=".7" strokeLinecap="round"/>
   </g>
   <g transform="rotate(35 36 31)">
    <path d="M33.5 19.5a2.5 2.5 0 0 1 5 0V37h-5Z" fill={paint('graphite')} stroke="#f5f5ef" strokeWidth=".8"/>
    <path d="M34.8 21v13" stroke="#b5b8b0" strokeOpacity=".8" strokeWidth=".9" strokeLinecap="round"/>
    <path d="M33.5 37h5L36 42Z" fill={paint('roof')}/>
    <path d="m35.1 40.2.9 1.8.9-1.8Z" fill="#353832"/>
    <path d="M33.7 22h4.6" stroke="#dbddd6" strokeWidth="1"/>
   </g>
  </g>:kind==='events'?<g filter={paint('shadow')}>
   <path d="M22 8h5v32h-5Z" fill={paint('side')}/>
   <path d="M23 8h1.5v31H23Z" fill="#e4e5df" opacity=".55"/>
   <path d="M9 10h23l7 6-7 6H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" fill={paint('graphite')} stroke="#aaaDA6" strokeWidth=".6"/>
   <path d="M10 12h21l4 3" fill="none" stroke="#fff" strokeOpacity=".25" strokeLinecap="round"/>
   <path d="M38 24H15l-7 6 7 6h23a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Z" fill={paint('glass')} stroke="#fff" strokeOpacity=".7" strokeWidth=".7"/>
   <path d="M16 26h21M16 33h13" stroke="#fff" strokeOpacity=".55" strokeLinecap="round"/>
   <path d="M18 40h14l3 3H15Z" fill={paint('roof')}/>
  </g>:kind==='notes'?<g filter={paint('shadow')}>
   <rect x="10" y="7" width="29" height="35" rx="5" fill={paint('graphite')}/>
   <path d="M16 8v33" stroke="#b3b5af" strokeOpacity=".6" strokeWidth="1.2"/>
   <path d="M21 17h11M21 23h11M21 29h8" stroke="#eee" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round"/>
   <path d="M10 14h5M10 22h5M10 30h5" stroke="#e2e3df" strokeWidth="2" strokeLinecap="round"/>
   <path d="M38 27 30 38l-1 5 4-2 8-11Z" fill={paint('glass')} stroke="#fff" strokeWidth=".6"/>
  </g>:<g filter={paint('shadow')}>
   <path d="M7 13a4 4 0 0 1 4-4h7c2 0 2.6.6 3.8 2l2 2.5H36a4 4 0 0 1 4 4V35H7Z" fill={paint('graphite')}/>
   <path d="M8 14a3.2 3.2 0 0 1 3-3h7c1.6 0 2.2.8 3.1 1.8" fill="none" stroke="#a2a49e" strokeWidth="1" strokeOpacity=".6" strokeLinecap="round"/>
   <path d="M10 21h27v14H10Z" fill="#222420"/>
   <path d="M8.5 24h31a2.2 2.2 0 0 1 2.2 2.5l-2 13A3 3 0 0 1 36.8 42H11.2a3 3 0 0 1-3-2.5l-2-13A2.2 2.2 0 0 1 8.5 24Z" fill={paint('glass')} stroke="#fff" strokeOpacity=".65" strokeWidth=".7"/>
   <path d="M8.5 25h31" stroke="#fff" strokeOpacity=".9" strokeWidth="1" strokeLinecap="round"/>
   <path d="M10.2 40.5h27.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".7" strokeLinecap="round"/>
  </g>}
 </svg>;
}
