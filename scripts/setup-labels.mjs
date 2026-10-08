const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!repo||!token)throw new Error('缺少GitHub Actions身份');
for(const [name,color,description] of [['kb-pending','D4A34A','待审核；修改已发布内容后需要重新审核'],['kb-approved','248575','审核通过；保存当前内容快照并更新网站'],['kb-withdrawn','BE5363','撤回网站记录；Git历史仍保留']]){
 const r=await fetch(`https://api.github.com/repos/${repo}/labels`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({name,color,description})});
 if(!r.ok&&r.status!==422)throw new Error('标签初始化失败 '+r.status);
 console.log('Label ready: '+name);
}
