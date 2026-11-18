import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { RetrievalQueue } from './retrievalQueue.js';

export const KB='00000000000000000000000000000000';
export const resultSchema=z.object({sources:z.array(z.object({number:z.number().int().min(1).max(6),title:z.string().max(500),position:z.string().max(200),text:z.string().max(1800)})).max(6),warnings:z.array(z.string().max(500)).max(10)});
export type RetrievalResult=z.infer<typeof resultSchema>;
export const retrievalQueue=new RetrievalQueue<RetrievalResult>();
export function connectorRouter(token:string,queue=retrievalQueue){
 if(token.length<32)throw new Error('连接凭据长度不足');
 const router=express.Router();
 router.use((req,res,next)=>{const given=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);
  if(given.length!==expected.length||!timingSafeEqual(given,expected)){res.sendStatus(401);return;}next();});
 router.post('/claim',(_req,res)=>{res.json(queue.claim());});
 router.post('/complete',(req,res)=>{const body=z.object({id:z.string().uuid(),lease:z.string().uuid(),result:resultSchema}).strict().safeParse(req.body);
  if(!body.success){res.sendStatus(400);return;}
  res.sendStatus(queue.complete(body.data.id,body.data.lease,body.data.result)?200:409);});
 return router;
}

export async function retrieveDirect(query:string):Promise<RetrievalResult>{
 const response=await fetch('http://127.0.0.1:8765/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,kb_id:KB,mode:'hybrid',top_k:6}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('本地知识服务不可用');
 const body=z.object({results:z.array(z.object({kb_id:z.literal(KB),name:z.string(),content:z.string(),position:z.string()})),warnings:z.array(z.string())}).parse(await response.json());
 return resultSchema.parse({sources:body.results.map((s,i)=>({number:i+1,title:s.name,position:s.position,text:s.content.slice(0,1800)})),warnings:body.warnings});
}

export async function workerOnce(base:string,token:string){
 const url=new URL(base);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new Error('连接地址需要HTTPS');
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
 const claim=await fetch(base+'/connector/claim',{method:'POST',headers,signal:AbortSignal.timeout(5000)});if(!claim.ok)throw new Error('领取任务失败');
 const body=await claim.json();if(body===null)return false;
 const job=z.object({id:z.string().uuid(),lease:z.string().uuid(),query:z.string().min(2).max(600)}).parse(body);
 const result=await retrieveDirect(job.query);
 const done=await fetch(base+'/connector/complete',{method:'POST',headers,body:JSON.stringify({id:job.id,lease:job.lease,result}),signal:AbortSignal.timeout(5000)});
 if(!done.ok)throw new Error('任务已过期或提交失败');return true;
}
