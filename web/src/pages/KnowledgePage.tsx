import { useState } from 'react';
import { appUrl } from '../appUrl';

interface Result {range?:{availableFrom:string|null;availableTo:string|null;ownDays:number};answer:string;generated:boolean;warnings:string[];notice:string;sources:{number:number;title:string;position:string;text:string}[];summary:null|{from:string;to:string;recordedDays:number;weightDays:number;weightChangeKg:number|null;dietDays:number;activityRecordedDays:number};}
export function KnowledgePage(){
  const [query,setQuery]=useState('怎样结合饮食和运动记录复盘体重变化？');
  const [mode,setMode]=useState('knowledge');const [days,setDays]=useState(7);const [generate,setGenerate]=useState(false);
  const [busy,setBusy]=useState(false);const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState('');
  const [reportQuery,setReportQuery]=useState('');
  const [anchor,setAnchor]=useState('today');
  async function submit(nextAnchor=anchor){setBusy(true);setError('');setResult(null);try{
    const r=await fetch(appUrl('/api/knowledge/analyze'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,mode,days,anchor:nextAnchor,generate})});
    const b=await r.json();if(!r.ok)throw new Error(b.error);setResult(b);setReportQuery(query);
  }catch(e){setError(e instanceof Error?e.message:'请求失败');}finally{setBusy(false);}}
  function download(){if(!result)return;const s=result.summary;const text=['# 轻伴有数分析报告',reportQuery,s?`${s.from} 至 ${s.to}：记录 ${s.recordedDays} 天，体重记录 ${s.weightDays} 天，首末体重差 ${s.weightChangeKg??'无法计算'} kg。`:'',result.answer,...result.warnings,'## 知识依据',...result.sources.map(x=>`### [${x.number}] ${x.title} · ${x.position}\n\n${x.text}`),result.notice].join('\n\n');const b=new Blob([text],{type:'text/markdown;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='轻伴有数-分析报告.md';a.click();URL.revokeObjectURL(u);}
  return <section className="knowledge-panel"><h1>知识与分析</h1><p>周博公共知识库 · 结合当前登录人的记录复盘</p>
    <label>分析内容<select disabled={busy} value={mode} onChange={e=>{setMode(e.target.value);setResult(null);}}><option value="knowledge">问知识库</option><option value="records">分析我的记录</option></select></label>
    {mode==='records'&&<><label>时间范围<select disabled={busy} value={days} onChange={e=>{setDays(Number(e.target.value));setResult(null);}}><option value={7}>7天</option><option value={30}>30天</option><option value={60}>60天</option><option value={90}>90天</option></select></label><label>截止日期<select disabled={busy} value={anchor} onChange={e=>{setAnchor(e.target.value);setResult(null);}}><option value="today">今天</option><option value="latest">本人最后记录日（历史复盘）</option></select></label><p className="knowledge-hint">问题中明确写“之前60天”等天数时，优先采用问题中的天数。历史复盘结果会显示实际起止日期。</p></>}
    <label>你的问题<textarea value={query} maxLength={600} disabled={busy} onChange={e=>setQuery(e.target.value)}/></label>
    <label><input type="checkbox" checked={generate} disabled={busy} onChange={e=>setGenerate(e.target.checked)}/> 使用 DeepSeek 生成建议</label>
    <p className="knowledge-hint">{mode==='knowledge'?'查询周博公共资料，不读取个人记录。':'仅分析当前登录账号的本人记录，继承样例不参与。'} 开启模型后，问题、相关片段{mode==='records'?'和必要的健康记录':''}会发送给 DeepSeek。</p>
    <button disabled={busy||query.trim().length<2} onClick={()=>void submit()}>{busy?'正在查询与分析…':'开始分析'}</button>
    {error&&<p role="alert">{error}</p>}
    {result&&<article aria-live="polite"><h2>{result.generated?'分析报告':mode==='knowledge'?'知识库检索结果':'记录统计与知识依据'}</h2>
      {!result.generated&&result.sources.length>0&&<p className="knowledge-hint">已找到 {result.sources.length} 条知识片段。{generate?'模型回答尚未生成，原因见下方提示。':'当前仅检索原文，勾选 DeepSeek 可尝试生成回答。'}</p>}
      {result.summary&&<p>{result.summary.from} 至 {result.summary.to}：记录 {result.summary.recordedDays} 天；体重记录 {result.summary.weightDays} 天；首末记录差 {result.summary.weightChangeKg===null?'不足两天，无法计算':`${result.summary.weightChangeKg} kg`}；饮食记录 {result.summary.dietDays} 天；活动记录 {result.summary.activityRecordedDays} 天。</p>}
      <p style={{whiteSpace:'pre-wrap'}}>{result.answer}</p>{result.warnings.map(w=><p role="status" key={w}>{w}</p>)}
      {result.summary?.recordedDays===0&&!!result.range?.ownDays&&<button disabled={busy} onClick={()=>{setAnchor('latest');void submit('latest');}}>按最后记录日分析</button>}
      {result.sources.map(s=><details key={s.number}><summary>[{s.number}] {s.title.split('/').at(-1)?.replace(/\.md$/,'')} · {s.position}</summary><p style={{whiteSpace:'pre-wrap'}}>{s.text}</p></details>)}
      <p>{result.notice}</p><button onClick={download}>下载报告（Markdown）</button>
    </article>}
  </section>;
}

