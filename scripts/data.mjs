import {readFile,readdir} from 'node:fs/promises';
export async function loadData(root,preview=false){
 const history=JSON.parse(await readFile(new URL(preview?'private-data/history.json':'data/history.json',root),'utf8'));
 const files=(await readdir(new URL('data/approved/',root))).filter(f=>/^issue-\d+\.json$/.test(f));
 const approved=await Promise.all(files.map(f=>readFile(new URL('data/approved/'+f,root),'utf8').then(JSON.parse)));
 return {history,approved};
}
