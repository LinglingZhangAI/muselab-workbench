// Render credentials are read from .env.cloud.local; never printed or committed.
import {readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const configPath=path.join(root,'.env.cloud.local');
const local=parseEnv(await readFile(configPath,'utf8'));
const key=local.RENDER_API_KEY;if(!key)throw new Error('请先在 .env.cloud.local 配置 RENDER_API_KEY');
async function api(endpoint,options={}){
 const response=await fetch('https://api.render.com/v1'+endpoint,{...options,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!response.ok){const text=await response.text();throw new Error('Render 请求失败 '+response.status+' '+text.slice(0,500));}
 return await response.json();
}
async function persist(patch){
 let content=await readFile(configPath,'utf8');
 for(const [name,value] of Object.entries(patch)){
  if(!/^[A-Z0-9_]+$/.test(name)||/[\r\n]/.test(value))throw new Error('配置无效');
  const line=name+'='+value;const pattern=new RegExp('^'+name+'=.*$','m');content=pattern.test(content)?content.replace(pattern,()=>line):content+'\n'+line+'\n';
 }
 const temporary=configPath+'.tmp';await writeFile(temporary,content,{mode:0o600});await rename(temporary,configPath);await chmod(configPath,0o600);
}
const action=process.argv[2]||'inspect';
if(action==='inspect'){
 const owners=await api('/owners?limit=100');
 const services=await api('/services?limit=100');
 console.log(JSON.stringify({owners:owners.map(entry=>({id:entry.owner.id,name:entry.owner.name,type:entry.owner.type})),services:services.map(entry=>({id:entry.service.id,name:entry.service.name,repo:entry.service.repo,branch:entry.service.branch,url:entry.service.serviceDetails?.url,plan:entry.service.serviceDetails?.plan,suspended:entry.service.suspended}))},null,2));
}else if(action==='create'){
 const ownerId=process.argv[3],branch=process.argv[4];if(!ownerId||!branch)throw new Error('需要已确认的 ownerId 和部署分支');
 const owners=await api('/owners?limit=100');if(!owners.some(entry=>entry.owner.id===ownerId))throw new Error('工作区不属于当前账号');
 const existing=await api('/services?limit=100');if(existing.some(entry=>entry.service.name==='muselab'))throw new Error('已有 muselab 服务，请先检查以避免重复创建或更改现有服务');
 const password=local.MUSELAB_PASSWORD||randomBytes(18).toString('base64url');
 const session=local.MUSELAB_SESSION_SECRET||randomBytes(32).toString('hex');
 const sync=local.MUSELAB_SYNC_TOKEN||randomBytes(32).toString('hex');
 const envVars=Object.entries({NODE_VERSION:'22.16.0',NODE_ENV:'production',MUSELAB_STORAGE:'supabase',MUSELAB_DATA_DIR:'/tmp/muselab-cache',SUPABASE_URL:local.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:local.SUPABASE_SERVICE_ROLE_KEY,SUPABASE_STORAGE_BUCKET:'muselab-media',MUSELAB_PASSWORD:password,MUSELAB_SESSION_SECRET:session,MUSELAB_SYNC_TOKEN:sync}).map(([key,value])=>{if(!value)throw new Error(key+' 未配置');return {key,value};});
 // Persist generated secrets first so an interrupted request cannot lose access.
 await persist({MUSELAB_PASSWORD:password,MUSELAB_SESSION_SECRET:session,MUSELAB_SYNC_TOKEN:sync});
 const result=await api('/services',{method:'POST',body:JSON.stringify({type:'web_service',name:'muselab',ownerId,repo:'https://github.com/LinglingZhangAI/muselab.git',branch,autoDeployTrigger:'off',envVars,serviceDetails:{runtime:'node',plan:'free',region:'singapore',numInstances:1,healthCheckPath:'/healthz',envSpecificDetails:{buildCommand:'npm ci --include=dev && npm run build:cloud',startCommand:'npm start'}}})});
 const service=result.service||result;const url=service.serviceDetails?.url;
 await persist({RENDER_SERVICE_ID:service.id,...(url?{MUSELAB_CLOUD_URL:url}:{})});
 console.log(JSON.stringify({serviceId:service.id,url,dashboardUrl:service.dashboardUrl,deployId:result.deployId,plan:service.serviceDetails?.plan,credentials:'访问密码保存在 .env.cloud.local 的 MUSELAB_PASSWORD 中'},null,2));
}else if(action==='status'){
 const id=local.RENDER_SERVICE_ID;if(!id)throw new Error('尚未记录 Render 服务 ID');
 const service=await api('/services/'+id);const deploys=await api('/services/'+id+'/deploys?limit=3');
 if(service.serviceDetails?.url&&service.serviceDetails.url!==local.MUSELAB_CLOUD_URL)await persist({MUSELAB_CLOUD_URL:service.serviceDetails.url});
 console.log(JSON.stringify({serviceId:service.id,url:service.serviceDetails?.url,plan:service.serviceDetails?.plan,deploys:deploys.map(entry=>({id:entry.deploy.id,status:entry.deploy.status,createdAt:entry.deploy.createdAt,finishedAt:entry.deploy.finishedAt,commit:entry.deploy.commit?.id}))},null,2));
}else throw new Error('未知操作');
