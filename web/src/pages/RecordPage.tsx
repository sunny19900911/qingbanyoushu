import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Footprints,
  Keyboard,
  LoaderCircle,
  Mic,
  MoonStar,
  NotebookText,
  Scale,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import type {
  AppUser,
  DailyFeedback,
  InputMode,
  ParsedEntryPreview,
  UserId,
} from "../../shared/types";
import { api } from "../api";
import { UserSwitcher } from "../components/UserSwitcher";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Phase = "idle" | "parsing" | "confirm" | "saving" | "saved";

function todayLabel(): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date());
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  return `${month}月${day}日 ${weekday}`;
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
}) {
  return (
    <div className="summary-row">
      <Icon aria-hidden="true" />
      <span className="summary-row__label">{label}</span>
      <span className={value === "未识别" ? "summary-row__value is-muted" : "summary-row__value"}>{value}</span>
    </div>
  );
}

export function RecordPage({
  users,
  userId,
  onUserChange,
  modelEnabled,
  onSaved,
}: {
  users: AppUser[];
  userId: UserId;
  onUserChange: (userId: UserId) => void;
  modelEnabled: boolean;
  onSaved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [preview, setPreview] = useState<ParsedEntryPreview | null>(null);
  const [feedback, setFeedback] = useState<DailyFeedback | null>(null);
  const [followup, setFollowup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const beginParse = async (rawText: string, inputMode: InputMode) => {
    const value = rawText.trim();
    if (!value) return;
    setKeyboardOpen(false);
    setError(null);
    setPhase("parsing");
    try {
      const result = await api.parse(userId, value, inputMode);
      setPreview(result);
      setPhase("confirm");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "这次没有识别成功");
      setPhase("idle");
    }
  };

  const speech = useSpeechRecognition((text) => void beginParse(text, "voice"));

  useEffect(() => {
    speech.reset();
    setPhase("idle");
    setPreview(null);
    setFeedback(null);
    setTypedText("");
    setKeyboardOpen(false);
  }, [userId]);

  const contextValue = useMemo(
    () => (preview?.contextTags.length ? preview.contextTags.join("、") : "未识别"),
    [preview],
  );

  const reset = () => {
    speech.reset();
    setPhase("idle");
    setPreview(null);
    setFeedback(null);
    setTypedText("");
    setFollowup("");
    setError(null);
  };

  const confirmEntry = async () => {
    if (!preview) return;
    setPhase("saving");
    setError(null);
    try {
      await api.saveEntry(userId, preview);
      const result = await api.feedback(userId, preview);
      setFeedback(result);
      setPhase("saved");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "暂时无法存档");
      setPhase("confirm");
    }
  };

  const answerFollowup = () => {
    if (!preview || !followup.trim()) return;
    void beginParse(`${preview.rawText}。补充：${followup.trim()}`, preview.inputMode);
    setFollowup("");
  };

  if (phase === "confirm" || phase === "saving") {
    return (
      <section className="page page--confirm">
        <button className="icon-button back-button" type="button" onClick={reset} aria-label="返回记录首页">
          <ArrowLeft />
        </button>
        <h1>我听到的是</h1>
        <div className="transcript-box">{preview?.rawText}</div>

        <div className="summary-list" aria-label="识别结果">
          <SummaryRow
            icon={Scale}
            label="体重"
            value={preview?.weightKg !== null && preview?.weightKg !== undefined ? `${preview.weightKg} kg` : "未识别"}
          />
          <SummaryRow icon={Utensils} label="饮食" value={preview?.dietText ?? "未识别"} />
          <SummaryRow icon={Footprints} label="运动" value={preview?.activityText ?? "未识别"} />
          <SummaryRow icon={NotebookText} label="情境" value={contextValue} />
          {preview?.sleepText ? <SummaryRow icon={MoonStar} label="睡眠" value={preview.sleepText} /> : null}
        </div>

        {preview?.followupQuestion ? (
          <div className="followup-box">
            <strong>想确认一次</strong>
            <p>{preview.followupQuestion}</p>
            <div className="followup-box__row">
              <input
                value={followup}
                onChange={(event) => setFollowup(event.target.value)}
                placeholder="补充一句话"
                aria-label="补充信息"
              />
              <button type="button" onClick={answerFollowup}>
                确认
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="inline-error">{error}</p> : null}
        <div className="confirm-actions">
          <button className="primary-button" type="button" onClick={confirmEntry} disabled={phase === "saving"}>
            {phase === "saving" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {phase === "saving" ? "正在存档" : "确认存档"}
          </button>
          <button className="secondary-button" type="button" onClick={reset} disabled={phase === "saving"}>
            再说一次
          </button>
          <p className="confirm-note">
            {preview?.parserMode === "deepseek" ? "DeepSeek 已结构化" : modelEnabled ? "本次使用本地兜底解析" : "本地规则解析"}
            · 如有关键歧义，最多追问一次
          </p>
        </div>
      </section>
    );
  }

  if (phase === "saved") {
    return (
      <section className="page saved-page">
        <div className="saved-mark" aria-hidden="true">
          <Check />
        </div>
        <h1>今天已经存好了</h1>
        <p className="saved-page__lead">原始文字和确认后的字段都已进入本机原型档案。</p>
        <div className="feedback-section">
          <div>
            <span className="feedback-section__icon"><Sparkles aria-hidden="true" /></span>
            <h2>今天值得保留</h2>
            <p>{feedback?.preserve}</p>
          </div>
          <div>
            <span className="feedback-section__icon"><NotebookText aria-hidden="true" /></span>
            <h2>下一步的小动作</h2>
            <p>{feedback?.nextAction}</p>
          </div>
        </div>
        <p className="source-note">依据：{feedback?.sourceIds.join(" · ")}</p>
        <p className="boundary-note">{feedback?.disclaimer}</p>
        <button className="primary-button" type="button" onClick={reset}>
          完成
        </button>
      </section>
    );
  }

  return (
    <section className="page record-page">
      <header className="page-header">
        <span className="date-label">{todayLabel()}</span>
        <UserSwitcher users={users} value={userId} onChange={onUserChange} />
      </header>

      <div className="record-intro">
        <h1>今天想记录什么？</h1>
        <p>体重、饮食、运动，想到什么就说什么</p>
      </div>

      <div className={speech.listening ? "voice-area is-listening" : "voice-area"}>
        <div className="voice-rings" aria-hidden="true" />
        <button
          type="button"
          className="voice-button"
          onClick={() => {
            if (speech.listening) speech.stop();
            else if (!speech.start()) setKeyboardOpen(true);
          }}
          aria-label={speech.listening ? "结束语音记录" : "开始语音记录"}
        >
          {phase === "parsing" ? <LoaderCircle className="spin" /> : <Mic />}
        </button>
        <strong>{phase === "parsing" ? "正在整理" : speech.listening ? "再点一下结束" : "点一下开始说话"}</strong>
        {speech.listening && speech.transcript ? <p className="live-transcript">{speech.transcript}</p> : null}
      </div>

      <button className="keyboard-link" type="button" onClick={() => setKeyboardOpen(true)}>
        <Keyboard aria-hidden="true" />
        不方便说？键盘输入
      </button>

      {speech.error || error ? <p className="inline-error record-error">{speech.error || error}</p> : null}

      {keyboardOpen ? (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setKeyboardOpen(false)}>
          <div className="input-sheet" role="dialog" aria-modal="true" aria-labelledby="input-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="input-sheet__header">
              <h2 id="input-title">用一句话记录今天</h2>
              <button className="icon-button" type="button" onClick={() => setKeyboardOpen(false)} aria-label="关闭">
                <X />
              </button>
            </div>
            <textarea
              autoFocus
              rows={6}
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              placeholder="例如：今天早上58.6公斤，中午吃了牛肉面，晚上走了40分钟……"
            />
            {!speech.supported ? <p className="input-hint">当前浏览器不支持直接语音转写，键盘输入仍可完整体验。</p> : null}
            <button
              className="primary-button"
              type="button"
              disabled={typedText.trim().length < 2}
              onClick={() => void beginParse(typedText, "text")}
            >
              整理这条记录
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
