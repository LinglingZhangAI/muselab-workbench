import type {IncomingMessage,ServerResponse} from 'node:http';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

export function cloudAuth(password:string,secret:string,publicUrl:URL){
 if(password.length<12||secret.length<32)throw new Error('MUSELAB_PASSWORD 至少 12 位，MUSELAB_SESSION_SECRET 至少 32 位');
 const salt=randomBytes(16);const passwordHash=scryptSync(password,salt,32);const ttl=7*86400;
 const failures=new Map<string,{count:number;until:number}>();
 const sign=(value:string)=>createHmac('sha256',secret).update(value).digest('hex');
 const equal=(a:string,b:string)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const cookie=(value:string,age=ttl)=>`muselab_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${publicUrl.protocol==='https:'?'; Secure':''}`;
 const valid=(req:IncomingMessage)=>{const value=req.headers.cookie?.split(';').map(p=>p.trim()).find(p=>p.startsWith('muselab_session='))?.slice(16)||'';const [expires,nonce,signature]=value.split('.');return /^\d+$/.test(expires)&&Number(expires)>Date.now()&&Number(expires)<=Date.now()+ttl*1000&&/^[a-f0-9]{32}$/.test(nonce||'')&&equal(signature||'',sign(expires+'.'+nonce));};
 const page=(failed=false)=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 · Muselab</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#fafaf8;color:#292929;font-family:'Songti SC',STSong,SimSun,Georgia,serif;padding:24px}main{width:min(360px,100%);padding:36px;background:white;border:1px solid #e6e6e1;border-radius:20px}small{letter-spacing:.2em;color:#888}h1{font-weight:400;font-size:30px;margin:14px 0}p{color:#777;line-height:1.8;font-size:14px}label{display:block;font-size:14px;margin:26px 0 9px}input,button{font:inherit;width:100%;padding:12px;border-radius:8px}input{border:1px solid #deded7;background:#fafaf8}button{border:0;background:#30312f;color:white;margin-top:16px;cursor:pointer}input:focus-visible,button:focus-visible{outline:2px solid #444;outline-offset:3px}.error{color:#934a43}</style><main><small>MUSELAB</small><h1>灵感，回到这里。</h1><p>登录你的个人工作台。</p>${failed?'<p class="error" role="alert">密码不正确，或尝试过于频繁，请稍后重试。</p>':''}<form method="post" action="/login"><label for="password">访问密码</label><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="256" autofocus><button type="submit">进入工作台</button></form></main></html>`;
 return (req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  const pathname=req.url?.split('?')[0];
  res.setHeader('Cache-Control','private, no-store');
  if(pathname==='/login'&&req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page());return;}
  if(pathname==='/login'&&req.method==='POST'){
   if(req.headers.origin!==publicUrl.origin){res.writeHead(403);res.end('请从登录页提交');return;}
   void(async()=>{
    let input='';for await(const chunk of req){input+=chunk;if(Buffer.byteLength(input)>1024){res.writeHead(413);res.end();return;}}
    const ip=req.socket.remoteAddress||'owner';const previous=failures.get(ip);const attempt=previous&&previous.until>Date.now()?previous:{count:0,until:Date.now()+15*60000};
    const value=new URLSearchParams(input).get('password')||'';
    if(attempt.count>=10||!timingSafeEqual(scryptSync(value.slice(0,256),salt,32),passwordHash)){attempt.count++;failures.set(ip,attempt);res.writeHead(attempt.count>=10?429:401,{'Content-Type':'text/html; charset=utf-8'});res.end(page(true));return;}
    failures.delete(ip);const token=String(Date.now()+ttl*1000)+'.'+randomBytes(16).toString('hex');res.writeHead(303,{'Set-Cookie':cookie(token+'.'+sign(token)),Location:'/'});res.end();
   })().catch(()=>{if(!res.headersSent)res.writeHead(400);res.end();});return;
  }
  if(pathname==='/logout'&&req.method==='POST'){
   if(req.headers.origin!==publicUrl.origin){res.writeHead(403);res.end();return;}
   res.writeHead(303,{'Set-Cookie':cookie('',0),Location:'/login'});res.end();return;
  }
  if(valid(req))return next();
  if(pathname?.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'登录已过期，请重新登录',code:'AUTH_REQUIRED'}));return;}
  res.writeHead(303,{Location:'/login'});res.end();
 };
}
