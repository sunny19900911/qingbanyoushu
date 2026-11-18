import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Inbox,
  Keyboard,
  LoaderCircle,
  MessageCircleQuestion,
  Mic,
  RefreshCw,
  Send,
  Square,
  UserRound,
  X,
} from "lucide-react";
import type {
  AppUser,
  CoachDashboard,
  CoachFeedbackHistoryItem,
  CoachReply,
  ExerciseItem,
  InputMode,
  TrainingAssignment,
  UserId,
} from "../../shared/types";
import { api } from "../api";
import { appUrl } from "../appUrl";
import { SpeakButton } from "../components/SpeakButton";
import { exerciseExplanation, exerciseNarration } from "../lib/exerciseNarration";
import { UserSwitcher } from "../components/UserSwitcher";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type CoachMode = "workspace" | "self";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ExerciseDetail({ exercise, onClose }: { exercise: ExerciseItem; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="exercise-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="exercise-dialog" role="dialog" aria-modal="true" aria-label={exercise.name} onMouseDown={(event) => event.stopPropagation()}>
        <button className="exercise-dialog__close" type="button" onClick={onClose} aria-label="关闭动作详情"><X /></button>
        <div className="exercise-dialog__media"><img src={appUrl(exercise.image)} alt={`${exercise.name}动作演示`} /></div>
        <div className="exercise-dialog__body">
          <span className="exercise-kicker">{exercise.bodyPart} · {exercise.level} · {exercise.equipment}</span>
          <h2>{exercise.name}</h2>
          <p className="exercise-dialog__muscle">主要练：{exercise.muscle}</p>
          <SpeakButton text={exerciseNarration(exercise)} label={`听${exercise.name}讲解`} />
          <div className="plain-explanation"><strong>大白话怎么做</strong><p>{exerciseExplanation(exercise)}</p></div>
          <ol className="exercise-step-list">
            {exercise.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <div className="exercise-cue"><strong>记住这一句</strong><span>{exercise.cue}</span></div>
          <p className="exercise-caution">{exercise.caution}</p>
          <button className="secondary-button" type="button" onClick={onClose}>我知道了</button>
        </div>
      </article>
    </div>
  );
}

function ExerciseLibrary({ exercises, categories }: { exercises: ExerciseItem[]; categories: string[] }) {
  const [category, setCategory] = useState("全部");
  const [detail, setDetail] = useState<ExerciseItem | null>(null);
  const visible = useMemo(
    () => category === "全部" ? exercises : exercises.filter((item) => item.bodyPart === category),
    [category, exercises],
  );

  return (
    <section className="exercise-library" aria-labelledby="exercise-library-title">
      <div className="section-heading-row">
        <div><h2 id="exercise-library-title">简短动作库</h2><p>哑铃优先，固定器械靠后</p></div>
        <span>{visible.length} 个动作</span>
      </div>
      <div className="exercise-categories" role="tablist" aria-label="动作部位">
        {categories.map((item) => (
          <button className={category === item ? "is-active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      <div className="exercise-card-grid">
        {visible.map((item) => (
          <div className="exercise-with-voice" key={item.id}><button className="exercise-web-card" type="button" onClick={() => setDetail(item)}>
            <img src={appUrl(item.image)} alt="" />
            <span className="exercise-kicker">{item.bodyPart} · {item.equipment}</span>
            <strong>{item.name}</strong>
            <small>{item.muscle} · {item.level}</small>
          </button><SpeakButton text={exerciseNarration(item)} label={`听${item.name}讲解`} /></div>
        ))}
      </div>
      <p className="training-safety-note">动作库用于看懂教练提醒；新动作、加重量或身体不适时，先和教练确认。</p>
      {detail ? <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}

function TodayTraining({ training, onOpen }: { training: TrainingAssignment | null; onOpen: (item: ExerciseItem) => void }) {
  return (
    <section className={training ? "today-training-card has-training" : "today-training-card"}>
      <div className="today-training-card__head">
        <div><span>今日力量提醒</span><h2>{training ? "今天练得稳一点" : "今天还没有训练安排"}</h2></div>
        <div className="training-mark"><Dumbbell /></div>
      </div>
      {training ? (
        <>
          <div className="training-prescription"><strong>{training.prescription}</strong><span>{training.note}</span></div>
          <div className="training-exercise-list">
            {(training.exerciseItems ?? []).map((item, index) => (
              <div key={item.id}><button type="button" onClick={() => onOpen(item)}>
                <img src={appUrl(item.image)} alt="" />
                <span><strong>{index + 1}. {item.name}</strong><small>{item.muscle} · {item.equipment}</small></span>
                <ChevronRight />
              </button><SpeakButton text={exerciseNarration(item)} label={`听${item.name}讲解`} /></div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-training"><strong>没有安排也不用补作业。</strong><span>需要训练时，由教练从动作库里发一条简短提醒。</span></div>
      )}
    </section>
  );
}

function LearnerQuestion({ userId, onSent }: { userId: UserId; onSent: () => void }) {
  const [text, setText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechRecognition((transcript) => {
    setText(transcript);
    setInputMode("voice");
    setKeyboardOpen(true);
  });

  const submit = async () => {
    if (text.trim().length < 2 || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.submitQuestion(userId, text.trim(), inputMode);
      setText("");
      setKeyboardOpen(false);
      setSent(true);
      onSent();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "暂时无法发送");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="learner-question-card">
      <div className="learner-question-card__head">
        <div><span>训练或记录遇到问题</span><h2>直接说给 YC</h2></div>
        <MessageCircleQuestion />
      </div>
      <div className={speech.listening ? "learner-question-voice is-listening" : "learner-question-voice"}>
        <button type="button" onClick={() => speech.listening ? speech.stop() : speech.start()} aria-label={speech.listening ? "结束录音" : "开始语音输入"}>
          {speech.listening ? <Square /> : <Mic />}
        </button>
        <strong>{speech.listening ? "再点一下结束" : "点一下开始说话"}</strong>
      </div>
      <button className="question-keyboard-link" type="button" onClick={() => setKeyboardOpen((value) => !value)}>
        <Keyboard />{keyboardOpen ? "收起键盘输入" : "不方便说？键盘输入"}
      </button>
      {keyboardOpen ? (
        <div className="question-compose">
          <textarea value={text} onChange={(event) => { setText(event.target.value); setInputMode("text"); setSent(false); }} placeholder="比如：今天肩膀不舒服，这个动作还要做吗？" />
          <button className="question-submit" type="button" disabled={text.trim().length < 2 || sending} onClick={() => void submit()}>
            {sending ? <LoaderCircle className="spin" /> : <Send />}{sending ? "正在发送" : "发送给 YC"}
          </button>
        </div>
      ) : null}
      {speech.error || error ? <p className="inline-error">{speech.error || error}</p> : null}
      {sent ? <p className="question-sent"><Check />已发送到 YC 的教练工作台</p> : null}
    </section>
  );
}

function FeedbackHistory({ items }: { items: CoachFeedbackHistoryItem[] }) {
  if (!items.length) return null;
  return (
    <section className="training-feedback-history">
      <div className="section-heading-row"><div><h2>陪跑中的关键提醒</h2><p>按实际发生的阶段整理</p></div><span>{items.length} 条</span></div>
      <div className="feedback-history-grid">
        {items.map((item) => (
          <article key={item.feedbackId}>
            <time>{formatDate(item.linkedDate)}</time>
            <h3>{item.stage}</h3>
            <p>{item.coachMessage}</p>
            <SpeakButton text={`${item.stage}。${item.coachMessage}`} label="听教练提醒" />
            <div><strong>当时的变化</strong><span>{item.observedChange}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearnerView({ userId, exercises, categories }: { userId: UserId; exercises: ExerciseItem[]; categories: string[] }) {
  const [training, setTraining] = useState<TrainingAssignment | null>(null);
  const [replies, setReplies] = useState<CoachReply[]>([]);
  const [feedback, setFeedback] = useState<CoachFeedbackHistoryItem[]>([]);
  const [detail, setDetail] = useState<ExerciseItem | null>(null);

  const load = useCallback(async () => {
    const [nextTraining, nextReplies, nextFeedback] = await Promise.all([
      api.training(userId), api.coachReplies(userId), api.coachFeedback(userId),
    ]);
    setTraining(nextTraining);
    setReplies(nextReplies);
    setFeedback(nextFeedback);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="learner-training-view">
      <TodayTraining training={training} onOpen={setDetail} />
      {userId !== "USR-SELF-001" ? <LearnerQuestion userId={userId} onSent={() => void load()} /> : null}
      {userId !== "USR-SELF-001" && replies.length ? (
        <section className="coach-replies">
          <div className="section-heading-row"><div><h2>YC 的回复</h2><p>最近收到的教练反馈</p></div><span>{replies.length} 条</span></div>
          {replies.map((reply) => <article key={reply.replyId}><div>YC</div><p><strong>教练回复</strong><span>{reply.replyText}</span></p><SpeakButton text={reply.replyText} label="听教练回复" /><time>{formatDateTime(reply.createdAt)}</time></article>)}
        </section>
      ) : null}
      <ExerciseLibrary exercises={exercises} categories={categories} />
      {userId !== "USR-SELF-001" ? <FeedbackHistory items={feedback} /> : null}
      {detail ? <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

function CoachWorkspace({ exercises, onChanged, accountManagement }: { exercises: ExerciseItem[]; onChanged: () => void; accountManagement: boolean }) {
  const [dashboard, setDashboard] = useState<CoachDashboard | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [prescription, setPrescription] = useState("每个动作 2 组，每组 8—10 次");
  const [note, setNote] = useState("动作稳定优先，完成后告诉我哪里最累。");
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<UserId[]>([]);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<{ id: UserId; alias: string; kind: "user" | "training" } | null>(null);

  const load = useCallback(async () => setDashboard(await api.coachDashboard()), []);
  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);

  const assign = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    setMessage(null);
    setError("");
    try {
      if (!recipients.length) { setError("先选至少一位接收学员"); return; }
      await api.assignTraining(recipients[0], selected, prescription, note, recipients);
      setSelected([]);
      setMessage(`今日训练提醒已发给 ${recipients.length} 位学员`);
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "发送失败，请重试"); } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true); setError("");
    try {
      if (removing.kind === "user") await api.removeUser(removing.id); else await api.removeTraining(removing.id);
      setRecipients(r => r.filter(id => id !== removing.id)); setRemoving(null); await load(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "暂时无法移除"); }
    finally { setSaving(false); }
  };

  const sendReply = async (questionId: string, userId: UserId) => {
    if (replyText.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      await api.replyQuestion(userId, questionId, replyText.trim());
      setReplying(null);
      setReplyText("");
      setMessage("回复已经发送");
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "回复失败，请重试"); } finally {
      setSaving(false);
    }
  };

  if (!dashboard) return <div className="page-loading"><LoaderCircle className="spin" />正在整理训练与反馈</div>;

  return (
    <div className="coach-workspace">
      <section className="coach-workspace-hero">
        <div><span>YC · 教练端</span><h2>先看学员发生了什么，再回复一件最值得做的事。</h2></div>
        <div className="coach-workspace-stats">
          <span><strong>{dashboard.students.length}</strong>学员</span>
          <span><strong>{dashboard.questions.filter((item) => item.status === "new").length}</strong>待回复</span>
          <span><strong>{selected.length}</strong>已选动作</span>
        </div>
      </section>

      <div className="coach-desktop-grid">
        <div>
          <section className="coach-panel">
            <div className="section-heading-row"><div><h2>学员动态</h2><p>数据与沟通同页查看</p></div><UserRound /></div>
            {dashboard.students.map((student) => (
              <article className="student-summary" key={student.userId}>
                <div>{student.displayAlias.slice(0, 1)}</div><p><strong>{student.displayAlias}</strong><span>最近记录 {student.latestDate || "未记录"}</span><span>最近体重 {student.latestWeightKg ? `${student.latestWeightKg} kg` : "未记录"}</span>{student.inheritedFrom ? <small>含继承的历史样例</small> : null}</p>
                <em className={student.hasTrainingToday ? "is-ready" : ""}>{student.hasTrainingToday ? "今日已布置" : "待布置训练"}</em>
                {accountManagement ? <span className="student-management">{student.hasTrainingToday ? <button onClick={() => setRemoving({ id: student.userId, alias: student.displayAlias, kind: "training" })}>移除今日计划</button> : null}<button onClick={() => setRemoving({ id: student.userId, alias: student.displayAlias, kind: "user" })}>移除学员</button></span> : null}
              </article>
            ))}
          </section>

          <section className="coach-panel coach-inbox-panel">
            <div className="section-heading-row"><div><h2>学员疑问</h2><p>{dashboard.questions.length ? "按时间倒序" : "暂无新消息"}</p></div><button type="button" onClick={() => void load()} aria-label="刷新"><RefreshCw /></button></div>
            {!dashboard.questions.length ? <div className="coach-empty"><Check /><strong>目前没有待处理的疑问</strong><span>学员发送语音或文字后，会出现在这里。</span></div> : null}
            {dashboard.questions.map((question) => (
              <article className="coach-question-web" key={question.questionId}>
                <div><strong>{question.displayAlias}</strong><span>{question.status === "replied" ? "已回复" : "待回复"} · {formatDateTime(question.createdAt)}</span></div>
                <p>{question.questionText}</p>
                {replying === question.questionId ? (
                  <div className="coach-reply-compose"><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="只回复最重要的一两点…" /><div><button type="button" onClick={() => setReplying(null)}>取消</button><button type="button" disabled={replyText.trim().length < 2 || saving} onClick={() => void sendReply(question.questionId, question.userId)}>发送</button></div></div>
                ) : <button type="button" onClick={() => { setReplying(question.questionId); setReplyText(""); }}>{question.status === "replied" ? "再补充一句" : "回复学员"}</button>}
              </article>
            ))}
          </section>
        </div>

        <section className="coach-panel training-assignment-panel">
          <div className="section-heading-row"><div><h2>布置今日力量训练</h2><p>从熟悉或已确认的动作里选 1—3 个</p></div><Dumbbell /></div>
          <div className="assignment-recipients"><div><strong>发给谁</strong><button onClick={() => setRecipients(dashboard.students.map(s => s.userId))}>选择全部学员</button><button onClick={() => setRecipients([])}>清空</button></div>{dashboard.students.map(s => <label key={s.userId}><input type="checkbox" checked={recipients.includes(s.userId)} onChange={e => setRecipients(r => e.target.checked ? [...r, s.userId] : r.filter(id => id !== s.userId))} />{s.displayAlias}</label>)}</div>
          <div className="assignment-exercise-grid">
            {exercises.map((item) => (
              <div className="assignment-with-voice" key={item.id}><button className={selected.includes(item.id) ? "is-selected" : ""} type="button" onClick={() => toggle(item.id)}>
                <img src={appUrl(item.image)} alt="" /><span><strong>{item.name}</strong><small>{item.bodyPart} · {item.equipment}</small></span>{selected.includes(item.id) ? <Check /> : null}
              </button><SpeakButton text={exerciseNarration(item)} label={`听${item.name}讲解`} /></div>
            ))}
          </div>
          <label className="coach-field"><span>组数与次数</span><input value={prescription} onChange={(event) => setPrescription(event.target.value)} /></label>
          <label className="coach-field"><span>教练提醒</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button className="primary-button" type="button" disabled={!selected.length || !recipients.length || saving} onClick={() => void assign()}>{saving ? <LoaderCircle className="spin" /> : <Send />}{saving ? "正在发送" : `发送给 ${recipients.length} 位学员`}</button>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          {message ? <p className="coach-success"><Check />{message}</p> : null}
        </section>
      </div>
      {removing ? <div className="exercise-dialog-backdrop"><section className="account-confirm" role="dialog" aria-modal="true" aria-label="确认移除"><h2>{removing.kind === "user" ? `移除学员 ${removing.alias}？` : `移除 ${removing.alias} 的今日计划？`}</h2><p>{removing.kind === "user" ? "移除后该学员无法继续登录；已有记录保留，不删除历史文件。" : "学员将看到今天暂无训练安排，历史布置记录保留。"}</p><button disabled={saving} onClick={() => setRemoving(null)}>取消</button><button disabled={saving} onClick={() => void remove()}>确认移除</button></section></div> : null}
    </div>
  );
}

export function TrainingCoachPage({ users, userId, onUserChange, isCoach, accountManagement = false, onAccountsChanged }: { users: AppUser[]; userId: UserId; onUserChange: (userId: UserId) => void; isCoach: boolean; accountManagement?: boolean; onAccountsChanged: () => void }) {
  const [coachMode, setCoachMode] = useState<CoachMode>(isCoach ? "workspace" : "self");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    setCoachMode(isCoach ? "workspace" : "self");
  }, [isCoach]);

  useEffect(() => {
    api.exercises().then((result) => { setExercises(result.exercises); setCategories(result.categories); });
  }, []);

  return (
    <section className="page training-coach-page">
      <header className="page-header page-header--title">
        <h1>{isCoach && coachMode === "workspace" ? "教练工作台" : "训练与教练"}</h1>
        <UserSwitcher users={users} value={userId} onChange={onUserChange} />
      </header>
      {isCoach ? (
        <div className="coach-role-switch" role="tablist">
          <button className={coachMode === "workspace" ? "is-active" : ""} type="button" onClick={() => setCoachMode("workspace")}>教练工作台</button>
          <button className={coachMode === "self" ? "is-active" : ""} type="button" onClick={() => setCoachMode("self")}>我的训练</button>
        </div>
      ) : null}
      {!exercises.length ? <div className="page-loading"><LoaderCircle className="spin" />正在加载动作库</div> : isCoach && coachMode === "workspace" ? (
        <CoachWorkspace exercises={exercises} accountManagement={accountManagement} onChanged={() => { setRefreshVersion((value) => value + 1); onAccountsChanged(); }} />
      ) : (
        <LearnerView key={`${userId}-${refreshVersion}`} userId={userId} exercises={exercises} categories={categories} />
      )}
    </section>
  );
}
