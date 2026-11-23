/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  COMMERCIAL_SKIP_DELAY_SECONDS,
  WAZZIMAGIYGG_COMMERCIALS,
  WazzimaCommercial,
  canSkipCommercial,
  getActiveCommercialScene,
  getCommercialById,
  getCommercialRemainingSeconds,
  getPrimaryWazzimaCommercial,
} from '../game/commercials.ts';

interface WazzimaCommercialOverlayProps {
  isOpen: boolean;
  commercial?: WazzimaCommercial;
  onSkipCommercial: () => void;
}

function formatClockSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function pickPortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find(v => v.lang.toLowerCase() === 'pt-br') ??
    voices.find(v => v.lang.toLowerCase().startsWith('pt')) ??
    null
  );
}

export const WazzimaCommercialOverlay: React.FC<WazzimaCommercialOverlayProps> = ({
  isOpen,
  commercial: initialCommercial = getPrimaryWazzimaCommercial(),
  onSkipCommercial,
}) => {
  const [selectedCommercialId, setSelectedCommercialId] = useState<string>(
    initialCommercial.id
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioSuspendedByBrowser, setAudioSuspendedByBrowser] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const skipButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const underscoreTimerRef = useRef<number | null>(null);
  const lastSpokenKeyRef = useRef<string>('');

  const commercial = getCommercialById(selectedCommercialId);
  const skipDelay = commercial.skipDelaySeconds ?? COMMERCIAL_SKIP_DELAY_SECONDS;
  const remainingSeconds = getCommercialRemainingSeconds(elapsedSeconds, skipDelay);
  const canSkip = canSkipCommercial(elapsedSeconds, skipDelay);
  const activeScene = getActiveCommercialScene(commercial, elapsedSeconds);
  const progressRatio = Math.min(1, Math.max(0, elapsedSeconds / commercial.durationSeconds));

  useEffect(() => {
    setSelectedCommercialId(initialCommercial.id);
  }, [initialCommercial.id]);

  // Reset and run 15-second commercial timer when overlay opens
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      lastSpokenKeyRef.current = '';
      return;
    }

    const startedAt = performance.now();
    setElapsedSeconds(0);

    const intervalId = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setElapsedSeconds(Math.min(commercial.durationSeconds, elapsed));
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, commercial.durationSeconds]);

  // Move focus cleanly to "Pular comercial" when the 15s countdown unlocks
  useEffect(() => {
    if (isOpen && canSkip) {
      skipButtonRef.current?.focus();
    }
  }, [isOpen, canSkip]);

  const stopSpeechNarration = useCallback(() => {
    setIsSpeaking(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech cancel errors in restricted environments
      }
    }
  }, []);

  const speakCommercialText = useCallback(
    (text: string) => {
      if (isMuted || !isOpen) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.03;
        utterance.pitch = 1.0;
        utterance.volume = 0.92;
        const ptVoice = pickPortugueseVoice();
        if (ptVoice) {
          utterance.voice = ptVoice;
        }
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isMuted, isOpen]
  );

  // Trigger spoken narration synced with active commercial & scene
  useEffect(() => {
    if (!isOpen || isMuted) {
      stopSpeechNarration();
      lastSpokenKeyRef.current = '';
      return;
    }

    const speakKey = `${commercial.id}:${activeScene.id}`;
    if (lastSpokenKeyRef.current !== speakKey) {
      lastSpokenKeyRef.current = speakKey;
      speakCommercialText(activeScene.spokenText);
    }
  }, [
    isOpen,
    isMuted,
    commercial.id,
    activeScene.id,
    activeScene.spokenText,
    speakCommercialText,
    stopSpeechNarration,
  ]);

  // Stop speech when overlay unmounts
  useEffect(() => {
    return () => {
      stopSpeechNarration();
    };
  }, [stopSpeechNarration]);

  // Commercial Background Sound (kept soft underneath speech narration; completely independent from suspended Game SoundEngine)
  useEffect(() => {
    const cleanupAudio = () => {
      if (underscoreTimerRef.current !== null) {
        window.clearInterval(underscoreTimerRef.current);
        underscoreTimerRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAudioSuspendedByBrowser(false);
    };

    if (!isOpen || isMuted) {
      cleanupAudio();
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        setAudioSuspendedByBrowser(true);
        ctx.resume().then(() => {
          if (ctx.state === 'running') {
            setAudioSuspendedByBrowser(false);
          }
        }).catch(() => {});
      } else {
        setAudioSuspendedByBrowser(false);
      }

      // Background underscore patterns per commercial theme
      const investigativeLead = [293.66, 349.23, 329.63, 293.66, 261.63, 329.63, 220.0, 293.66]; // D minor documentary pulse
      const investigativeBass = [146.83, 146.83, 116.54, 116.54, 130.81, 130.81, 110.0, 146.83];
      const upbeatLead = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33, 659.25]; // C major bright promo
      const upbeatBass = [261.63, 196.0, 261.63, 196.0, 174.61, 220.0, 196.0, 246.94];

      const isInvestigative = commercial.audioTheme === 'investigative';
      const leadNotes = isInvestigative ? investigativeLead : upbeatLead;
      const bassNotes = isInvestigative ? investigativeBass : upbeatBass;
      const stepIntervalMs = isInvestigative ? 520 : 420;
      let step = 0;

      const playUnderscoreSlice = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
        const now = audioCtxRef.current.currentTime;

        const leadOsc = audioCtxRef.current.createOscillator();
        const leadGain = audioCtxRef.current.createGain();
        leadOsc.type = isInvestigative ? 'sine' : 'triangle';
        leadOsc.frequency.setValueAtTime(leadNotes[step % leadNotes.length], now);
        leadGain.gain.setValueAtTime(0.001, now);
        leadGain.gain.exponentialRampToValueAtTime(isInvestigative ? 0.035 : 0.04, now + 0.05);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + (stepIntervalMs / 1000) * 0.9);
        leadOsc.connect(leadGain);
        leadGain.connect(audioCtxRef.current.destination);
        leadOsc.start(now);
        leadOsc.stop(now + stepIntervalMs / 1000);

        const bassOsc = audioCtxRef.current.createOscillator();
        const bassGain = audioCtxRef.current.createGain();
        bassOsc.type = isInvestigative ? 'triangle' : 'sine';
        bassOsc.frequency.setValueAtTime(bassNotes[step % bassNotes.length], now);
        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.exponentialRampToValueAtTime(isInvestigative ? 0.045 : 0.032, now + 0.04);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + (stepIntervalMs / 1000) * 0.92);
        bassOsc.connect(bassGain);
        bassGain.connect(audioCtxRef.current.destination);
        bassOsc.start(now);
        bassOsc.stop(now + stepIntervalMs / 1000);

        step++;
      };

      playUnderscoreSlice();
      underscoreTimerRef.current = window.setInterval(playUnderscoreSlice, stepIntervalMs);
    } catch {
      // Audio playback skipped cleanly if unsupported
    }

    return cleanupAudio;
  }, [isOpen, isMuted, commercial.audioTheme]);

  const handleUnlockAudioGesture = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current
        .resume()
        .then(() => {
          setAudioSuspendedByBrowser(false);
          speakCommercialText(activeScene.spokenText);
        })
        .catch(() => {});
    } else if (audioSuspendedByBrowser) {
      setAudioSuspendedByBrowser(false);
      speakCommercialText(activeScene.spokenText);
    }
  }, [isMuted, audioSuspendedByBrowser, activeScene.spokenText, speakCommercialText]);

  const handleSkipClick = () => {
    if (!canSkip) return;
    stopSpeechNarration();
    onSkipCommercial();
  };

  if (!isOpen) {
    return null;
  }

  const isAmberTheme = commercial.accentColor === 'amber';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comercial ${commercial.ecosystem}: ${commercial.siteName}`}
      onPointerDown={() => {
        if (audioSuspendedByBrowser && !isMuted) {
          handleUnlockAudioGesture();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950/98 p-3 sm:p-6 text-stone-100 select-none"
    >
      <div className="w-full max-w-4xl flex flex-col gap-3">
        {/* YouTube-Style 16:9 In-Stream Commercial Player */}
        <div className="relative w-full aspect-video min-h-[270px] rounded-xl overflow-hidden bg-[#0b1018] border border-stone-800 shadow-2xl flex flex-col justify-between">
          {/* Dynamic Atmospheric Backdrop Layer per Commercial */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background: isAmberTheme
                ? 'radial-gradient(circle at 18% 22%, rgba(245, 158, 11, 0.18), transparent 46%), radial-gradient(circle at 84% 72%, rgba(239, 68, 68, 0.14), transparent 50%), linear-gradient(135deg, #0b0e14 0%, #17131a 55%, #090b10 100%)'
                : 'radial-gradient(circle at 18% 22%, rgba(16, 185, 129, 0.18), transparent 46%), radial-gradient(circle at 84% 72%, rgba(250, 204, 21, 0.14), transparent 50%), linear-gradient(135deg, #0b1018 0%, #101926 55%, #090d14 100%)',
            }}
          />

          {/* Top Bar Inside Video Frame: Ecosystem Brand & Commercial Switcher */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 pt-3 sm:pt-4 text-xs text-stone-300">
            <span className="font-semibold tracking-tight text-stone-100">
              {commercial.ecosystem} Ecosystem
            </span>

            {/* Interactive Commercial Selector (WikiMaker / Dossiê Wikipédia) */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-black/55 border border-stone-800">
              {WAZZIMAGIYGG_COMMERCIALS.map((item, idx) => {
                const selected = item.id === commercial.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      lastSpokenKeyRef.current = '';
                      setSelectedCommercialId(item.id);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-stone-800 text-white'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {idx + 1}. {item.siteName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Animated Commercial Stage */}
          <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 items-center gap-4 sm:gap-6 px-5 sm:px-8 py-3 sm:py-4">
            {/* Editorial Copy + Synchronized Narration Subtitle */}
            <div className="md:col-span-7 flex flex-col items-start text-left">
              <span
                className={`text-[11px] sm:text-xs font-medium tracking-wide mb-1.5 ${
                  isAmberTheme ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {activeScene.kicker}
              </span>
              <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight leading-tight max-w-xl [text-wrap:balance]">
                {activeScene.caption}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed max-w-lg">
                {activeScene.detail}
              </p>

              {/* Spoken Narration Closed Caption Line */}
              <div className="mt-3 flex items-start gap-2 text-[11px] sm:text-xs text-stone-200 bg-black/45 border border-stone-800/80 rounded-md px-3 py-1.5 max-w-lg">
                <Volume2
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    isMuted
                      ? 'text-stone-500'
                      : isSpeaking
                      ? 'text-yellow-400'
                      : 'text-stone-400'
                  }`}
                />
                <span className="leading-snug">
                  “{activeScene.spokenText}”
                </span>
              </div>

              {/* Scene Progress Track */}
              <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-stone-400 tabular-nums">
                {commercial.scenes.map(scene => {
                  const isActive = scene.id === activeScene.id;
                  return (
                    <span
                      key={scene.id}
                      className={`h-1 rounded-full transition-all duration-200 ${
                        isActive ? 'w-7 bg-yellow-400' : 'w-3 bg-stone-700'
                      }`}
                    />
                  );
                })}
                <span className="ml-1">
                  {commercial.scenes.findIndex(s => s.id === activeScene.id) + 1}/{commercial.scenes.length}
                </span>
              </div>
            </div>

            {/* Right Column: Site Showcase Preview */}
            <div className="hidden md:flex md:col-span-5 flex-col rounded-lg bg-stone-900/95 border border-stone-700/80 overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-3 py-2 bg-stone-950 border-b border-stone-800 text-[11px] font-mono text-stone-300">
                <span className="flex items-center gap-1.5 truncate">
                  <Globe
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isAmberTheme ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  />
                  <span className="truncate">{commercial.siteUrl}</span>
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2.5 text-left">
                <div
                  className={`flex items-center gap-2 font-semibold text-sm ${
                    isAmberTheme ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {isAmberTheme ? (
                    <FileText className="w-4 h-4 shrink-0" />
                  ) : (
                    <BookOpen className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{activeScene.previewTitle}</span>
                </div>
                <div className="space-y-2 border-t border-stone-800 pt-2.5">
                  {activeScene.previewLines.map((line, i) => (
                    <p key={i} className="text-xs text-stone-300 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] font-mono text-stone-400">
                  <span className="truncate">{commercial.displayUrl}</span>
                  <span className="text-yellow-400 font-semibold shrink-0">WazzimaGiygg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom YouTube-Style Scrim, Controls, Yellow Progress Bar & "Pular comercial" */}
          <div className="relative z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-6 pb-2.5 px-3 sm:px-5 flex items-end justify-between gap-3">
            {/* Bottom-Left: Ad Metadata + External Link + Audio & Speech Toggle */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-stone-200 font-sans tabular-nums">
                <span className="font-semibold text-yellow-400">Anúncio</span>
                <span aria-hidden="true" className="text-stone-500">·</span>
                <span>
                  {formatClockSeconds(elapsedSeconds)} / {formatClockSeconds(commercial.durationSeconds)}
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-stone-500">·</span>
                <span className="hidden sm:inline text-stone-300 truncate max-w-[200px]">
                  {commercial.displayUrl}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={commercial.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{commercial.ctaLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (audioSuspendedByBrowser && !isMuted) {
                      handleUnlockAudioGesture();
                    } else {
                      setIsMuted(prev => !prev);
                    }
                  }}
                  aria-label={
                    isMuted
                      ? 'Ativar som de fundo e narração'
                      : audioSuspendedByBrowser
                      ? 'Clique para ativar áudio e narração'
                      : 'Silenciar som de fundo e narração'
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded bg-black/75 hover:bg-stone-800 border border-white/20 text-stone-100 text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-stone-400" />
                      <span className="hidden sm:inline">Sem som</span>
                    </>
                  ) : audioSuspendedByBrowser ? (
                    <>
                      <Volume2 className="w-4 h-4 text-yellow-400" />
                      <span>Ativar som</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline">Som + Voz</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom-Right: YouTube-Style "Pular comercial" Box */}
            <div className="shrink-0 mb-1">
              <button
                ref={skipButtonRef}
                type="button"
                disabled={!canSkip}
                aria-disabled={!canSkip}
                onClick={handleSkipClick}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 min-h-[44px] rounded-l-md rounded-r-none sm:rounded-md border text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap shrink-0 transition-all ${
                  canSkip
                    ? 'bg-black/90 hover:bg-stone-800 border-white/70 text-white shadow-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-yellow-400'
                    : 'bg-black/80 border-white/25 text-stone-300 cursor-not-allowed'
                }`}
              >
                {canSkip ? (
                  <>
                    <span>Pular comercial</span>
                    <SkipForward className="w-4 h-4 fill-white" />
                  </>
                ) : (
                  <span>Pular comercial em {remainingSeconds}s</span>
                )}
              </button>
            </div>
          </div>

          {/* YouTube Yellow Ad Progress Bar */}
          <div
            aria-hidden="true"
            className="relative z-20 w-full h-1 bg-stone-800 overflow-hidden"
          >
            <div
              className="w-full h-full bg-yellow-400 origin-left transition-transform duration-100 ease-linear motion-reduce:transition-none"
              style={{ transform: `scaleX(${progressRatio})` }}
            />
          </div>
        </div>

        {/* Clean YouTube Companion Banner Below Player */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-stone-900/90 border border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-base shrink-0 ${
                isAmberTheme ? 'bg-amber-600' : 'bg-emerald-700'
              }`}
            >
              W
            </div>
            <div className="min-w-0 text-left">
              <h3 className="text-sm font-semibold text-white truncate">
                {commercial.headline}
              </h3>
              <p className="text-xs text-stone-400 truncate">
                {commercial.ecosystem} · {commercial.siteUrl} · Som do jogo suspenso durante o comercial
              </p>
            </div>
          </div>

          <a
            href={commercial.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <span>Abrir site</span>
            <ExternalLink className={`w-3.5 h-3.5 ${isAmberTheme ? 'text-amber-400' : 'text-emerald-400'}`} />
          </a>
        </div>
      </div>
    </div>
  );
};
