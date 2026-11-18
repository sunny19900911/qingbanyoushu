import type { Express } from 'express';
import { z } from 'zod';
import { accountLoginEnabled,currentAccount } from './accounts.js';
import { loadAllEntries } from './vaultRepository.js';
import { analyze,summarize } from './knowledgeAnalysis.js';
import { recordRange } from './analysisRange.js';

export function installKnowledgeRoutes(app:Express) {
  const busy=new Set<string>();
  app.post('/api/knowledge/analyze',async(req,res)=>{
    if(!accountLoginEnabled){res.status(403).json({error:'请使用独立账号测试版，本功能不接受旧版共享身份。'});return;}
    const user=await currentAccount(req);
    if(!user){res.status(401).json({error:'请先登录'});return;}
    const input=z.object({query:z.string().trim().min(2).max(600),mode:z.enum(['knowledge','records']),days:z.number().int().min(1).max(365),anchor:z.enum(['today','latest']).default('today'),generate:z.boolean()}).strict().safeParse(req.body);
    if(!input.success){res.status(400).json({error:'请输入有效的问题与分析范围，不接受指定其他用户。'});return;}
    if(busy.has(user.userId)){res.status(429).json({error:'上一项分析尚未完成，请稍后。'});return;}
    busy.add(user.userId);
    try {
      const end=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
      const entries=input.data.mode==='records'?await loadAllEntries(user.userId):[];
      const range=recordRange(entries,user.userId,input.data.query,input.data.days,input.data.anchor,end);
      const summary=input.data.mode==='records'?summarize(entries,user.userId,range.days,range.end):null;
      if(summary && !summary.recordedDays){res.json({answer:range.ownDays?`所选日期内没有记录。本人历史记录为 ${range.availableFrom} 至 ${range.availableTo}，共 ${range.ownDays} 天。可点击“按最后记录日分析”，查看历史阶段。`:range.inheritedDays?`当前账号只有 ${range.inheritedDays} 天继承样例，没有本人记录。继承样例不能作为本人的身体数据。`:'当前账号没有本人记录。公共知识库提供方法依据，不包含这个账号的饮食和体重档案。',generated:false,summary,range,sources:[],warnings:[],notice:'历史日期和继承样例已明确区分。'});return;}
      res.json({...await analyze(input.data.query,summary,input.data.generate),range:summary?range:null});
    } catch {res.status(503).json({error:'暂时无法完成分析，请稍后重试。'});}
    finally {busy.delete(user.userId);}
  });
}
