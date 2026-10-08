import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {combine} from './model.mjs';
import {loadData} from './data.mjs';
const root=new URL('../',import.meta.url),preview=process.argv.includes('--preview');
const config=JSON.parse(await readFile(new URL('site.config.json',root),'utf8'));
const repository=process.env.GITHUB_REPOSITORY||config.repository;
if(repository&&!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw new Error('repository必须为 owner/repo');
const {history,approved}=await loadData(root,preview);let records=combine(history,approved);let demo=false;
if(!records.length&&config.showDemoWhenEmpty){records=JSON.parse(await readFile(new URL('data/demo.json',root),'utf8'));demo=true;}
const payload={config:{...config,repository,preview,demo},records,builtAt:new Date().toISOString()};
const [template,css,js]=await Promise.all(['site/index.html','site/style.css','site/app.js'].map(p=>readFile(new URL(p,root),'utf8')));
const json=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html=template.replace('/*INLINE_CSS*/',()=>css).replace('/*INLINE_APP*/',()=>js).replace('"INLINE_DATA"',()=>json);
const dir=new URL(preview?'preview/':'dist/',root);await mkdir(dir,{recursive:true});await writeFile(new URL('index.html',dir),html);await writeFile(new URL('.nojekyll',dir),'');
console.log(`${preview?'Local preview':'Pages build'}: ${records.length} records; demo=${demo}; repository=${repository||'unconfigured'}`);
