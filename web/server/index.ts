import "dotenv/config";
import { installKnowledgeRoutes } from './knowledgeRoutes.js';
import { connectorRouter } from './knowledgeTransport.js';
import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { z } from "zod";
import type {
  ActionAcceptance,
  CoachDashboard,
  CoachReply,
  DailyEntry,
  ParsedEntryPreview,
  ReviewQuestion,
  TrainingAssignment,
  UserId,
} from "../shared/types.js";
import { EXERCISES, EXERCISE_CATEGORIES, getExercise } from "../shared/exercises.js";
import { PROJECT_ROOT, isUserId } from "./config.js";
import { deepSeekEnabled, generateDailyFeedback, parseDailyInput } from "./deepseek.js";
import {
  appendActionAcceptance,
  appendCoachReply,
  appendPrototypeEntry,
  appendReviewQuestion,
  appendTrainingAssignment,
  readActionAcceptances,
  readCoachReplies,
  readReviewQuestions,
  readTrainingAssignments,
} from "./prototypeStore.js";
import {
  getRecords,
  getReview,
  getCoachFeedbackHistory,
  listUsers,
  loadKnowledgeCards,
  vaultConnected,
} from "./vaultRepository.js";
import { generateWellnessReport, type ReportPeriod } from "./reportGenerator.js";
import { getInBodyTrendReport } from "./inbodyRepository.js";
import { accountLoginEnabled, accountUser, currentAccount, disableAccount, installAccountAuth, saveInheritedHistory } from "./accounts.js";
import { loadAllEntries } from "./vaultRepository.js";
import {
  createSiteSession,
  loginPage,
  readCookie,
  SITE_SESSION_COOKIE,
  validBasicAuthorization,
  validCredentials,
  validSiteSession,
} from "./siteAuth.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "8kb" }));
if(process.env.KNOWLEDGE_TRANSPORT==='queue') {
  app.use('/connector',connectorRouter(process.env.KNOWLEDGE_CONNECTOR_TOKEN||''));
}

const sitePassword = process.env.SITE_PASSWORD?.trim() ?? "";
const siteUsername = process.env.SITE_USERNAME?.trim() || "viewer";

