import React, { useState, useEffect } from 'react';
import { multiplayerClient } from '../game/multiplayer.ts';
import { MultiplayerStatus, PlayerCharacter } from '../game/types.ts';
import {
  Users,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Send,
  Sparkles,
  User,
  Globe,
  Database,
  LogIn,
  LogOut,
  Plus,
  Crown,
} from 'lucide-react';

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
  const [loggingIn, setLoggingIn] = useState(false);
  const [chatLog, setChatLog] = useState<{ name: string; character: PlayerCharacter; text: string; time: number }[]>([]);
  const [customChat, setCustomChat] = useState('');

  useEffect(() => {
    const unsub = multiplayerClient.subscribe((s) => {
      setStatus(s);
      if (s.authUser && (playerName === 'WazzimaGiygg' || playerName === 'Mario')) {
        setPlayerName(s.playerName);
      }
    });
    const unsubChat = multiplayerClient.onChat((msg) => {
      setChatLog((prev) => [...prev.slice(-15), msg]);
    });
    return () => {
      unsub();
      unsubChat();
    };
  }, [playerName]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const urlHost = params.get('host');
      const urlMode = params.get('mode');
      if (urlRoom) {
        setRoomId(urlRoom.toUpperCase());
        multiplayerClient.setConfig({ roomId: urlRoom });
      }
      if (urlHost) {
        setServerAddress(urlHost);
        multiplayerClient.setConfig({ serverAddress: urlHost });
      }
      if (urlMode === 'websocket') {
        multiplayerClient.setConfig({ transport: 'websocket' });
      }
    }
  }, []);

  if (!isOpen) return null;

  const isFirebaseMode = status.transport === 'firebase';

  const handleCharacterSelect = (char: PlayerCharacter) => {
    setCharacter(char);
    if (!status.authUser) {
      const newName = char === 'wazzima' ? 'WazzimaGiygg' : 'Mario';
      setPlayerName(newName);
      multiplayerClient.setConfig({ character: char, playerName: newName });
    } else {
      multiplayerClient.setConfig({ character: char });
    }
  };

  const handleGoogleSignIn = async () => {
    setLoggingIn(true);
    await multiplayerClient.loginWithGoogle();
    setLoggingIn(false);
  };

  const handleGoogleSignOut = async () => {
    await multiplayerClient.logoutGoogle();
  };

  const handleGenerateRoomCode = () => {
    const code = `SALA-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomId(code);
    multiplayerClient.setConfig({ roomId: code });
  };

  const handleConnect = (overrideRoomId?: string) => {
    const targetRoom = overrideRoomId || roomId;
    if (overrideRoomId) {
      setRoomId(overrideRoomId);
    }
    multiplayerClient.setConfig({
      serverAddress,
      roomId: targetRoom,
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
      if (status.transport === 'websocket') {
        url.searchParams.set('mode', 'websocket');
        url.searchParams.set('host', serverAddress);
      } else {
        url.searchParams.delete('mode');
        url.searchParams.delete('host');
      }
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
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-wider text-emerald-400">
                MULTIPLAYER ONLINE
              </h2>
              <p className="text-[10px] text-slate-400">
                Hospedado no Firebase Firestore com Login Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 cursor-pointer"
          >
            ✕ FECHAR
          </button>
        </div>

        {/* Transport Selector Tabs: Firebase Google vs IP LAN */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            disabled={status.connected}
            onClick={() => multiplayerClient.setConfig({ transport: 'firebase' })}
            className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
              isFirebaseMode
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Firebase (Login Google)
          </button>
          <button
            type="button"
            disabled={status.connected}
            onClick={() => multiplayerClient.setConfig({ transport: 'websocket' })}
            className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
              !isFirebaseMode
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            IP Local (WebSocket)
          </button>
        </div>

        {/* Google Auth Card (Firebase Mode) */}
        {isFirebaseMode && (
          <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-800/70">
            {!status.authUser ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    Entre com sua Conta Google
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Necessário para criar ou entrar em salas hospedadas no Firebase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loggingIn}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-sans font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.37 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  {loggingIn ? 'CONECTANDO...' : 'ENTRAR COM GOOGLE'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {status.authUser.photoUrl ? (
                    <img
                      src={status.authUser.photoUrl}
                      alt={status.authUser.displayName}
                      className="w-9 h-9 rounded-full border-2 border-emerald-400 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {status.authUser.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-300 truncate">
                      {status.authUser.displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {status.authUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-[10px] text-slate-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  SAIR
                </button>
              </div>
            )}
          </div>
        )}

        {/* Character Selection: WazzimaGiygg vs Mario */}
        <div className="mb-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs sm:text-sm text-emerald-400 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white"></span>
                  WazzimaGiygg
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  VERDE
                </span>
              </div>
              <p className="text-[10px] text-slate-300 line-clamp-2">
                O herói esmeralda com macacão clássico em verde vibrante!
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs sm:text-sm text-red-400 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white"></span>
                  Mario
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                  CLÁSSICO
                </span>
              </div>
              <p className="text-[10px] text-slate-300 line-clamp-2">
                O lendário encanador de boné vermelho do Reino dos Cogumelos.
              </p>
            </button>
          </div>
        </div>

        {/* Room Code & Nickname / Server IP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {!isFirebaseMode && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                IP / HOST DO SERVIDOR:
              </label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                disabled={status.connected}
                placeholder="ex: 192.168.1.50:3000"
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                CÓDIGO DA SALA:
              </span>
              {!status.connected && (
                <button
                  type="button"
                  onClick={handleGenerateRoomCode}
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Nova Sala
                </button>
              )}
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              disabled={status.connected}
              maxLength={32}
              placeholder="ex: SALA-1"
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </div>

          <div className={isFirebaseMode ? '' : 'sm:col-span-2'}>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              NOME / APELIDO NA SALA:
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={status.connected}
              maxLength={24}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Active Firebase Rooms List */}
        {isFirebaseMode && status.authUser && !status.connected && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                SALAS ATIVAS NO FIREBASE ({status.availableRooms.length}):
              </span>
            </div>
            {status.availableRooms.length === 0 ? (
              <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded p-2.5 text-center">
                Nenhuma sala aberta no momento. Clique em <strong>CRIAR / ENTRAR NA SALA</strong> abaixo para hospedar uma!
              </div>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {status.availableRooms.map((r) => (
                  <div
                    key={r.roomId}
                    className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-300">{r.roomId}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                          {r.endlessStage > 0 ? `INF-${r.endlessStage}` : r.levelId.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        Anfitrião: {r.hostName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConnect(r.roomId)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer shrink-0"
                    >
                      ENTRAR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Box */}
        <div
          className={`p-3 rounded-lg border mb-4 text-xs ${
            status.connected
              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
              : status.connecting
              ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
              : status.error
              ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold flex items-center gap-2">
              {status.connected ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                  CONECTADO NA SALA [{status.roomId}]
                  {status.isHost && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" /> ANFITRIÃO
                    </span>
                  )}
                </>
              ) : status.connecting ? (
                <>
                  <Wifi className="w-4 h-4 text-amber-400 animate-spin" />
                  SINCRONIZANDO COM FIREBASE...
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
                {status.playerCount} JOGADOR(ES) {status.ping > 0 ? `• ${status.ping}ms` : ''}
              </span>
            )}
          </div>
          {status.error && <p className="text-[11px] text-rose-300 mt-1">{status.error}</p>}
          {status.connected && (
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Jogando como <strong className="text-white">{status.playerName}</strong> ({status.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'}) via {isFirebaseMode ? 'Firebase Firestore' : 'IP Local'}.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {!status.connected ? (
            <button
              type="button"
              onClick={() => handleConnect()}
              disabled={status.connecting || (isFirebaseMode && !status.authUser)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              {status.connecting
                ? 'CONECTANDO...'
                : isFirebaseMode && !status.authUser
                ? 'ENTRE COM GOOGLE PARA JOGAR'
                : 'CRIAR / ENTRAR NA SALA'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded text-xs transition-colors cursor-pointer shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2"
            >
              <WifiOff className="w-4 h-4" />
              SAIR DA SALA
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs py-2.5 px-3 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copiar link com o código da sala para convidar amigo"
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
              SINAIS E CHAT RÁPIDO NA SALA:
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

            <form onSubmit={handleSendCustomChat} className="flex gap-2">
              <input
                type="text"
                value={customChat}
                onChange={(e) => setCustomChat(e.target.value)}
                placeholder="Enviar mensagem para a sala..."
                maxLength={80}
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
            🎮 <strong>Como jogar no Multiplayer Firebase:</strong>
          </p>
          <p>
            1. Faça login com sua <strong>Conta Google</strong> e escolha <strong>WazzimaGiygg</strong> (Mario Verde) ou <strong>Mario</strong>.
          </p>
          <p>
            2. Crie uma sala ou entre em uma sala ativa da lista usando o mesmo código. As posições e fases são sincronizadas em tempo real pelo Firebase Firestore!
          </p>
        </div>
      </div>
    </div>
  );
};
