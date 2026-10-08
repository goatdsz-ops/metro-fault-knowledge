'use strict';
const DATA=JSON.parse(document.getElementById('knowledge-data').textContent);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={kind:'case',query:'',category:'',device:'',scope:'',page:1,approvedOnly:false,selected:null};
const records=DATA.records.map(r=>({...r,additions:r.additions||[]}));
let repository=DATA.config.repository||'';try{if(!repository)repository=localStorage.getItem('metro-github-repository')||'';}catch{}
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))repository='';
let lastDraft=null,lastMarkdown='',toastTimer;
const categories=['链路中断','设备故障','配置变更','动力电源','割接施工','外线','系统平台','用户侧','其他'];
const fieldNames={kind:'记录类型',title:'案例标题',targetId:'关联案例编号',category:'故障类别',device:'设备系统',scope:'机房与影响范围',occurred:'发生时间',symptom:'故障现象与告警',analysis:'排查过程',cause:'根因分析',steps:'处理措施',validation:'恢复验证',prevention:'改进与预防',tags:'关键词',content:'补充内容'};
const aliases=[['光猫','onu'],['掉线','离线','断网'],['cr','路由器(cr)'],['olt','ftth olt']];
const searchText=new Map(records.map(r=>[r.id,Object.values(r).flat().map(v=>typeof v==='object'?JSON.stringify(v):v).join(' ').toLowerCase()]));
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function pill(text,style=''){return el('span',text,'pill '+style);}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function show(id){const d=document.getElementById(id);if(!d.open)d.showModal();}
function close(id){document.getElementById(id).close();}
function download(text,name,type='text/plain'){const u=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function github(path,query){if(!repository){show('repo-dialog');return false;}const u=new URL(`https://github.com/${repository}${path}`);for(const [k,v] of Object.entries(query||{}))if(v)u.searchParams.set(k,v);window.open(u.href,'_blank','noopener,noreferrer');return true;}
function updateRepo(){ $('#repo-button').textContent=repository?repository+' ↗':'连接仓库 ↗';$('#repo-input').value=repository; }
function filtered(){
 const terms=state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return records.filter(r=>r.kind===state.kind&&(!state.category||r.category===state.category)&&(!state.device||r.device===state.device)&&(!state.scope||(r.scope||'').toLowerCase().includes(state.scope.toLowerCase()))&&(!state.approvedOnly||r.status==='已审核')).map(r=>{const full=searchText.get(r.id);let score=0;for(const t of terms){const options=aliases.find(a=>a.includes(t))||[t];if(!options.some(w=>full.includes(w)))return {r,score:-1};score+=(r.title||'').toLowerCase().includes(t)?10:1;if((r.tags||'').toLowerCase().includes(t))score+=4;}return {r,score};}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||String(b.r.occurred||b.r.createdAt).localeCompare(String(a.r.occurred||a.r.createdAt))).map(x=>x.r);
}
function reset(){state.query='';state.category='';state.device='';state.scope='';state.approvedOnly=false;state.page=1;$('#search').value='';$('#category').value='';$('#device').value='';$('#scope').value='';render();}
function setKind(kind){state.kind=kind;state.page=1;render();}
function render(){
 $$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.kind===state.kind)));
 const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/12));state.page=Math.min(state.page,pages);const start=(state.page-1)*12;
 $('#result-count').textContent=`${state.approvedOnly?'已审核 · ':''}${rows.length} 条结果`;
 $('#results-body').replaceChildren();$('#empty').hidden=rows.length>0;$('.table-scroll').hidden=!rows.length;
 for(const r of rows.slice(start,start+12)){
  const tr=el('tr'),titleCell=el('td'),button=el('button',undefined,'record-title');button.append(el('span',r.title),el('span','›'));button.addEventListener('click',()=>openDetail(r));
  const summary=el('p',(r.kind==='experience'?'定位思路：':'原记录根因：')+(r.analysis||r.cause||'未记录，待补充'),'record-summary');
  const meta=el('div',undefined,'record-meta');meta.append(el('span',r.originalId||r.id,'mono'));
  if(r.status==='已审核')meta.append(pill('已审核','pill-green'));
  else if(r.typical)meta.append(pill('典型','pill-green'));
  for(const f of (r.flags||[]).filter(f=>f!=='历史经验待审核').slice(0,2))meta.append(pill(f,'pill-amber'));
  if(r.additions.length)meta.append(el('span',r.additions.length+' 条已审核补充'));
  titleCell.append(button,summary,meta);const cat=el('td',undefined,'class-col');cat.append(pill(r.category,'pill-blue'),el('div',r.device||'通用经验','record-device'));
  const date=el('td',undefined,'time-col');date.append(el('span',r.occurred?.slice(0,10)||'—','record-date'),el('div',r.status||'待核实','record-status'));
  tr.append(titleCell,cat,date);$('#results-body').append(tr);
 }
 $('#range-label').textContent=rows.length?`显示 ${start+1}–${Math.min(start+12,rows.length)} 条，共 ${rows.length} 条`:'暂无匹配记录';
 $('#page-label').textContent=`${state.page} / ${pages}`;$('#prev').disabled=state.page===1;$('#next').disabled=state.page===pages;
}
function section(title,value){if(!value)return;const s=el('section',undefined,'detail-section');s.append(el('h3',title),el('p',value));$('#detail-sections').append(s);}
function openDetail(r){
 state.selected=r;$('#detail-id').textContent=`${r.kind==='experience'?'复盘经验':'故障案例'} / ${r.id}`;$('#detail-title').textContent=r.title;
 $('#detail-tags').replaceChildren(pill(r.category,'pill-blue'),pill(r.device||'通用经验'),pill(r.status||'待核实',r.status==='已审核'?'pill-green':'pill-amber'));
 $('#detail-notice').textContent=r.status==='已审核'?`由 ${r.reviewer} 审核，发布的是已确认的内容快照。请结合当前设备与现场条件使用。`:'历史记录或演示内容尚未逐条核实。请结合设备型号、版本和现场信息使用，不能仅凭相同现象认定根因。';
 $('#facts').replaceChildren();
 for(const [label,value] of [['发生时间',r.occurred],['恢复时间',r.restored],['影响范围',r.scope],['处理 / 提交人',r.handler||r.author],['原始编号',r.originalId],['数据来源',r.source],['审核时间',r.reviewedAt?.replace('T',' ').slice(0,16)]]){if(!value&&['审核时间','原始编号'].includes(label))continue;const d=el('div');d.append(el('dt',label),el('dd',value||'未记录'));$('#facts').append(d);}
 $('#detail-sections').replaceChildren();section('故障现象与告警',r.symptom);section('排查过程 / 定位思路',r.analysis);section('原记录根因',r.cause);section('处理措施 / 标准步骤',r.steps);section('恢复验证',r.validation);section('改进与预防',r.prevention);section('原始关联说明',r.links);
 if(r.tags){const s=el('section',undefined,'detail-section'),tags=el('div',undefined,'tag-row');for(const tag of r.tags.split(/[;；,，]/).filter(Boolean)){const b=el('button','#'+tag);b.onclick=()=>{reset();state.query=tag;$('#search').value=tag;render();close('detail-dialog');};tags.append(b);}s.append(tags);$('#detail-sections').append(s);}
 const related=records.filter(x=>x.id!==r.id&&((r.links||'').includes(x.id)||(x.links||'').includes(r.id)));
 $('#related-list').replaceChildren();$('#related-section').hidden=!related.length;for(const x of related.slice(0,15)){const b=el('button',x.id+' · '+x.title,'related-link');b.onclick=()=>openDetail(x);$('#related-list').append(b);}
 $('#addition-count').textContent=r.additions.length;$('#additions-list').replaceChildren();
 if(!r.additions.length)$('#additions-list').append(el('p','还没有已审核补充。可提交验证结果、遗漏步骤或纠错意见。','muted'));
 for(const a of r.additions){const art=el('article',undefined,'addition');art.append(el('small',`${a.author} 提交 · ${a.reviewer} 审核`),el('p',a.content));if(a.issueNumber){const b=el('button','查看原始Issue ↗','text-button');b.onclick=()=>github('/issues/'+a.issueNumber);art.append(b);}$('#additions-list').append(art);}
 if(r.issueNumber){const s=el('section',undefined,'detail-section'),b=el('button','查看GitHub原始记录 ↗','text-button');b.onclick=()=>github('/issues/'+r.issueNumber);s.append(b);$('#detail-sections').append(s);}
 try{history.replaceState(null,'','#'+encodeURIComponent(r.id));}catch{}show('detail-dialog');
}
function markdown(d){return Object.entries(fieldNames).filter(([k])=>Object.hasOwn(d,k)).map(([k,label])=>`### ${label}\n\n${d[k]||'_No response_'}\n`).join('\n');}
function startSubmit(){show('submit-dialog');}
function submitURL(d,addition=false){
 const q={template:addition?'addition.yml':'fault.yml',title:addition?'[案例补充] '+d.targetId:'[知识库] '+d.title};
 for(const [k,v] of Object.entries(d))if(!['kind','category'].includes(k))q[k==='title'?'caseTitle':k]=v;
 const approx=new URLSearchParams(q).toString().length;
 if(approx>6500){toast('内容较长，请先下载登记内容，再复制到GitHub表单。');return github('/issues/new',{template:q.template,title:q.title});}
 return github('/issues/new',q);
}
$('#search').addEventListener('input',e=>{state.query=e.target.value;state.page=1;render();});
for(const [id,key] of [['category','category'],['device','device'],['scope','scope']])$('#'+id).addEventListener(id==='scope'?'input':'change',e=>{state[key]=e.target.value;state.page=1;render();});
$$('[data-kind]').forEach(b=>b.onclick=()=>{state.approvedOnly=false;setKind(b.dataset.kind);});
$$('[data-query]').forEach(b=>b.onclick=()=>{reset();state.kind='case';state.query=b.dataset.query;$('#search').value=state.query;render();});
$$('[data-open]').forEach(b=>b.onclick=()=>show(b.dataset.open));$$('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const rect=d.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)d.close();}}));
$('#detail-dialog').addEventListener('close',()=>{try{history.replaceState(null,'',location.pathname+location.search);}catch{}});
$('#reset').onclick=reset;$('#empty-reset').onclick=reset;$('#prev').onclick=()=>{state.page--;render();};$('#next').onclick=()=>{state.page++;render();};
$('#approved-filter').onclick=()=>{reset();state.approvedOnly=true;render();};
$('#new-case').onclick=startSubmit;$('#contribute').onclick=startSubmit;
$('#review-queue').onclick=()=>github('/issues',{q:'is:issue is:open label:kb-pending'});
$('#add-to-case').onclick=()=>{if(!state.selected)return;$('#addition-target').value=state.selected.id;close('detail-dialog');show('addition-dialog');};
$('#repo-form').onsubmit=e=>{e.preventDefault();repository=$('#repo-input').value.trim();if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)){toast('请输入 用户名/仓库名');return;}try{localStorage.setItem('metro-github-repository',repository);}catch{}updateRepo();close('repo-dialog');toast('仓库入口已设置，尚未上传任何内容');};
$('#draft-form').onsubmit=e=>{e.preventDefault();lastDraft=Object.fromEntries(new FormData(e.currentTarget));lastMarkdown=markdown(lastDraft);$('#markdown-output').value=lastMarkdown;$('#output-note').textContent='尚未提交。前往GitHub后，请核对记录类型和故障类别，并点击正式提交按钮。未连接仓库时可下载登记内容。';$('#draft-output').hidden=false;$('#draft-output').scrollIntoView({behavior:'smooth',block:'nearest'});};
$('#download-draft').onclick=()=>{if(lastDraft)download(lastMarkdown,'故障登记草稿.md','text/markdown');};$('#go-github').onclick=()=>{if(lastDraft)submitURL(lastDraft);};
$('#addition-form').onsubmit=e=>{e.preventDefault();const d={kind:'案例补充',...Object.fromEntries(new FormData(e.currentTarget))};if(e.submitter?.value==='download')download(markdown(d),'案例补充-'+d.targetId+'.md','text/markdown');else submitURL(d,true);};
$('#export-results').onclick=()=>download(JSON.stringify({exportedAt:new Date().toISOString(),records:filtered()},null,2),'知识库检索结果.json','application/json');
for(const c of categories){const o=el('option',c);o.value=c;$('#category').append(o);$('#form-category').append(o.cloneNode(true));}
for(const d of [...new Set(records.map(r=>r.device).filter(Boolean))].sort()){const o=el('option',d);o.value=d;$('#device').append(o);}
const cases=records.filter(r=>r.kind==='case').length,exps=records.filter(r=>r.kind==='experience').length;
$('#case-count').textContent=cases;$('#experience-count').textContent=exps;$('#case-tab-count').textContent=cases;$('#experience-tab-count').textContent=exps;
$('#approved-count').textContent=records.filter(r=>r.status==='已审核').length+records.reduce((s,r)=>s+r.additions.length,0);
$('#mode-banner').textContent=DATA.config.preview?'本地预览 · 已载入原始历史记录，尚未发布到GitHub。表单可体验，正式提交需连接仓库。':DATA.config.demo?'演示站点 · 当前案例为虚构示例，用于预览功能。正式案例审核后会自动替换此演示集。':'知识库发布版本 · 新案例与补充通过GitHub审核后更新。';
const note=DATA.config.preview?`来源于上传的故障台账与复盘经验库，共 ${cases} 条案例、${exps} 篇经验。原编号和来源保留，历史内容仍待核实。`:DATA.config.demo?'当前仅展示虚构演示数据。内部历史资料未被打包到公开发布内容。':'展示已纳入的历史资料与GitHub审核快照，原始提交、审核人和修改历史可追溯。';
$('#source-note').textContent=note;$('#guide-data').textContent=note+' 原表提及的附件仅保留文字说明，附件本身未导入。';$('#build-date').textContent='构建于 '+DATA.builtAt.slice(0,10);
updateRepo();render();try{const id=decodeURIComponent(location.hash.slice(1)),record=records.find(r=>r.id===id);if(record)openDetail(record);}catch{}
