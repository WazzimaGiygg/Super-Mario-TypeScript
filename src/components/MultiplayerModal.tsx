import React, { useState, useEffect } from 'react';
import { multiplayerClient } from '../game/multiplayer.ts';
import { MultiplayerStatus, PlayerCharacter } from '../game/types.ts';
import { Users, Wifi, WifiOff, Copy, Check, Send, Sparkles, User, Globe } from 'lucide-react';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<MultiplayerStatus>(multiplayerClient.getStatus());
  const [serverAddress, setServerAddress] = useState(status.serverAddress);
  const [roomId, setRoomId] = useState(status.roomId);
  const [playerName, setPlayerName] = useState(status.playerName);
  const [character, setCharacter] = useState<PlayerCharacter>(status.character);
  const [copied, setCopied] = useState(false);
  const [chatLog, setChatLog] = useState<{ name: string; character: PlayerCharacter; text: string; time: number }[]>([]);
  const [customChat, setCustomChat] = useState('');

  useEffect(() => {
    const unsub = multiplayerClient.subscribe((s) => {
      setStatus(s);
    });
    const unsubChat = multiplayerClient.onChat((msg) => {
      setChatLog((prev) => [...prev.slice(-15), msg]);
    });
    return () => {
      unsub();
      unsubChat();
    };
  }, []);

  // Update initial fields from URL if room parameter is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const urlHost = params.get('host');
      if (urlRoom) {
        setRoomId(urlRoom);
        multiplayerClient.setConfig({ roomId: urlRoom });
      }
      if (urlHost) {
        setServerAddress(urlHost);
        multiplayerClient.setConfig({ serverAddress: urlHost });
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleCharacterSelect = (char: PlayerCharacter) => {
    setCharacter(char);
    const newName = char === 'wazzima' ? 'WazzimaGiygg' : 'Mario';
    setPlayerName(newName);
    multiplayerClient.setConfig({ character: char, playerName: newName });
  };

  const handleConnect = () => {
    multiplayerClient.setConfig({
      serverAddress,
      roomId,
      playerName,
      character,
    });
    multiplayerClient.connect();
  };

  const handleDisconnect = () => {
    multiplayerClient.disconnect();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      url.searchParams.set('host', serverAddress);
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendQuickChat = (text: string) => {
    multiplayerClient.sendChatMessage(text);
  };

  const handleSendCustomChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customChat.trim()) return;
    multiplayerClient.sendChatMessage(customChat.trim());
    setCustomChat('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-slate-900 border-4 border-emerald-500 rounded-lg p-5 text-white shadow-2xl font-mono max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-500/50 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold tracking-wider text-emerald-400">
              JOGAR POR IP (MULTIPLAYER)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 cursor-pointer"
          >
            ✕ FECHAR
          </button>
        </div>

        {/* Character Selection: WazzimaGiygg vs Mario */}
        <div className="mb-5">
          <label className="block text-xs uppercase tracking-wider text-slate-300 font-bold mb-2">
            1. ESCOLHA SEU PERSONAGEM:
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* WazzimaGiygg (Mario Verde) */}
            <button
              type="button"
              onClick={() => handleCharacterSelect('wazzima')}
              className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                character === 'wazzima'
                  ? 'border-emerald-400 bg-emerald-950/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/50'
                  : 'border-slate-700 bg-slate-800/60 hover:border-emerald-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block border border-white"></span>
                  WazzimaGiygg
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  MARIO VERDE
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">
                O herói esmeralda com macacão clássico e visual icônico em verde vibrante!
              </p>
            </button>

            {/* Mario (Clássico) */}
            <button
              type="button"
              onClick={() => handleCharacterSelect('mario')}
              className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                character === 'mario'
                  ? 'border-red-400 bg-red-950/80 shadow-[0_0_15px_rgba(239,68,68,0.3)] ring-2 ring-red-500/50'
                  : 'border-slate-700 bg-slate-800/60 hover:border-red-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-red-400 flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block border border-white"></span>
                  Mario
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                  CLÁSSICO
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">
                O lendário encanador de boné vermelho do Reino dos Cogumelos.
              </p>
            </button>
          </div>
        </div>

        {/* Connection Form: Server IP and Room Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              IP / HOST DO SERVIDOR:
            </label>
            <input
              type="text"
              value={serverAddress}
              onChange={(e) => setServerAddress(e.target.value)}
              disabled={status.connected}
              placeholder="ex: 192.168.1.50:3000 ou host"
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') setServerAddress(window.location.host);
              }}
              disabled={status.connected}
              className="mt-1 text-[10px] text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
            >
              Usar Host Atual ({typeof window !== 'undefined' ? window.location.host : 'localhost'})
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              CÓDIGO DA SALA:
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              disabled={status.connected}
              placeholder="ex: SALA-1 ou WAZZIMA"
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">
              Jogadores com a mesma sala jogam juntos!
            </span>
          </div>
        </div>

        {/* Player Name */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            SEU NOME / APELIDO NO JOGO:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            disabled={status.connected}
            maxLength={12}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
          />
        </div>

        {/* Status Box */}
        <div className={`p-3 rounded-lg border mb-4 text-xs ${
          status.connected
            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
            : status.connecting
            ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
            : status.error
            ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
            : 'bg-slate-800 border-slate-700 text-slate-300'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold flex items-center gap-2">
              {status.connected ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                  CONECTADO NA SALA [{status.roomId}]
                </>
              ) : status.connecting ? (
                <>
                  <Wifi className="w-4 h-4 text-amber-400 animate-spin" />
                  CONECTANDO AO SERVIDOR...
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  DESCONECTADO
                </>
              )}
            </span>
            {status.connected && (
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold text-[10px]">
                {status.playerCount} JOGADOR(ES)
              </span>
            )}
          </div>
          {status.error && (
            <p className="text-[11px] text-rose-300 mt-1">{status.error}</p>
          )}
          {status.connected && (
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Você está jogando como <strong className="text-white">{status.playerName}</strong> ({status.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'}).
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {!status.connected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={status.connecting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              {status.connecting ? 'CONECTANDO...' : 'ENTRAR NA SALA / CONECTAR'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors cursor-pointer shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2"
            >
              <WifiOff className="w-4 h-4" />
              DESCONECTAR
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs py-2.5 px-3 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copiar link com IP e sala para convidar amigo"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'LINK COPIADO!' : 'CONVIDAR AMIGO'}
          </button>
        </div>

        {/* Retro Quick Chat & Emotes (When connected) */}
        {status.connected && (
          <div className="border-t border-slate-800 pt-3 mt-3">
            <span className="block text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              SINAIS E CHAT RÁPIDO ENTRE OS PLAYERS:
            </span>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['E aí parceiro!', 'Vamos juntos!', 'Cuidado!', '1-UP!', 'Espere por mim!', 'Boa jogada!'].map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => handleSendQuickChat(msg)}
                  className="bg-slate-800 hover:bg-emerald-900/40 hover:border-emerald-500 border border-slate-700 text-[10px] text-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  {msg}
                </button>
              ))}
            </div>

            {/* Custom Chat Input */}
            <form onSubmit={handleSendCustomChat} className="flex gap-2">
              <input
                type="text"
                value={customChat}
                onChange={(e) => setCustomChat(e.target.value)}
                placeholder="Enviar mensagem para o parceiro..."
                maxLength={40}
                className="flex-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                ENVIAR
              </button>
            </form>

            {/* Chat History */}
            {chatLog.length > 0 && (
              <div className="mt-2 bg-slate-950/70 border border-slate-800 rounded p-2 max-h-24 overflow-y-auto space-y-1">
                {chatLog.map((c, i) => (
                  <div key={i} className="text-[10px] flex items-center gap-1.5">
                    <span className={c.character === 'wazzima' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      [{c.name}]:
                    </span>
                    <span className="text-slate-200">{c.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex flex-col gap-1">
          <p>
            🎮 <strong>Como jogar com seu amigo:</strong>
          </p>
          <p>
            1. Um jogador entra como <strong>WazzimaGiygg</strong> (Mario Verde) e o outro como <strong>Mario</strong>.
          </p>
          <p>
            2. Ambos usam o mesmo IP/Host e o mesmo Código de Sala. Vocês se verão e jogarão na mesma tela em tempo real!
          </p>
        </div>
      </div>
    </div>
  );
};
