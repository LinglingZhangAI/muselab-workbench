// Apply only source-specific prompts written after visually inspecting each image.
const esbuild=require('esbuild');const Module=require('node:module');const path=require('node:path');
(async()=>{
 const result=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/data/pinterest-analysis.ts')],bundle:true,platform:'node',format:'cjs',write:false});
 const loaded=new Module(path.join(__dirname,'reviewed-analysis.cjs'));loaded._compile(result.outputFiles[0].text,loaded.filename||path.join(__dirname,'reviewed-analysis.cjs'));
 const response=await fetch('http://127.0.0.1:4187/api/pinterest/library');const data=await response.json();
 const reviewed=new Set(loaded.exports.reviewedPinIds);
 let updated=0;
 for(const asset of data.assets){
  if(!reviewed.has(asset.pinId)||asset.prompt||asset.analysisStatus!=='pending')continue;
  const patch=loaded.exports.analysisFor(asset.pinId,asset.sourceUrl);
  const saved=await fetch('http://127.0.0.1:4187/api/pinterest/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:asset.id,...patch})});
  if(!saved.ok)throw new Error(await saved.text());updated++;
 }
 console.log(JSON.stringify({updated}));
})().catch(error=>{console.error(error);process.exitCode=1;});
