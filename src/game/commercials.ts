/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const COMMERCIAL_SKIP_DELAY_SECONDS = 15;
export const LAST_COMMERCIAL_STORAGE_KEY = 'smb_last_wazzima_commercial_id';

export type CommercialAudioTheme = 'upbeat' | 'investigative';

export interface CommercialScene {
  id: string;
  startSec: number;
  endSec: number;
  kicker: string;
  caption: string;
  detail: string;
  spokenText: string;
  previewTitle: string;
  previewLines: string[];
}

export interface WazzimaCommercial {
  id: string;
  ecosystem: 'WazzimaGiygg';
  audioTheme: CommercialAudioTheme;
  accentColor: 'emerald' | 'amber';
  title: string;
  siteName: string;
  siteUrl: string;
  displayUrl: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  durationSeconds: number;
  skipDelaySeconds: number;
  scenes: CommercialScene[];
}

export const WAZZIMAGIYGG_COMMERCIALS: WazzimaCommercial[] = [
  {
    id: 'wazzimagiygg-wikimaker-01',
    ecosystem: 'WazzimaGiygg',
    audioTheme: 'upbeat',
    accentColor: 'emerald',
    title: 'WikiMaker — Ecossistema WazzimaGiygg',
    siteName: 'WikiMaker',
    siteUrl: 'https://wikimaker.wazzimagiygg.com/',
    displayUrl: 'wikimaker.wazzimagiygg.com',
    headline: 'Crie sua própria wiki em minutos no WikiMaker',
    subheadline:
      'Construa enciclopédias, documente mundos, personagens e guias da comunidade no ecossistema WazzimaGiygg.',
    ctaLabel: 'Visitar WikiMaker',
    durationSeconds: COMMERCIAL_SKIP_DELAY_SECONDS,
    skipDelaySeconds: COMMERCIAL_SKIP_DELAY_SECONDS,
    scenes: [
      {
        id: 'wikimaker-intro',
        startSec: 0,
        endSec: 5,
        kicker: 'Ecossistema WazzimaGiygg',
        caption: 'Conheça o WikiMaker',
        detail:
          'A plataforma oficial do ecossistema WazzimaGiygg para criar, estruturar e publicar wikis completas.',
        spokenText:
          'Conheça o WikiMaker, a plataforma do ecossistema WazzimaGiygg para criar e publicar wikis completas.',
        previewTitle: 'Portal Inicial · WikiWorld',
        previewLines: [
          'Organize categorias, páginas de lore e segredos de cada mundo em um só lugar.',
          'Navegação rápida por artigos, referências cruzadas e fichas de personagens.',
        ],
      },
      {
        id: 'wikimaker-editor',
        startSec: 5,
        endSec: 10,
        kicker: 'Criação Sem Complicação',
        caption: 'Escreva e conecte páginas instantaneamente',
        detail:
          'Monte guias de fases, chefes, itens e curiosidades com visual limpo para desktop e celular.',
        spokenText:
          'Escreva e conecte páginas de fases, chefes e curiosidades com visual limpo e publicação imediata.',
        previewTitle: 'Editor de Artigo · Modo Publicação',
        previewLines: [
          'Seções estruturadas, links internos automáticos e histórico organizado.',
          'Ideal para projetos de jogos, comunidades de fãs e bases de conhecimento.',
        ],
      },
      {
        id: 'wikimaker-cta',
        startSec: 10,
        endSec: 15,
        kicker: 'wikimaker.wazzimagiygg.com',
        caption: 'Publique seu universo agora',
        detail:
          'Acesse https://wikimaker.wazzimagiygg.com/ e comece gratuitamente sua wiki no ecossistema WazzimaGiygg.',
        spokenText:
          'Acesse wikimaker ponto wazzimagiygg ponto com e comece a publicar sua wiki agora.',
        previewTitle: 'WikiMaker Online · Ecossistema WazzimaGiygg',
        previewLines: [
          'Tudo conectado ao universo criativo WazzimaGiygg.',
          'Clique em Visitar WikiMaker para conhecer a plataforma.',
        ],
      },
    ],
  },
  {
    id: 'wazzimagiygg-averdade-02',
    ecosystem: 'WazzimaGiygg',
    audioTheme: 'investigative',
    accentColor: 'amber',
    title: 'Dossiê A Verdade — Wikipédia',
    siteName: 'Dossiê A Verdade',
    siteUrl: 'https://wazzimagiygg.com/averdade/',
    displayUrl: 'wazzimagiygg.com/averdade',
    headline: 'Dossiê A Verdade: registros e fatos sobre a Wikipédia',
    subheadline:
      'Leia o dossiê investigativo sobre conflitos, bloqueios, moderação e defesa de direitos digitais na Wikipédia lusófona.',
    ctaLabel: 'Ler o Dossiê',
    durationSeconds: COMMERCIAL_SKIP_DELAY_SECONDS,
    skipDelaySeconds: COMMERCIAL_SKIP_DELAY_SECONDS,
    scenes: [
      {
        id: 'averdade-intro',
        startSec: 0,
        endSec: 5,
        kicker: 'Dossiê Investigativo · WazzimaGiygg',
        caption: 'A Verdade sobre a Wikipédia',
        detail:
          'O portal wazzimagiygg.com/averdade reúne documentos, cronologias e registros públicos sobre bloqueios e disputas na Wikipédia lusófona.',
        spokenText:
          'Conheça o dossiê A Verdade sobre a Wikipédia, reunindo documentos, cronologias e registros públicos no portal WazzimaGiygg.',
        previewTitle: 'Acervo Documental · A Verdade',
        previewLines: [
          'Cronologia detalhada de bloqueios, disputas editoriais e respostas documentadas.',
          'Arquivo público preservado para consulta aberta e verificação independente.',
        ],
      },
      {
        id: 'averdade-evidencias',
        startSec: 5,
        endSec: 10,
        kicker: 'Transparência e Direitos Digitais',
        caption: 'Relatos, evidências e contexto completo',
        detail:
          'Analise os apontamentos sobre abuso de poder administrativo, proteção de dados pessoais, LGPD e Marco Civil da Internet.',
        spokenText:
          'Analise relatos, evidências e argumentos sobre moderação, proteção de dados pela LGPD e o Marco Civil da Internet.',
        previewTitle: 'Relatório Público · Pontos-Chave',
        previewLines: [
          'Registros organizados por tópico com contexto histórico e citações diretas.',
          'Documentação independente sobre governança e transparência na rede.',
        ],
      },
      {
        id: 'averdade-cta',
        startSec: 10,
        endSec: 15,
        kicker: 'wazzimagiygg.com/averdade',
        caption: 'Leia o dossiê completo na fonte',
        detail:
          'Acesse https://wazzimagiygg.com/averdade/ e conheça todos os fatos e documentos reunidos no dossiê.',
        spokenText:
          'Acesse wazzimagiygg ponto com barra a verdade e leia o dossiê completo sobre a Wikipédia.',
        previewTitle: 'wazzimagiygg.com/averdade/',
        previewLines: [
          'Acesso direto ao dossiê completo publicado pelo ecossistema WazzimaGiygg.',
          'Clique em Ler o Dossiê para abrir a página oficial.',
        ],
      },
    ],
  },
];

