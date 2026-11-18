import { randomUUID } from 'node:crypto';

/** Bounded in-memory prototype: health records never enter this queue. */
export class RetrievalQueue<T> {
 private jobs=new Map<string,{query:string;deadline:number;lease?:string;leaseUntil:number;resolve:(value:T)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private timeoutMs=60000,private leaseMs=25000){}
 submit(query:string):Promise<T>{
  if(this.jobs.size>=32)return Promise.reject(new Error('查询队列已满'));
  const id=randomUUID();
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.jobs.delete(id);reject(new Error('知识连接超时'));},this.timeoutMs);
   this.jobs.set(id,{query,deadline:Date.now()+this.timeoutMs,leaseUntil:0,resolve,reject,timer});
  });
 }
 claim(){
  for(const [id,j] of this.jobs){if(j.deadline>Date.now()&&j.leaseUntil<=Date.now()){
   j.lease=randomUUID();j.leaseUntil=Date.now()+this.leaseMs;return {id,lease:j.lease,query:j.query};
  }}return null;
 }
 complete(id:string,lease:string,value:T){
  const j=this.jobs.get(id);if(!j||j.lease!==lease||j.leaseUntil<=Date.now()||j.deadline<=Date.now())return false;
  clearTimeout(j.timer);this.jobs.delete(id);j.resolve(value);return true;
 }
 close(){for(const j of this.jobs.values()){clearTimeout(j.timer);j.reject(new Error('连接服务停止'));}this.jobs.clear();}
}
