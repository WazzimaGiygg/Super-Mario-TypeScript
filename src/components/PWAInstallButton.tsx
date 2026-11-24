/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Smartphone, Share, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!canInstall && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={isIOS ? 'Instalar no iPhone / iPad' : 'Instalar aplicativo no smartphone ou desktop'}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-400/75 bg-amber-950/85 hover:bg-amber-900 text-amber-200 font-mono font-bold transition cursor-pointer shadow ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
        } ${className}`}
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        )}
        <span>{compact ? 'App' : 'Instalar App'}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Como instalar no iPhone ou iPad"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-amber-500/70 bg-stone-900 p-5 text-left text-stone-100 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-['Press_Start_2P',monospace] text-xs text-amber-300">
                    INSTALAR NO iOS
                  </h3>
                  <p className="mt-1 text-xs text-stone-400">
                    Jogue em tela cheia com ícone na tela inicial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fechar guia de instalação"
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="mt-4 space-y-2.5 text-xs text-stone-200 font-mono">
              <li className="flex items-start gap-2 rounded-lg bg-stone-800/70 p-2.5 border border-stone-700">
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold shrink-0">1</span>
                <span>
                  Toque no botão <Share className="inline w-3.5 h-3.5 text-sky-400 mx-0.5" />{' '}
                  <strong>Compartilhar</strong> na barra do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-stone-800/70 p-2.5 border border-stone-700">
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold shrink-0">2</span>
                <span>
                  Role e escolha <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-lg bg-stone-800/70 p-2.5 border border-stone-700">
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold shrink-0">3</span>
                <span>
                  Toque em <Check className="inline w-3.5 h-3.5 text-emerald-400 mx-0.5" />{' '}
                  <strong>Adicionar</strong> para abrir como aplicativo.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] font-bold cursor-pointer transition"
            >
              ENTENDI
            </button>
          </div>
        </div>
      )}
    </>
  );
};
