import { useEffect, useState } from "react";
import type { AccountSession, AppUser, RuntimeConfig, UserId } from "../shared/types";
import { LoginPage } from "./pages/LoginPage";
import { api } from "./api";
import { appUrl } from "./appUrl";
import { BottomNav, type AppView } from "./components/BottomNav";
import { RecordPage } from "./pages/RecordPage";
import { TrainingCoachPage } from "./pages/TrainingCoachPage";
import { TrendPage } from "./pages/TrendPage";
import { InBodyReportPage } from "./pages/InBodyReportPage";
import { KnowledgePage } from './pages/KnowledgePage';

const FALLBACK_USERS: AppUser[] = [
  { userId: "USR-SELF-001", displayAlias: "YC", dataCutoff: null },
  { userId: "USR-DEMO-001", displayAlias: "示例学员", dataCutoff: null },
];

export default function App() {
  const coachMode = new URLSearchParams(window.location.search).get("coach") === "1";
  const [view, setView] = useState<AppView>(() => (coachMode ? "training" : "record"));
  const [users, setUsers] = useState<AppUser[]>(FALLBACK_USERS);
  const [userId, setUserId] = useState<UserId>("USR-SELF-001");
  const [refreshToken, setRefreshToken] = useState(0);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => { api.session().then(s => { setSession(s); if (s.user) setUserId(s.user.userId); }).catch(() => setSessionError("暂时连不上本地服务，请刷新重试。")); }, []);

  useEffect(() => {
    if (!session || (session.enabled && !session.user)) return;
    let cancelled = false;
    Promise.all([api.users(), api.config()])
      .then(([nextUsers, nextConfig]) => {
        if (cancelled) return;
        setUsers(nextUsers);
        setConfig(nextConfig);
      })
      .catch(() => { if (!cancelled) setConfig({ vaultConnected: false, deepSeekEnabled: false, demoMode: true }); });
    return () => { cancelled = true; };
  }, [session, refreshToken]);

  if (sessionError) return <main className="account-login"><p role="alert">{sessionError}</p><button onClick={() => window.location.reload()}>重新连接</button></main>;
  if (!session) return <div className="page-loading">正在打开你的档案…</div>;
  if (session.enabled && !session.user) return <LoginPage onLogin={s => { setSession(s); setUsers(s.user ? [s.user] : []); setUserId(s.user!.userId); setView(s.user?.role === "coach" ? "training" : "record"); }} />;
  if (window.location.pathname === appUrl("inbody")) return <InBodyReportPage />;

  const active = users.find(u => u.userId === userId);

  return (
    <main className="app-shell">
      {session.enabled ? <div className="account-session-bar"><span>{session.user?.displayAlias} · {session.user?.role === "coach" ? "主教练" : "学员"}</span><button onClick={() => { void api.logout().then(() => { window.speechSynthesis?.cancel(); setSession({ ...session, user: null }); setUsers([]); setConfig(null); }); }}>退出登录</button></div> : null}
      {active?.inheritedFrom ? <p className="inherited-history-note">含复制自示例学员的历史样例；你新增的记录单独存档。</p> : null}
      <div className="app-content" key={`${userId}-${view}`}>
        {view === 'knowledge' ? <KnowledgePage /> : null}
        {view === "record" ? (
          <RecordPage
            users={users}
            userId={userId}
            onUserChange={setUserId}
            modelEnabled={config?.deepSeekEnabled ?? false}
            onSaved={() => setRefreshToken((value) => value + 1)}
          />
        ) : null}
        {view === "trend" ? (
          <TrendPage
            users={users}
            userId={userId}
            onUserChange={setUserId}
            refreshToken={refreshToken}
          />
        ) : null}
        {view === "training" ? (
          <TrainingCoachPage users={users} userId={userId} onUserChange={setUserId} isCoach={session.enabled ? session.user?.role === "coach" : userId === "USR-SELF-001"} accountManagement={session.enabled} onAccountsChanged={() => { setUserId(session.user?.userId || "USR-SELF-001"); setRefreshToken(v => v + 1); }} />
        ) : null}
      </div>
      <BottomNav active={view} onChange={setView} />
    </main>
  );
}
