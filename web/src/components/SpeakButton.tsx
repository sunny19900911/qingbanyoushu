import { useEffect, useId, useState } from "react";
import { Square, Volume2 } from "lucide-react";

let activeId = "";
let generation = 0;
let currentUtterance: SpeechSynthesisUtterance | null = null;
const listeners = new Set<() => void>();
function announce() { listeners.forEach(f => f()); }
function stop() {
  generation++;
  window.speechSynthesis?.cancel();
  currentUtterance = null; activeId = ""; announce();
}
export function SpeakButton({ text, label = "听讲解" }: { text: string; label?: string }) {
  const id = useId();
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.85);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => setPlaying(activeId === id);
    listeners.add(update);
    return () => { listeners.delete(update); if (activeId === id) stop(); };
  }, [id]);
  const play = () => {
    if (activeId === id) { stop(); return; }
    setError("");
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setError("当前浏览器不支持朗读，可阅读文字讲解，或用手机系统朗读。"); return;
    }
    stop();
    const mine = generation;
    activeId = id; announce();
    const chunks = text.match(/[^。！？\n]{1,100}[。！？\n]?/g) || [text];
    const next = (index: number) => {
      if (mine !== generation) return;
      if (index >= chunks.length) { activeId = ""; currentUtterance = null; announce(); return; }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      currentUtterance = utterance;
      utterance.lang = "zh-CN"; utterance.rate = rate;
      const voice = window.speechSynthesis.getVoices().find(v => /^zh[-_]CN/i.test(v.lang)) || window.speechSynthesis.getVoices().find(v => /^zh/i.test(v.lang));
      if (voice) utterance.voice = voice;
      utterance.onend = () => next(index + 1);
      utterance.onerror = e => { if (mine !== generation) return; stop(); if (e.error !== "canceled" && e.error !== "interrupted") setError("暂时无法播放，请查看文字讲解或换浏览器重试。"); };
      window.speechSynthesis.speak(utterance);
    };
    next(0);
  };
  return <div className="speak-controls">
    <button type="button" className={playing ? "speak-button is-playing" : "speak-button"} onClick={play} aria-label={playing ? "停止朗读" : label} aria-pressed={playing}>{playing ? <Square size={16} /> : <Volume2 size={16} />}{playing ? "停止" : label.endsWith("讲解") ? "听讲解" : label}</button>
    <select aria-label="朗读语速" value={rate} onChange={e => { setRate(Number(e.target.value)); if (activeId === id) stop(); }}><option value={0.7}>慢一点</option><option value={0.85}>舒缓</option><option value={1}>正常</option></select>
    {error ? <small role="status">{error}</small> : null}
  </div>;
}
