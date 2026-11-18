import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionAlternativeLike {
  transcript: string;
}

interface RecognitionResultLike {
  0: RecognitionAlternativeLike;
  isFinal: boolean;
}

interface RecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionConstructor | null {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(onComplete: (text: string) => void) {
  const [supported] = useState(() => Boolean(getConstructor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const callbackRef = useRef(onComplete);
  callbackRef.current = onComplete;

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  const start = useCallback(() => {
    const Constructor = getConstructor();
    if (!Constructor) return false;
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    finalTextRef.current = "";
    setTranscript("");
    setError(null);

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalTextRef.current += text;
        else interim += text;
      }
      setTranscript(`${finalTextRef.current}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "需要允许麦克风权限" : "这次没有听清，可以改用键盘输入");
    };
    recognition.onend = () => {
      setListening(false);
      const finalText = finalTextRef.current.trim();
      if (finalText) callbackRef.current(finalText);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    return true;
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);
  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    finalTextRef.current = "";
    setListening(false);
    setTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}
