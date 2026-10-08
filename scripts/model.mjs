import {createHash} from 'node:crypto';
export const labels={approved:'kb-approved',pending:'kb-pending',withdrawn:'kb-withdrawn'};
export const fields={kind:'记录类型',title:'案例标题',targetId:'关联案例编号',category:'故障类别',device:'设备系统',scope:'机房与影响范围',occurred:'发生时间',symptom:'故障现象与告警',analysis:'排查过程',cause:'根因分析',steps:'处理措施',validation:'恢复验证',prevention:'改进与预防',tags:'关键词',content:'补充内容'};
export const categoryOptions=['链路中断','设备故障','配置变更','动力电源','割接施工','外线','系统平台','用户侧','其他'];
export function bodyHash(issue){return createHash('sha256').update(JSON.stringify({title:issue.title,body:issue.body})).digest('hex');}
export function parseForm(body){
 if(typeof body!=='string'||body.length>60000)throw new Error('表单为空或过长');
 const headings=[...body.matchAll(/^### ([^\r\n]+)\r?$/gm)].filter(m=>Object.values(fields).includes(m[1].trim())),out={};
 for(let i=0;i<headings.length;i++){const m=headings[i],title=m[1].trim();if(Object.hasOwn(out,title))throw new Error('重复字段：'+title);const value=body.slice(m.index+m[0].length,headings[i+1]?.index??body.length).trim();out[title]=value==='_No response_'?'':value;}
 return Object.fromEntries(Object.entries(fields).map(([k,label])=>[k,out[label]||'']));
}
export function snapshot(issue,reviewer,now=new Date().toISOString()){
 if(!Number.isSafeInteger(issue.number)||issue.number<1||!issue.user?.login)throw new Error('Issue身份不完整');
 const r=parseForm(issue.body);const kind={'故障案例':'case','复盘经验':'experience','案例补充':'addition'}[r.kind];
 if(!kind)throw new Error('请选择有效的记录类型');
 const required=kind==='addition'?['targetId','content']:['title','category','device','symptom','steps'];
 for(const k of required)if(!r[k].trim())throw new Error('缺少必填字段：'+fields[k]);
 for(const [k,v] of Object.entries(r))if(v.length>12000)throw new Error('字段过长：'+fields[k]);
 if(kind!=='addition'&&!categoryOptions.includes(r.category))throw new Error('故障类别不在选项内');
 if(kind==='addition'&&!/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(r.targetId))throw new Error('关联编号格式错误');
 return {schemaVersion:1,id:'GH-'+issue.number,...r,kind,originalId:'Issue #'+issue.number,status:'已审核',flags:[],source:'GitHub审核发布',handler:issue.user.login,author:issue.user.login,createdAt:issue.created_at,issueNumber:issue.number,issueUrl:issue.html_url,reviewer,reviewedAt:now,approvedHash:bodyHash(issue),typical:kind==='experience',restored:'',business:'',model:'',version:'',links:''};
}
export function mayReview(permission){return ['admin','maintain','write'].includes(permission);}
export function unchanged(eventIssue,currentIssue){return bodyHash(eventIssue)===bodyHash(currentIssue);}
export function combine(history,approved){
 const entries=[...history,...approved.filter(r=>r.kind!=='addition')].map(r=>({...r,additions:[]}));
 const ids=new Map();for(const r of entries){if(ids.has(r.id))throw new Error('重复编号：'+r.id);ids.set(r.id,r);}
 for(const a of approved.filter(r=>r.kind==='addition')){const parent=ids.get(a.targetId);if(!parent)throw new Error('补充 '+a.id+' 的目标不存在：'+a.targetId);parent.additions.push(a);}
 return entries;
}
