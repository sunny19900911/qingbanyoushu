import { useState } from "react";
import { ArrowRight, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import type { AccountSession } from "../../shared/types";
import { api } from "../api";

export function LoginPage({ onLogin }: { onLogin: (session: AccountSession) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [alias, setAlias] = useState("");
  const [inherit, setInherit] = useState(true);
  const [testCode, setTestCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const perform = async (task: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "暂时无法登录"); }
    finally { setBusy(false); }
  };
  return <main className="account-login">
    <section className="account-login-intro"><span className="login-brand">轻伴有数</span><h1>有人一起，<br />慢慢变好。</h1><p>每天说一句，留下自己的记录。<br />训练、变化和教练的提醒，都在这里。</p><div><ShieldCheck size={18} />每个人都有自己的档案</div></section>
    <section className="account-login-card">
      <span className="test-mode-tag">本地测试版</span><h2>欢迎回来</h2><p>先用熟悉的身份看一看</p>
      <div className="test-identity-buttons">
        <button disabled={busy} onClick={() => void perform(async () => onLogin(await api.testLogin("USR-SELF-001")))}><strong>YC</strong><span>主教练 · 管理学员与训练</span><ArrowRight /></button>
        <button disabled={busy} onClick={() => void perform(async () => onLogin(await api.testLogin("USR-DEMO-001")))}><strong>示例学员</strong><span>学员 · 查看自己的记录</span><ArrowRight /></button>
      </div>
      <div className="login-divider">体验新账号</div>
      <form onSubmit={e => { e.preventDefault(); void perform(async () => onLogin(await api.phoneLogin(phone, code, alias, inherit))); }}>
        <label>手机号<input aria-label="手机号" autoComplete="tel" type="tel" inputMode="tel" maxLength={11} value={phone} onChange={e => { setPhone(e.target.value); setTestCode(""); setCode(""); }} placeholder="可使用 10000000000 等测试号码" required /></label>
        <label>验证码<div className="login-code-row"><input aria-label="验证码" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} placeholder="6 位验证码" required /><button type="button" disabled={busy || !/^1[3-9]\d{9}$/.test(phone)} onClick={() => void perform(async () => { const r = await api.loginCode(phone); setTestCode(r.testCode); })}>获取测试码</button></div></label>
        {testCode ? <p className="test-code" role="status">本地测试码：<strong>{testCode}</strong>（5 分钟内有效，未发送短信）</p> : null}
        <label>怎么称呼你<input aria-label="昵称" value={alias} maxLength={20} onChange={e => setAlias(e.target.value)} placeholder="新账号首次登录时填写" /></label>
        <label className="inherit-option"><input type="checkbox" checked={inherit} onChange={e => setInherit(e.target.checked)} />新账号复制示例学员历史记录</label>
        <small>复制后分别存档，不影响示例学员。仅首次创建时生效。</small>
        <button className="primary-button" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" /> : <ArrowRight />}登录并进入</button>
      </form>
      <button className="wechat-login-placeholder" disabled><MessageCircle size={18} />微信一键登录 · 待接入</button>
      <p className="login-test-note">这里用于体验登录流程。真实短信与微信授权尚未接通。</p>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
    </section>
  </main>;
}
