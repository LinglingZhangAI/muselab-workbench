const fs=require('node:fs');const path=require('node:path');
const html=fs.readFileSync('/private/tmp/21st-categories-20261020.html','utf8');
const categories=[];
for(const m of html.matchAll(/<a[^>]*href="(\/community\/components\/s\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/g)){
 const name=m[2].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().replace(/\s+\d+$/,'');
 if(!categories.some(c=>c.url.endsWith(m[1])))categories.push({slug:m[1].split('/').pop(),name,url:'https://21st.dev'+m[1]});
}
if(categories.length<50)throw new Error('Category extraction incomplete');
fs.writeFileSync(path.join(__dirname,'../src/data/21st-categories.json'),JSON.stringify(categories,null,2)+'\n');
console.log('Verified taxonomy categories:',categories.length);
