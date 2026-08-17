'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2, X, Check } from 'lucide-react';

interface VoiceRecorderButtonProps {
  onTranscribed: (text: string) => void;
  className?: string;
  buttonVariant?: 'icon' | 'pill' | 'expanded';
  placeholder?: string;
}

export function VoiceRecorderButton({
  onTranscribed,
  className = '',
  buttonVariant = 'icon',
}: VoiceRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clear timer and stream on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('Audio recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        
        // Stop all audio tracks to turn off hardware microphone indicator
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (audioBlob.size > 0 && !isCancelledRef.current) {
          await transcribeAudio(audioBlob);
        }
        isCancelledRef.current = false;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Slice data every 250ms

      setIsRecording(true);
      setRecordSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access was denied. Please allow mic permissions.');
      } else {
        setErrorMsg('Could not start recording. Please check your microphone.');
      }
      setIsRecording(false);
    }
  };

  const isCancelledRef = useRef(false);

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
    audioChunksRef.current = [];
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', blob);

      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to transcribe audio.');
      }

      if (data.text) {
        onTranscribed(data.text);
      }
    } catch (err: any) {
      console.error('Transcription failed:', err);
      setErrorMsg(err.message || 'Transcription failed. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsTranscribing(false);
      setRecordSeconds(0);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  if (isTranscribing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        <span className="font-mono text-[11px]">Transcribing with AI...</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-950/80 border border-rose-600/60 shadow-lg animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="font-mono text-xs font-bold text-rose-300">
            {formatTime(recordSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={cancelRecording}
            title="Cancel recording"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-rose-900/60 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={stopRecording}
            title="Done (Transcribe voice)"
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-colors"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span className="text-[11px]">Done</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={startRecording}
        title="Voice to text (Hold or tap to speak)"
        className={`flex items-center gap-1.5 transition-all cursor-pointer ${
          buttonVariant === 'pill'
            ? 'px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 text-xs font-medium'
            : 'p-2 rounded-xl text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80'
        } ${className}`}
      >
        <Mic className="w-4 h-4" />
        {buttonVariant === 'pill' && <span>Voice Note</span>}
      </button>

      {errorMsg && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 text-[11px] whitespace-nowrap shadow-xl z-30">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
