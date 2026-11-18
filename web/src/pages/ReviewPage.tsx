import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  History,
  Inbox,
  Keyboard,
  Leaf,
  LoaderCircle,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  RefreshCw,
  Send,
  Square,
  Target,
  TriangleAlert,
} from "lucide-react";
import type {
  AppUser,
  CoachFeedbackHistoryItem,
  InputMode,
  ReviewQuestion,
  ReviewResponse,
  UserId,
} from "../../shared/types";
import { api } from "../api";
import { UserSwitcher } from "../components/UserSwitcher";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

function ReviewSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Leaf;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="review-section">
      <div className="review-section__heading">
        <Icon aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function formatQuestionTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFeedbackDate(value: string): string {
  if (!value) return "过往记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function CoachFeedbackHistory({
  items,
  loading,
}: {
  items: CoachFeedbackHistoryItem[];
  loading: boolean;
}) {
  if (!loading && !items.length) return null;

  return (
    <section className="coach-feedback-history" aria-labelledby="coach-feedback-history-title">
      <div className="coach-feedback-history__header">
        <div>
          <History aria-hidden="true" />
          <h2 id="coach-feedback-history-title">教练反馈时间线</h2>
        </div>
        {items.length ? <span>{items.length} 条</span> : null}
      </div>
      <p className="coach-feedback-history__intro">按当时的饮食和运动记录，整理这一路的关键提醒。</p>
      {loading ? (
        <div className="coach-feedback-history__loading"><LoaderCircle className="spin" />正在读取过往反馈</div>
      ) : (
        <div className="coach-feedback-timeline">
          {items.map((item, index) => (
            <details className="coach-feedback-card" key={item.feedbackId} open={index === 0}>
              <summary>
                <span className="coach-feedback-card__dot" aria-hidden="true" />
                <div className="coach-feedback-card__summary">
                  <span className="coach-feedback-card__meta">
                    {formatFeedbackDate(item.linkedDate)} · {item.coachAlias} 教练
                  </span>
                  <h3>{item.stage}</h3>
                  <p>{item.coachMessage}</p>
                </div>
                <ChevronDown className="coach-feedback-card__chevron" aria-hidden="true" />
              </summary>
              <div className="coach-feedback-card__detail">
                <strong>关联记录</strong>
                <p>{item.observedChange}</p>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function CoachInbox({ users, refreshKey }: { users: AppUser[]; refreshKey: number }) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setQuestions(await api.coachQuestions());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "暂时无法读取疑问");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, refreshKey]);

  const aliasById = new Map(users.map((user) => [user.userId, user.displayAlias]));

  return (
    <section className="coach-inbox" aria-labelledby="coach-inbox-title">
      <div className="coach-inbox__header">
        <div>
          <span className="coach-inbox__eyebrow">本机教练视图</span>
          <h2 id="coach-inbox-title"><Inbox aria-hidden="true" />教练收件箱</h2>
        </div>
        <button type="button" onClick={() => void refresh()} aria-label="刷新教练收件箱">
          <RefreshCw className={loading ? "spin" : undefined} aria-hidden="true" />
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      {!loading && !questions.length ? <p className="coach-inbox__empty">还没有收到用户疑问</p> : null}
      {questions.length ? (
        <div className="coach-inbox__list">
          {questions.map((question) => (
            <article key={question.questionId} className="coach-question">
              <div className="coach-question__meta">
                <strong>{aliasById.get(question.userId) ?? question.userId}</strong>
                <span>{question.inputMode === "voice" ? "语音" : "文字"} · {formatQuestionTime(question.createdAt)}</span>
              </div>
              <p>{question.questionText}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ReviewPage({
  users,
  userId,
  onUserChange,
  coachMode = false,
}: {
  users: AppUser[];
  userId: UserId;
  onUserChange: (userId: UserId) => void;
  coachMode?: boolean;
}) {
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [coachFeedback, setCoachFeedback] = useState<CoachFeedbackHistoryItem[]>([]);
  const [coachFeedbackLoading, setCoachFeedbackLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionKeyboardOpen, setQuestionKeyboardOpen] = useState(false);
  const [questionInputMode, setQuestionInputMode] = useState<InputMode>("text");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionSent, setQuestionSent] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionVersion, setQuestionVersion] = useState(0);

  const speech = useSpeechRecognition((text) => {
    setQuestionText(text);
    setQuestionInputMode("voice");
    setQuestionSent(false);
    setQuestionKeyboardOpen(true);
  });

  useEffect(() => {
    setReview(null);
    setCoachFeedback([]);
    setCoachFeedbackLoading(true);
    setAccepted(false);
    setError(null);
    setQuestionText("");
    setQuestionKeyboardOpen(false);
    setQuestionSent(false);
    setQuestionError(null);
    speech.reset();
    api.review(userId)
      .then((nextReview) => {
        setReview(nextReview);
        setAccepted(Boolean(nextReview.actionAcceptedAt));
      })
      .catch((requestError) => setError(requestError.message));
    api.coachFeedback(userId)
      .then(setCoachFeedback)
      .catch(() => setCoachFeedback([]))
      .finally(() => setCoachFeedbackLoading(false));
  }, [userId, speech.reset]);

  const submitQuestion = async () => {
    const value = questionText.trim();
    if (value.length < 2 || questionSubmitting) return;
    setQuestionSubmitting(true);
    setQuestionError(null);
    setQuestionSent(false);
    try {
      await api.submitQuestion(userId, value, questionInputMode);
      setQuestionText("");
      setQuestionKeyboardOpen(false);
      setQuestionSent(true);
      setQuestionVersion((version) => version + 1);
    } catch (requestError) {
      setQuestionError(requestError instanceof Error ? requestError.message : "暂时无法发送疑问");
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const acceptAction = async () => {
    if (accepted || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await api.acceptAction(userId);
      setAccepted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "暂时无法记录本周行动");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <section className="page review-page">
      <header className="page-header page-header--title">
        <h1>教练反馈</h1>
        <UserSwitcher users={users} value={userId} onChange={onUserChange} />
      </header>
      {coachMode ? <CoachInbox users={users} refreshKey={questionVersion} /> : null}
      {!review && !error ? <div className="page-loading"><LoaderCircle className="spin" />正在整理本轮记录</div> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      {review ? (
        <>
          <div className="review-conclusion">
            <div className="review-conclusion__label">
              <MessageSquareText aria-hidden="true" />
              <span>教练想对你说</span>
            </div>
            <h2>{review.conclusion}</h2>
            <p className="review-introduction">{review.introduction}</p>
          </div>

          <section className="review-question" aria-labelledby="review-question-title">
            <div className="review-question__heading">
              <MessageCircleQuestion aria-hidden="true" />
              <h2 id="review-question-title">你有什么疑问？</h2>
            </div>
            <p className="review-question__hint">直接说给教练听，想到什么就说什么</p>
            <div className={speech.listening ? "question-voice-area is-listening" : "question-voice-area"}>
              <div className="question-voice-rings" aria-hidden="true" />
              <button
                className="question-voice-button"
                type="button"
                onClick={() => {
                  setQuestionError(null);
                  setQuestionSent(false);
                  if (speech.listening) speech.stop();
                  else if (!speech.start()) {
                    setQuestionKeyboardOpen(true);
                    setQuestionError("当前浏览器不支持语音输入，可以直接打字");
                  }
                }}
                aria-label={speech.listening ? "结束语音输入" : "开始语音输入疑问"}
              >
                {speech.listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </button>
              <strong>{speech.listening ? "再点一下结束" : "点一下开始说话"}</strong>
              {speech.listening && speech.transcript ? <p className="question-transcript">{speech.transcript}</p> : null}
            </div>
            <button className="question-keyboard-link" type="button" onClick={() => setQuestionKeyboardOpen((open) => !open)}>
              <Keyboard aria-hidden="true" />
              {questionKeyboardOpen ? "收起键盘输入" : "不方便说？键盘输入"}
            </button>
            {questionKeyboardOpen ? (
              <div className="question-compose">
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(event) => {
                    setQuestionText(event.target.value);
                    setQuestionInputMode("text");
                    setQuestionSent(false);
                  }}
                  placeholder="比如：晚上加班时总想吃点心，怎么调整比较实际？"
                  aria-label="输入你的疑问"
                />
                <button
                  className="question-submit"
                  type="button"
                  onClick={() => void submitQuestion()}
                  disabled={questionText.trim().length < 2 || questionSubmitting || speech.listening}
                >
                  {questionSubmitting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {questionSubmitting ? "正在发送" : "发送给教练"}
                </button>
              </div>
            ) : null}
            {speech.error || questionError ? <p className="inline-error">{speech.error || questionError}</p> : null}
            {questionSent ? <p className="question-sent"><Check aria-hidden="true" />已发送给教练</p> : null}
          </section>

          <CoachFeedbackHistory items={coachFeedback} loading={coachFeedbackLoading} />

          <ReviewSection icon={Leaf} title="值得保留">
            <ul>{review.keep.map((item) => <li key={item}>{item}</li>)}</ul>
          </ReviewSection>
          <ReviewSection icon={TriangleAlert} title="最主要的阻力">
            <ul>{review.obstacles.map((item) => <li key={item}>{item}</li>)}</ul>
          </ReviewSection>
          <ReviewSection icon={Target} title="下周先试这一步">
            <p className="review-action">{review.action}</p>
          </ReviewSection>

          <button className={accepted ? "primary-button is-confirmed" : "primary-button"} type="button" onClick={acceptAction} disabled={accepting}>
            {accepting ? <LoaderCircle className="spin" aria-hidden="true" /> : accepted ? <Check aria-hidden="true" /> : null}
            {accepting ? "正在记录" : accepted ? "本周行动已接受" : "开始本周行动"}
          </button>
        </>
      ) : null}
    </section>
  );
}