export function getPrimaryWazzimaCommercial(): WazzimaCommercial {
  return WAZZIMAGIYGG_COMMERCIALS[0];
}

export function getDossierWazzimaCommercial(): WazzimaCommercial {
  return WAZZIMAGIYGG_COMMERCIALS[1];
}

export function getCommercialById(id?: string | null): WazzimaCommercial {
  if (!id) return WAZZIMAGIYGG_COMMERCIALS[0];
  return WAZZIMAGIYGG_COMMERCIALS.find(c => c.id === id) ?? WAZZIMAGIYGG_COMMERCIALS[0];
}

export function getNextCommercialInRotation(lastShownId?: string | null): WazzimaCommercial {
  if (!lastShownId) {
    return WAZZIMAGIYGG_COMMERCIALS[0];
  }
  const idx = WAZZIMAGIYGG_COMMERCIALS.findIndex(c => c.id === lastShownId);
  if (idx === -1) {
    return WAZZIMAGIYGG_COMMERCIALS[0];
  }
  return WAZZIMAGIYGG_COMMERCIALS[(idx + 1) % WAZZIMAGIYGG_COMMERCIALS.length];
}

export function getCommercialRemainingSeconds(
  elapsedSeconds: number,
  skipDelaySeconds: number = COMMERCIAL_SKIP_DELAY_SECONDS
): number {
  const clampedElapsed = Math.max(0, elapsedSeconds);
  return Math.max(0, Math.ceil(skipDelaySeconds - clampedElapsed));
}

export function canSkipCommercial(
  elapsedSeconds: number,
  skipDelaySeconds: number = COMMERCIAL_SKIP_DELAY_SECONDS
): boolean {
  return elapsedSeconds >= skipDelaySeconds;
}

export function getActiveCommercialScene(
  commercial: WazzimaCommercial,
  elapsedSeconds: number
): CommercialScene {
  const found = commercial.scenes.find(
    scene => elapsedSeconds >= scene.startSec && elapsedSeconds < scene.endSec
  );
  return found ?? commercial.scenes[commercial.scenes.length - 1];
}
