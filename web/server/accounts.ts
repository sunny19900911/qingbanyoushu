import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Express, Request } from "express";
import type { AppUser, CoachFeedbackHistoryItem, DailyEntry, UserId } from "../shared/types.js";
import { PROJECT_ROOT } from "./config.js";
import { readCookie } from "./siteAuth.js";

const directory = process.env.ACCOUNT_STORE_DIR || path.join(PROJECT_ROOT, "runtime", "accounts");
interface StoredAccount extends AppUser { phoneHash?: string; disabled?: boolean }
const seeds: StoredAccount[] = [
  { userId: "USR-SELF-001", displayAlias: "YC", dataCutoff: null, role: "coach" },
  { userId: "USR-DEMO-001", displayAlias: "示例学员", dataCutoff: null, role: "learner" },
];
export const accountLoginEnabled = process.env.NODE_ENV !== "production" && process.env.ACCOUNT_TEST_LOGIN === "1";
let writing = Promise.resolve();
async function allAccounts(): Promise<StoredAccount[]> {
  try { return JSON.parse(await readFile(path.join(directory, "accounts.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return seeds; throw error; }
}
async function mutate(change: (accounts: StoredAccount[]) => void) {
  const task = writing.then(async () => {
    const accounts = await allAccounts();
    change(accounts);
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, "accounts.json");
    await writeFile(`${target}.tmp`, JSON.stringify(accounts, null, 2));
    await rename(`${target}.tmp`, target);
  });
  writing = task.catch(() => {});
  return task;
}
function publicAccount(account: StoredAccount): AppUser {
  return { userId: account.userId, displayAlias: account.displayAlias, role: account.role,
    dataCutoff: account.dataCutoff, ...(account.inheritedFrom ? { inheritedFrom: account.inheritedFrom } : {}) };
}
export async function accountUsers(): Promise<AppUser[]> {
  return (await allAccounts()).filter(a => !a.disabled).map(publicAccount);
}
export async function accountUser(id: string): Promise<AppUser | undefined> {
  return (await accountUsers()).find(a => a.userId === id);
}
export async function disableAccount(id: UserId) {
  if (id === "USR-SELF-001") throw new Error("不能移除主教练");
  await mutate(accounts => { const user = accounts.find(a => a.userId === id); if (!user) throw new Error("账号不存在"); user.disabled = true; });
}
export async function saveInheritedHistory(id: UserId, entries: DailyEntry[], feedback: CoachFeedbackHistoryItem[]) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.history.json`), JSON.stringify({
    entries: entries.map(e => ({ ...e, userId: id, entryId: `${id}:${e.entryId}`, contextTags: [...e.contextTags, "继承示例学员历史（测试样例）"] })),
    feedback: feedback.map(f => ({ ...f, userId: id, feedbackId: `${id}:${f.feedbackId}`, verificationStatus: "inherited-test-example" })),
  }));
}
export async function inheritedHistory(id: UserId): Promise<{ entries: DailyEntry[]; feedback: CoachFeedbackHistoryItem[] }> {
  if (!/^USR-APP-[a-f0-9-]{36}$/.test(id)) return { entries: [], feedback: [] };
  try { return JSON.parse(await readFile(path.join(directory, `${id}.history.json`), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: [], feedback: [] }; throw error; }
}

const sessions = new Map<string, { id: UserId; expires: number }>();
const codes = new Map<string, { code: string; expires: number; attempts: number; sentAt: number }>();
const phoneHash = (phone: string) => crypto.createHash("sha256").update(`local-test:${phone}`).digest("hex");
export async function currentAccount(request: Request) {
  const token = readCookie(request.headers.cookie, "health_account");
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expires < Date.now()) { if (token) sessions.delete(token); return undefined; }
  return accountUser(session.id);
}
export function installAccountAuth(app: Express, inherit: (id: UserId) => Promise<void>) {
  app.use("/api", (request, response, next) => {
    if (accountLoginEnabled && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress || "")) {
      response.status(403).json({ error: "测试登录仅限本机访问" }); return;
    }
    if (accountLoginEnabled && request.method !== "GET" && request.headers.origin && request.headers.origin !== `${request.protocol}://${request.get("host")}`) {
      response.status(403).json({ error: "请求来源不匹配" }); return;
    }
    next();
  });
  app.get("/api/auth/session", async (request, response) => {
    response.json({ enabled: accountLoginEnabled, mode: accountLoginEnabled ? "local-test" : "legacy", user: accountLoginEnabled ? (await currentAccount(request) ?? null) : null });
  });
  app.use("/api/auth", (_request, response, next) => {
    if (!accountLoginEnabled) { response.status(503).json({ error: "本地测试登录未启用；真实短信和微信登录尚未配置" }); return; }
    next();
  });
  const login = (response: import("express").Response, user: AppUser) => {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { id: user.userId, expires: Date.now() + 7 * 86400000 });
    response.cookie("health_account", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400000, path: "/" });
    response.json({ enabled: true, mode: "local-test", user });
  };
  app.post("/api/auth/test-login", async (request, response) => {
    if (!["USR-SELF-001", "USR-DEMO-001"].includes(request.body?.userId)) { response.status(400).json({ error: "请选择一个测试身份" }); return; }
    const user = await accountUser(request.body.userId);
    if (!user) { response.status(403).json({ error: "此账号已移除" }); return; }
    login(response, user);
  });
  app.post("/api/auth/code", (request, response) => {
    const phone = String(request.body?.phone || "");
    if (!/^1[3-9]\d{9}$/.test(phone)) { response.status(400).json({ error: "请输入 11 位手机号，可用测试号码" }); return; }
    const key = phoneHash(phone), previous = codes.get(key);
    if (previous && Date.now() - previous.sentAt < 60000) { response.status(429).json({ error: "请一分钟后再获取" }); return; }
    const code = String(crypto.randomInt(100000, 1000000));
    codes.set(key, { code, expires: Date.now() + 300000, attempts: 0, sentAt: Date.now() });
    response.json({ testCode: code, expiresIn: 300, message: "本地测试验证码，不发送短信" });
  });
  app.post("/api/auth/phone", async (request, response) => {
    const phone = String(request.body?.phone || ""), key = phoneHash(phone), challenge = codes.get(key);
    if (!/^1[3-9]\d{9}$/.test(phone) || !challenge || challenge.expires < Date.now() || challenge.attempts >= 5) {
      response.status(400).json({ error: "验证码已过期，请重新获取" }); return;
    }
    challenge.attempts++;
    if (String(request.body?.code) !== challenge.code) { response.status(400).json({ error: "验证码不正确" }); return; }
    codes.delete(key);
    let user = (await allAccounts()).find(a => a.phoneHash === key);
    if (user?.disabled) { response.status(403).json({ error: "此账号已由主教练移除" }); return; }
    if (!user) {
      const alias = String(request.body?.displayAlias || "新学员").trim().slice(0, 20) || "新学员";
      const id: UserId = `USR-APP-${crypto.randomUUID()}`;
      const inherited = request.body?.inheritHistory === true;
      if (inherited) await inherit(id);
      user = { userId: id, displayAlias: alias, role: "learner", dataCutoff: null, phoneHash: key, ...(inherited ? { inheritedFrom: "USR-DEMO-001" as const } : {}) };
      const created = user;
      await mutate(accounts => { accounts.push(created); });
    }
    login(response, publicAccount(user));
  });
  app.post("/api/auth/logout", (request, response) => {
    const token = readCookie(request.headers.cookie, "health_account");
    if (token) sessions.delete(token);
    response.clearCookie("health_account", { path: "/" }); response.json({ ok: true });
  });
  app.use("/api", async (request, response, next) => {
    if (!accountLoginEnabled) { next(); return; }
    const user = await currentAccount(request);
    if (!user) { response.status(401).json({ error: "请先登录" }); return; }
    if (request.path.startsWith("/coach/") && user.role !== "coach") { response.status(403).json({ error: "仅主教练可以操作" }); return; }
    const target = request.path.match(/^\/users\/([^/]+)/)?.[1] || request.body?.userId;
    if (target && !(await accountUser(target))) { response.status(404).json({ error: "账号不存在或已移除" }); return; }
    if (target && target !== user.userId && user.role !== "coach") { response.status(403).json({ error: "只能访问自己的档案" }); return; }
    next();
  });
}