if (sitePassword) {
  app.post("/auth/login", (request, response) => {
    if (!validCredentials(request.body?.username, request.body?.password, siteUsername, sitePassword)) {
      response.status(401).type("html").send(loginPage("账号或密码不正确，请重新输入。"));
      return;
    }
    const session = createSiteSession(siteUsername, sitePassword);
    response.setHeader(
      "Set-Cookie",
      `${SITE_SESSION_COOKIE}=${encodeURIComponent(session)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
    response.redirect(303, "../");
  });

  app.use((request, response, next) => {
    const session = readCookie(request.headers.cookie, SITE_SESSION_COOKIE);
    if (
      validSiteSession(session, siteUsername, sitePassword) ||
      validBasicAuthorization(request.headers.authorization, siteUsername, sitePassword)
    ) {
      next();
      return;
    }
    if (
      request.method === "GET" &&
      !request.path.startsWith("/api/") &&
      request.accepts("html")
    ) {
      response.status(200).type("html").send(loginPage());
      return;
    }
    response.status(401).json({ error: "需要先登录" });
  });
}

installAccountAuth(app, async (id) => {
  const [entries, feedback] = await Promise.all([loadAllEntries("USR-DEMO-001"), getCoachFeedbackHistory("USR-DEMO-001")]);
  await saveInheritedHistory(id, entries, feedback);
});

installKnowledgeRoutes(app);

function requireUserId(value: unknown): UserId {
  if (!isUserId(value)) throw new Error("Unsupported demo user");
  return value;
}

const parseRequestSchema = z.object({
  userId: z.custom<UserId>(isUserId),
  rawText: z.string().trim().min(2).max(2000),
  inputMode: z.enum(["voice", "text"]),
});

const previewSchema = z.object({
  rawText: z.string().min(1).max(2000),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inputMode: z.enum(["voice", "text"]),
  weightKg: z.number().min(30).max(250).nullable(),
  weightRaw: z.string().nullable(),
  dietText: z.string().nullable(),
  activityText: z.string().nullable(),
  sleepText: z.string().nullable(),
  contextTags: z.array(z.string()).max(8),
  uncertainties: z.array(z.string()).max(4),
  followupQuestion: z.string().nullable(),
  parserMode: z.enum(["deepseek", "local"]),
});

const questionRequestSchema = z.object({
  userId: z.custom<UserId>(isUserId),
  questionText: z.string().trim().min(2).max(1000),
  inputMode: z.enum(["voice", "text"]),
});

const replyRequestSchema = z.object({
  userId: z.custom<UserId>(isUserId),
  questionId: z.string().min(2).max(200),
  replyText: z.string().trim().min(2).max(1000),
});

const trainingRequestSchema = z.object({
  userId: z.custom<UserId>(isUserId),
  userIds: z.array(z.custom<UserId>(isUserId)).min(1).max(100).optional(),
  exerciseIds: z.array(z.string()).min(1).max(6),
  prescription: z.string().trim().min(2).max(300),
  note: z.string().trim().max(500),
});

function localDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function questionsWithStatus(userId?: UserId) {
  const [questions, replies] = await Promise.all([readReviewQuestions(userId), readCoachReplies(userId)]);
  const replied = new Set(replies.map((reply) => reply.questionId));
  return questions.map((question) => ({
    ...question,
    status: replied.has(question.questionId) ? "replied" as const : "new" as const,
  }));
}

app.get("/api/config", async (_request, response, next) => {
  try {
    response.json({
      vaultConnected: await vaultConnected(),
      deepSeekEnabled: deepSeekEnabled(),
      demoMode: true,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", async (request, response, next) => {
  try {
    const viewer = accountLoginEnabled ? await currentAccount(request) : undefined;
    const users = await listUsers();
    response.json(viewer?.role === "learner" ? users.filter(u => u.userId === viewer.userId) : users);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/records", async (request, response, next) => {
  try {
    response.json(await getRecords(requireUserId(request.params.userId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/review", async (request, response, next) => {
  try {
    const userId = requireUserId(request.params.userId);
    const [review, acceptances] = await Promise.all([getReview(userId), readActionAcceptances(userId)]);
    const accepted = [...acceptances]
      .reverse()
      .find((event) => event.cycleId === review.cycleId && event.actionId === review.actionId);
    response.json({ ...review, actionAcceptedAt: accepted?.createdAt ?? null });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/coach-feedback", async (request, response, next) => {
  try {
    response.json(await getCoachFeedbackHistory(requireUserId(request.params.userId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/inbody", async (request, response, next) => {
  try {
    response.json(await getInBodyTrendReport(requireUserId(request.params.userId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/inbody-report.pdf", async (request, response, next) => {
  try {
    const userId = requireUserId(request.params.userId);
    if (userId !== "USR-DEMO-001") throw new Error("InBody report is only available for the selected client");
    const reportPath = path.join(PROJECT_ROOT, "output", "pdf", "示例学员-InBody趋势报告-2026-06-05.pdf");
    response.download(reportPath, "示例学员-InBody趋势报告-2026-06-05.pdf");
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/report.docx", async (request, response, next) => {
  try {
    const userId = requireUserId(request.params.userId);
    const requestedPeriod = String(request.query.period ?? "30");
    const period: ReportPeriod = requestedPeriod === "7" || requestedPeriod === "all" ? requestedPeriod : "30";
    const [records, review, feedback] = await Promise.all([
      getRecords(userId),
      getReview(userId),
      getCoachFeedbackHistory(userId),
    ]);
    const report = await generateWellnessReport({ records, review, feedback, period });
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`);
    response.setHeader("Content-Length", String(report.buffer.length));
    response.send(report.buffer);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/questions", async (request, response, next) => {
  try {
    const questions = await questionsWithStatus(requireUserId(request.params.userId));
    response.json(questions.slice(-20).reverse());
  } catch (error) {
    next(error);
  }
});

app.get("/api/coach/questions", async (_request, response, next) => {
  try {
    const questions = await questionsWithStatus();
    response.json(questions.slice(-100).reverse());
  } catch (error) {
    next(error);
  }
});

app.get("/api/exercises", (_request, response) => {
  response.json({ categories: EXERCISE_CATEGORIES, exercises: EXERCISES });
});

app.get("/api/users/:userId/training", async (request, response, next) => {
  try {
    const userId = requireUserId(request.params.userId);
    const assignments = await readTrainingAssignments(userId);
    const assignment = [...assignments].reverse().find((item) => item.localDate === localDate()) ?? null;
    response.json(assignment && assignment.status !== "removed" ? {
      ...assignment,
      exerciseItems: assignment.exerciseIds.map(getExercise).filter(Boolean),
    } : null);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId/coach-replies", async (request, response, next) => {
  try {
    const replies = await readCoachReplies(requireUserId(request.params.userId));
    response.json(replies.slice(-50).reverse());
  } catch (error) {
    next(error);
  }
});

app.get("/api/coach/dashboard", async (_request, response, next) => {
  try {
    const [users, questions] = await Promise.all([listUsers(), questionsWithStatus()]);
    const students = await Promise.all(users.filter(u => u.userId !== "USR-SELF-001").map(async student => {
      const [records, assignments] = await Promise.all([getRecords(student.userId), readTrainingAssignments(student.userId)]);
      const latest = records.entries.at(-1);
      const today = assignments.filter(a => a.localDate === localDate()).at(-1);
      return { ...student, latestDate: latest?.localDate ?? null,
        latestWeightKg: records.weights.at(-1)?.value ?? null, recordCount: records.entries.length,
        hasTrainingToday: today?.status === "assigned" };
    }));
    const dashboard: CoachDashboard = {
      students,
      questions: questions
        .filter((item) => students.some(s => s.userId === item.userId))
        .slice(-100)
        .reverse()
        .map((item) => ({ ...item, displayAlias: students.find(s => s.userId === item.userId)!.displayAlias })),
    };
    response.json(dashboard);
  } catch (error) {
    next(error);
  }
});

app.post("/api/coach/replies", async (request, response, next) => {
  try {
    const input = replyRequestSchema.parse(request.body);
    const question = (await readReviewQuestions(input.userId)).find(q => q.questionId === input.questionId);
    if (!question) { response.status(400).json({ error: "疑问与学员不匹配" }); return; }
    const reply: CoachReply = {
      replyId: `APP-RPY-${crypto.randomUUID()}`,
      userId: input.userId,
      questionId: input.questionId,
      replyText: input.replyText,
      coachAlias: "YC",
      createdAt: new Date().toISOString(),
    };
    await appendCoachReply(reply);
    response.status(201).json(reply);
  } catch (error) {
    next(error);
  }
});

app.post("/api/coach/training-assignments", async (request, response, next) => {
  try {
    const input = trainingRequestSchema.parse(request.body);
    const recipients = [...new Set(input.userIds || [input.userId])];
    if (accountLoginEnabled && (await Promise.all(recipients.map(accountUser))).some(u => !u)) {
      response.status(400).json({ error: "有学员已移除，请刷新后重选" }); return;
    }
    const validExerciseIds = input.exerciseIds.filter((id) => getExercise(id));
    if (!validExerciseIds.length) throw new Error("No supported exercise selected");
    const assignment: TrainingAssignment = {
      assignmentId: `APP-TRN-${crypto.randomUUID()}`,
      userId: input.userId,
      localDate: localDate(),
      exerciseIds: validExerciseIds,
      prescription: input.prescription,
      note: input.note,
      status: "assigned",
      createdAt: new Date().toISOString(),
    };
    for (const userId of recipients) await appendTrainingAssignment({ ...assignment, userId, assignmentId: `APP-TRN-${crypto.randomUUID()}` });
    response.status(201).json({
      ...assignment,
      exerciseItems: assignment.exerciseIds.map(getExercise).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/coach/users/:userId/remove", async (request, response, next) => {
  try {
    if (!accountLoginEnabled) { response.status(503).json({ error: "仅本地账号测试版支持账号管理" }); return; }
    await disableAccount(requireUserId(request.params.userId));
    response.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/coach/users/:userId/remove-training", async (request, response, next) => {
  try {
    if (!accountLoginEnabled) { response.status(503).json({ error: "仅本地账号测试版支持计划移除" }); return; }
    const userId = requireUserId(request.params.userId);
    await appendTrainingAssignment({ assignmentId: `APP-TRN-${crypto.randomUUID()}`, userId, localDate: localDate(),
      exerciseIds: [], prescription: "", note: "主教练移除今日计划", status: "removed", createdAt: new Date().toISOString() });
    response.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/questions", async (request, response, next) => {
  try {
    const input = questionRequestSchema.parse(request.body);
    const question: ReviewQuestion = {
      questionId: `APP-QST-${crypto.randomUUID()}`,
      userId: input.userId,
      questionText: input.questionText,
      inputMode: input.inputMode,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    await appendReviewQuestion(question);
    response.status(201).json(question);
  } catch (error) {
    next(error);
  }
});

app.post("/api/actions/accept", async (request, response, next) => {
  try {
    const userId = requireUserId(request.body?.userId);
    const review = await getReview(userId);
    const event: ActionAcceptance = {
      eventId: `APP-ACT-${crypto.randomUUID()}`,
      userId,
      cycleId: review.cycleId,
      actionId: review.actionId,
      actionSnapshot: review.action,
      sourceIds: review.sourceIds,
      dataCutoff: review.dataCutoff,
      status: "accepted",
      createdAt: new Date().toISOString(),
    };
    await appendActionAcceptance(event);
    response.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

app.post("/api/parse", async (request, response, next) => {
  try {
    const input = parseRequestSchema.parse(request.body);
    response.json(await parseDailyInput(input.rawText, input.inputMode));
  } catch (error) {
    next(error);
  }
});

app.post("/api/entries", async (request, response, next) => {
  try {
    const userId = requireUserId(request.body?.userId);
    const preview = previewSchema.parse(request.body?.entry) as ParsedEntryPreview;
    const now = new Date().toISOString();
    const entry: DailyEntry = {
      entryId: `APP-ENT-${crypto.randomUUID()}`,
      sourceId: null,
      userId,
      localDate: preview.localDate,
      timezone: "Asia/Shanghai",
      observationMode: preview.inputMode,
      rawText: preview.rawText,
      weightRaw: preview.weightRaw,
      weightKg: preview.weightKg,
      activityText: preview.activityText,
      dietScoreRaw: null,
      dietText: preview.dietText,
      contextTags: preview.contextTags,
      parseStatus: preview.uncertainties.length ? "ambiguous" : "valid",
      locator: null,
      origin: "prototype",
      createdAt: now,
    };
    await appendPrototypeEntry(entry);
    response.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

app.post("/api/feedback", async (request, response, next) => {
  try {
    const userId = requireUserId(request.body?.userId);
    const entry = previewSchema.parse(request.body?.entry) as ParsedEntryPreview;
    const [records, review] = await Promise.all([getRecords(userId), getReview(userId)]);
    const knowledgeCards = await loadKnowledgeCards(
      review.sourceIds.filter((sourceId) => sourceId.startsWith("MC-WT-")).slice(0, 2),
    );
    response.json(
      await generateDailyFeedback({
        entry,
        recentEntries: records.entries,
        review,
        knowledgeCards,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "输入格式不完整", details: error.flatten() });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(`[prototype-api] ${message}`);
  response.status(500).json({ error: "原型暂时无法处理这次请求" });
});

const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || "127.0.0.1";

if (process.env.NODE_ENV === "production") {
  const dist = path.join(PROJECT_ROOT, "dist");
  app.use(express.static(dist));
  app.use((_request, response) => response.sendFile(path.join(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: PROJECT_ROOT,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`轻伴有数网页版已启动：http://${displayHost}:${port}`);
});
