/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ScrollText, X } from 'lucide-react';

interface UpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UpdateEntry {
  version: string;
  label: string;
  title: string;
  items: string[];
}

const GAME_UPDATES: UpdateEntry[] = [
  {
    version: 'v1.9',
    label: 'Mais Recente',
    title: 'Modo Debug (Estilo Sonic) & Easter Egg "ILLEGAL INSTRUCTION"',
    items: [
      'Novo Modo Debug (estilo Sonic) ativável em Configurações ou na Página do Desenvolvedor: os pontos no placar viram coordenadas X/Y em tempo real.',
      'Cursor livre de inserção manual (tecla B / E): voe pela fase, alterne entre moedas, power-ups, blocos e inimigos (Shift / X / [ ]) e insira manualmente (Espaço / Z ou clique no mapa).',
      'Easter Egg secreto: cair no abismo segurando o botão de corrida aciona a tela bugada "ILLEGAL INSTRUCTION", que pode ser restaurada ao normal pressionando o Botão do Desenvolvedor.',
    ],
  },
  {
    version: 'v1.8',
    label: 'Beta V0.9',
    title: 'Super Mario World (Beta V0.9) · Overworld & Ilha WikiWorldWeb',
    items: [
      'Novo modo Super Mario World (Beta V0.9) com seleção interativa de fases diretamente no mapa do Overworld.',
      'História introdutória oficial de WazzimaGiygg enfrentando Chronus e Bowser para salvar a Princesa Femboy.',
      'Primeiro conjunto de mundos na Ilha WikiWorldWeb: Overworld, Caverna, Água, Mansão Fantasma e o Castelo de Johannnnes89.',
    ],
  },
  {
    version: 'v1.7',
    label: 'Campanha 7×5',
    title: 'Modo Singleplayer: 7 Mundos (35 Fases) & Princesa Femboy',
    items: [
      'Novo Modo Singleplayer acessível pelo Menu Inicial e Configurações com campanha completa de 7 Mundos e 5 fases em cada mundo (1-1 até 7-5).',
      'Fases variadas em sequência progressiva por superfície, cavernas subterrâneas, áreas aquáticas, mansões assombradas e castelos com Rei Koopa.',
      'Castelo Final (7-5): derrote o Rei Koopa final no último mundo para resgatar a Princesa Femboy em uma cena especial com diálogos, corações e tela de vitória da campanha.',
    ],
  },
  {
    version: 'v1.6',
    label: 'Mansão & Boos',
    title: 'Mansão de Fantasmas, Boos & Plataformas Flutuantes',
    items: [
      'Nova fase Mansão de Fantasmas (world-ghost) integrada à campanha entre o Mundo 2-2 e o Castelo 1-4, com janelas enluaradas, candelabros, névoa e música assombrada em tom menor.',
      'Fantasmas Boo: atravessam paredes perseguindo você apenas quando você vira de costas e congelam corando quando olhados de frente.',
      'Dry Bones: esqueletos que desmoronam ao serem pisados e se remontam após alguns segundos.',
      'Plataformas Flutuantes espectrais (horizontais, verticais e oscilantes) nos abismos da Mansão e disponíveis como pincéis no Editor de Fases.',
      'Proteção contra atalho pelo teto: pular alto demais acima do teto na Caverna ou Mansão faz o jogador perder uma vida e morrer (exceto com o modo de desenvolvedor ativado).',
    ],
  },
  {
    version: 'v1.5',
    label: 'Editor & Arquivos',
    title: 'Editor de Fases Avançado, Exportação & Imortalidade',
    items: [
      'Criação e edição de fases na memória temporária do navegador com blocos, canos, moedas, plataformas móveis e inimigos.',
      'Exportação e upload de fases em arquivo (.smb.json) para salvar backups ou carregar mapas criados.',
      'Botão direto para voltar ao Menu Inicial, modo Imortal ON/OFF exclusivo para testes no editor e alerta caso a fase não tenha Poste ou Machado final.',
      'Proteção de recordes: partidas em fases do Editor não registram pontuação no Ranking local.',
    ],
  },
  {
    version: 'v1.4',
    label: 'Inimigos & Castelo',
    title: 'Paratroopas, Hammer Brothers & Castelo Clássico',
    items: [
      'Koopa Paratroopas alados com trajetória em arco saltitante.',
      'Hammer Brothers que saltam entre alturas e arremessam martelos contra o jogador.',
      'Cutscene clássica do Toodle ao concluir o Castelo 1-4.',
      'Mecânica clássica de Vida Infinita ao quicar consecutivamente em cascos e inimigos.',
    ],
  },
  {
    version: 'v1.3',
    label: 'Recursos & Cheats',
    title: 'Câmera Suave, Power-Ups, Aviso 16+ & Cheats',
    items: [
      'Câmera suave com interpolação, novos power-ups (Folha, Pena e Laço especial) e modo Sem Fim cíclico.',
      'Aviso de classificação recomendada para maiores de 16 anos e créditos de projeto não oficial de fãs na tela inicial.',
      'Menu de desenvolvedor com opção de teleporte direto para o final da fase.',
    ],
  },
];

export const UpdatesModal: React.FC<UpdatesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="updates-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl bg-stone-900 border-2 border-purple-500/60 rounded-xl shadow-2xl p-5 sm:p-6 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <ScrollText className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <h2
                id="updates-modal-title"
                className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-amber-400"
              >
                NOVIDADES DO JOGO
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 mt-1">
                Atualizações recentes adicionadas ao projeto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar novidades"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Changelog entries */}
        <div className="space-y-4 pt-4">
          {GAME_UPDATES.map((entry, idx) => (
            <section
              key={entry.version}
              className={`rounded-lg border p-4 ${
                idx === 0
                  ? 'bg-purple-950/30 border-purple-500/50'
                  : 'bg-stone-950/60 border-stone-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-stone-400 mb-1.5">
                <span className={idx === 0 ? 'text-purple-300 font-bold' : 'text-amber-300 font-bold'}>
                  {entry.version}
                </span>
                <span aria-hidden="true">·</span>
                <span className={idx === 0 ? 'text-amber-300 font-semibold' : 'text-stone-400'}>
                  {entry.label}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-white mb-2.5 leading-snug">
                {entry.title}
              </h3>

              <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 leading-relaxed list-disc pl-5">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-5 mt-5 border-t border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-white font-medium text-xs sm:text-sm transition cursor-pointer whitespace-nowrap shrink-0"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
