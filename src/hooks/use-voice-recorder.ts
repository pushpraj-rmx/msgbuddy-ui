"use client";

import { useState, useRef, useCallback } from "react";

type RecorderState = "idle" | "recording" | "stopped";

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const resolveRef = useRef<((file: File) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const stop = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        reject(new Error("Not recording"));
        return;
      }
      resolveRef.current = resolve;
      rejectRef.current = reject;
      recorder.stop();
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      const msg = "Microphone permission denied.";
      setError(msg);
      throw new Error(msg);
    }

    streamRef.current = stream;

    // Pick the best supported MIME type for WhatsApp
    // Preference order: ogg/opus → mp4 (AAC) → webm/opus → webm
    // audio/webm is not supported by WhatsApp Cloud API, so prefer mp4 over it
    const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setState("stopped");

      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `voice-note.${ext}`, { type: mime });

      resolveRef.current?.(file);
      resolveRef.current = null;
      rejectRef.current = null;
      chunksRef.current = [];
    };

    recorder.onerror = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setState("idle");
      const err = new Error("Recording error");
      setError(err.message);
      rejectRef.current?.(err);
      resolveRef.current = null;
      rejectRef.current = null;
    };

    recorder.start(100); // collect data every 100ms
    setState("recording");
    startTimeRef.current = Date.now();
    setDurationMs(0);
    timerRef.current = setInterval(() => {
      setDurationMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Discard: clear resolve before stopping so onstop doesn't resolve
      resolveRef.current = null;
      rejectRef.current = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setState("idle");
    setDurationMs(0);
    setError(null);
  }, []);

  return {
    start,
    stop,
    cancel,
    recording: state === "recording",
    durationMs,
    error,
  };
}
