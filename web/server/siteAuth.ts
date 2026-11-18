import crypto from "node:crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SITE_SESSION_COOKIE = "qingban_session";

function equalSecret(left: string, right: string): boolean {
  const leftHash = crypto.createHash("sha256").update(left).digest();
  const rightHash = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export function validBasicAuthorization(
  authorization: string | undefined,
  expectedUsername: string,
  expectedPassword: string,
): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      equalSecret(decoded.slice(0, separator), expectedUsername) &&
      equalSecret(decoded.slice(separator + 1), expectedPassword)
    );
  } catch {
    return false;
  }
}

export function validCredentials(
  username: unknown,
  password: unknown,
  expectedUsername: string,
  expectedPassword: string,
): boolean {
  return (
    typeof username === "string" &&
    typeof password === "string" &&
    equalSecret(username, expectedUsername) &&
    equalSecret(password, expectedPassword)
  );
}

function signSession(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSiteSession(username: string, secret: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(`${username}:${expiresAt}`, "utf8").toString("base64url");
  return `${payload}.${signSession(payload, secret)}`;
}

export function validSiteSession(
  session: string | undefined,
  expectedUsername: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!session) return false;
  const separator = session.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = session.slice(0, separator);
  const signature = session.slice(separator + 1);
  if (!equalSecret(signature, signSession(payload, secret))) return false;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const payloadSeparator = decoded.lastIndexOf(":");
    if (payloadSeparator < 1) return false;
    const username = decoded.slice(0, payloadSeparator);
    const expiresAt = Number(decoded.slice(payloadSeparator + 1));
    return equalSecret(username, expectedUsername) && Number.isFinite(expiresAt) && expiresAt > now / 1000;
  } catch {
    return false;
  }
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function loginPage(errorMessage = ""): string {
  const error = errorMessage
    ? `<p class="error" role="alert">${errorMessage}</p>`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>轻伴有数 · 登录</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f6f1;color:#15231b;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;padding:24px}
    main{width:min(100%,390px);background:#fff;border:1px solid #dce8de;border-radius:28px;padding:34px;box-shadow:0 20px 60px rgba(35,83,53,.12)}
    .brand{color:#2f7d4f;font-weight:800;letter-spacing:.12em;margin:0 0 10px}h1{font-size:28px;margin:0 0 8px}p{color:#6c7a70;margin:0 0 26px;line-height:1.6}
    label{display:block;font-weight:700;margin:16px 0 8px}input{width:100%;height:50px;border:1px solid #cddbd0;border-radius:14px;padding:0 15px;font-size:16px;outline:none}input:focus{border-color:#2f7d4f;box-shadow:0 0 0 3px rgba(47,125,79,.12)}
    button{width:100%;height:52px;margin-top:24px;border:0;border-radius:16px;background:#2f7d4f;color:#fff;font-size:17px;font-weight:800;cursor:pointer}.error{color:#a33b2b;background:#fff1ee;border-radius:12px;padding:10px 12px;margin:0 0 16px}
  </style>
</head>
<body><main><p class="brand">轻伴有数</p><h1>欢迎回来</h1><p>输入访问账号和密码，继续查看记录与训练。</p>${error}<form method="post" action="auth/login"><label for="username">账号</label><input id="username" name="username" autocomplete="username" required /><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="current-password" required /><button type="submit">进入轻伴有数</button></form></main></body>
</html>`;
}
