import {build} from 'esbuild';
import {mkdir,copyFile,access} from 'node:fs/promises';
await mkdir('deploy/seed',{recursive:true});
await copyFile('deploy/public-library.json','deploy/seed/pinterest-library.json');
await build({entryPoints:['server/cloud.ts'],outfile:'build-server/cloud.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external'});
