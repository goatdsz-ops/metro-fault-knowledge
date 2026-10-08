import {readFile,writeFile,unlink,appendFile} from 'node:fs/promises';
import {snapshot,labels,mayReview,unchanged,combine} from './model.mjs';
import {loadData} from './data.mjs';
const root=new URL('../',import.meta.url),repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!repo||!token)throw new Error('仅在已授权的GitHub Actions中运行');
const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
const issue=event.issue,number=issue?.number;
if(!Number.isSafeInteger(number)||number<1||issue.pull_request)throw new Error('无效的知识库Issue');
const base=`https://api.github.com/repos/${repo}`;
async function api(path,method='GET',body,allow404=false){
 const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(allow404&&r.status===404)return null;if(!r.ok)throw new Error(`GitHub API ${method} ${path}: ${r.status}`);return r.status===204?null:r.json();
}
const out=async changed=>appendFile(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);
if(event.action==='edited'){
 // The website keeps the previously approved snapshot. Never publish an edited body automatically.
 await api(`/issues/${number}/labels`, 'POST',{labels:[labels.pending]});
 await api(`/issues/${number}/labels/${labels.approved}`,'DELETE',undefined,true);
 await out(false);
}else if(event.action==='labeled'&&[labels.approved,labels.withdrawn].includes(event.label?.name)){
 const actor=event.sender?.login;if(!actor)throw new Error('缺少审核身份');
 const permission=await api(`/collaborators/${encodeURIComponent(actor)}/permission`);
 if(!mayReview(permission.permission))throw new Error('仅有write、maintain或admin权限的人员可审核或撤回');
 const current=await api(`/issues/${number}`);
 if(!current.labels.some(l=>l.name===event.label.name)){await out(false);process.exit(0);}
 const {history,approved}=await loadData(root);
 const path=new URL(`data/approved/issue-${number}.json`,root);
 if(event.label.name===labels.withdrawn){
  const existing=approved.find(a=>a.issueNumber===number);
  const removed=approved.filter(a=>a.issueNumber===number||(existing&&a.targetId===existing.id));
  for(const a of removed)await unlink(new URL(`data/approved/issue-${a.issueNumber}.json`,root));
  await api(`/issues/${number}/labels/${labels.approved}`,'DELETE',undefined,true);
  await out(removed.length>0);
 }else{
  if(!unchanged(issue,current)){
   await api(`/issues/${number}/labels`, 'POST',{labels:[labels.pending]});
   await api(`/issues/${number}/labels/${labels.approved}`,'DELETE',undefined,true);
   throw new Error('审核后表单内容已变化。请复核最新内容，再次添加kb-approved标签。');
  }
  const record=snapshot(current,actor);
  const existing=approved.find(a=>a.id===record.id);
  if(existing&&existing.kind!==record.kind)throw new Error('已发布记录不能改变类型，请新建Issue');
  combine(history,[...approved.filter(a=>a.id!==record.id),record]);
  await writeFile(path,JSON.stringify(record,null,2)+'\n');
  await api(`/issues/${number}/labels/${labels.pending}`,'DELETE',undefined,true);
  await api(`/issues/${number}/labels/${labels.withdrawn}`,'DELETE',undefined,true);
  await out(true);
 }
}else{await out(false);}
