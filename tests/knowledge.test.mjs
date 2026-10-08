import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {snapshot,parseForm,mayReview,unchanged,combine} from '../scripts/model.mjs';
const body='### 记录类型\n\n故障案例\n\n### 案例标题\n\nPON口用户离线\n\n### 故障类别\n\n设备故障\n\n### 设备系统\n\nOLT\n\n### 故障现象与告警\n\n部分用户离线\n\n### 处理措施\n\n检查端口告警，确认后处理\n\n### 根因分析\n\n_No response_\n';
const issue={number:8,title:'[知识库] PON口',body,user:{login:'author'},created_at:'2026-10-08T00:00:00Z',html_url:'https://github.com/example/knowledge/issues/8',labels:[{name:'kb-approved'}]};
test('GitHub表单解析并保存审核人及内容哈希',()=>{const r=snapshot(issue,'reviewer');assert.equal(r.kind,'case');assert.equal(r.id,'GH-8');assert.equal(r.cause,'');assert.equal(r.reviewer,'reviewer');assert.equal(r.approvedHash.length,64);});
test('缺必填、未知类型、重复字段不能进入发布数据',()=>{assert.throws(()=>snapshot({...issue,body:body.replace('检查端口告警，确认后处理','')},'reviewer'));assert.throws(()=>snapshot({...issue,body:body.replace('故障案例','未知')},'reviewer'));assert.throws(()=>parseForm(body+'\n### 案例标题\n\n伪造覆盖'));});
test('审核权限必须为write、maintain或admin',()=>{for(const p of ['read','triage','none',undefined])assert.equal(mayReview(p),false);for(const p of ['write','maintain','admin'])assert.equal(mayReview(p),true);});
test('已审核内容再次修改必须重新审核',()=>{assert.equal(unchanged(issue,issue),true);assert.equal(unchanged(issue,{...issue,body:body+'\n改动'}),false);assert.equal(unchanged(issue,{...issue,title:'新标题'}),false);});
test('字段中的普通Markdown小标题不会导致内容丢失',()=>{const r=parseForm(body.replace('检查端口告警，确认后处理','检查端口\n### 第一阶段\n保留检查结果'));assert.equal(r.steps,'检查端口\n### 第一阶段\n保留检查结果');});
test('补充按唯一编号关联，拒绝不存在目标与重复编号',()=>{const r=snapshot(issue,'reviewer');const a={id:'GH-9',kind:'addition',targetId:'GH-8',content:'补充'};assert.equal(combine([],[r,a])[0].additions.length,1);assert.throws(()=>combine([],[a]));assert.throws(()=>combine([r],[r]));});
test('GitHub模板字段与解析器一致',async()=>{for(const filename of ['fault.yml','addition.yml']){const f=JSON.parse(await readFile(new URL('../.github/ISSUE_TEMPLATE/'+filename,import.meta.url),'utf8'));const ids=f.body.filter(x=>x.id).map(x=>x.id);assert.equal(ids.length,new Set(ids).size);assert(f.labels.includes('kb-pending'));}});

async function runReview(t,{action='labeled',permission='write',current=issue,label='kb-approved',approved=[]}={}){
 const dir=await mkdtemp(join(tmpdir(),'metro-review-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await cp(new URL('../scripts/',import.meta.url),join(dir,'scripts'),{recursive:true});await mkdir(join(dir,'data','approved'),{recursive:true});await writeFile(join(dir,'data','history.json'),'[]');
 for(const a of approved)await writeFile(join(dir,'data','approved',`issue-${a.issueNumber}.json`),JSON.stringify(a));
 await writeFile(join(dir,'event.json'),JSON.stringify({action,label:{name:label},sender:{login:'reviewer'},issue}));await writeFile(join(dir,'output.txt'),'');
 const mock=`globalThis.fetch=async(url,options={})=>{const method=options.method||'GET';if(method!=='GET')return {ok:true,status:204,json:async()=>({})};if(url.endsWith('/collaborators/reviewer/permission'))return {ok:true,status:200,json:async()=>(${JSON.stringify({permission})})};if(url.endsWith('/issues/8'))return {ok:true,status:200,json:async()=>(${JSON.stringify(current)})};throw new Error('Unexpected API '+url);};await import(${JSON.stringify('file://'+join(dir,'scripts','review.mjs'))});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',mock],{env:{...process.env,GITHUB_REPOSITORY:'example/knowledge',GITHUB_TOKEN:'test-only',GITHUB_EVENT_PATH:join(dir,'event.json'),GITHUB_OUTPUT:join(dir,'output.txt')},encoding:'utf8'});
 return {dir,result,output:await readFile(join(dir,'output.txt'),'utf8')};
}
test('实际审核脚本：只读用户无法生成快照',async t=>{const {dir,result}=await runReview(t,{permission:'read'});assert.notEqual(result.status,0);await assert.rejects(readFile(join(dir,'data/approved/issue-8.json')));});
test('实际审核脚本：合法审核生成快照',async t=>{const {dir,result,output}=await runReview(t);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(await readFile(join(dir,'data/approved/issue-8.json'),'utf8')).reviewer,'reviewer');assert.equal(output,'changed=true\n');});
test('实际审核脚本：审核期间发生修改时拒绝新内容',async t=>{const {dir,result}=await runReview(t,{current:{...issue,body:body+'\n发生修改'}});assert.notEqual(result.status,0);await assert.rejects(readFile(join(dir,'data/approved/issue-8.json')));});
test('实际审核脚本：编辑保留上次通过版本',async t=>{const old={...snapshot(issue,'old-reviewer'),issueNumber:8};const {dir,result,output}=await runReview(t,{action:'edited',approved:[old]});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(await readFile(join(dir,'data/approved/issue-8.json'),'utf8')).reviewer,'old-reviewer');assert.equal(output,'changed=false\n');});
test('实际审核脚本：撤回案例时同时撤回关联补充',async t=>{const old={...snapshot(issue,'reviewer'),issueNumber:8};const a={id:'GH-9',kind:'addition',issueNumber:9,targetId:'GH-8'};const {dir,result,output}=await runReview(t,{label:'kb-withdrawn',current:{...issue,labels:[{name:'kb-withdrawn'}]},approved:[old,a]});assert.equal(result.status,0,result.stderr);assert.equal(output,'changed=true\n');await assert.rejects(readFile(join(dir,'data/approved/issue-8.json')));await assert.rejects(readFile(join(dir,'data/approved/issue-9.json')));});
test('撤回尚未发布的Issue不会删除其他案例',async t=>{const other={...snapshot({...issue,number:10},'reviewer'),issueNumber:10};const {dir,result,output}=await runReview(t,{label:'kb-withdrawn',current:{...issue,labels:[{name:'kb-withdrawn'}]},approved:[other]});assert.equal(result.status,0,result.stderr);assert.equal(output,'changed=false\n');assert.equal(JSON.parse(await readFile(join(dir,'data/approved/issue-10.json'),'utf8')).id,'GH-10');});
