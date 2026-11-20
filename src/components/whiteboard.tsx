import {lazy,Suspense} from 'react';
const Canvas=lazy(()=>import('./whiteboard-canvas'));
export function Whiteboard(props:{active:boolean;onOpenNavigation:()=>void}){
 return <Suspense fallback={<p className="whiteboard-read-error" role="status">正在打开白板…</p>}><Canvas {...props}/></Suspense>;
}
