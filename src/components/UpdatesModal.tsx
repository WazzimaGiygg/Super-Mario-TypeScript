/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollText, Wrench, X } from 'lucide-react';

export type UpdatesModalFilter = 'fixes' | 'all';

interface UpdatesModalProps {
  isOpen: boolean;
  initialFilter?: UpdatesModalFilter;
  onClose: () => void;
}

export interface UpdateEntry {
  uid: string;
  version: string;
  label: string;
  title: string;
  isFix?: boolean;
  items: string[];
}

export const GAME_UPDATES: UpdateEntry[] = [
  {
    uid: 'R1.19.SB.6',
    version: 'R1.19.SB.6',
    label: 'Recurso · Botão Select SMW',
    title: 'Botão Select Para Sair de Fases Já Passadas no Modo World e Usar Power-Up da Carteira',
    isFix: false,
    items: [
      'Adicionado o botão SELECT nos controles táteis (barra inferior e sobreposição), nas teclas V / Tab do teclado e no botão Select do gamepad.',
      'Durante a fase, pressionar SELECT solta manualmente o Power-Up armazenado na Carteira (Reserve Box) no topo da tela para o personagem coletar.',
      'No Modo Super Mario World, pausar (P / Esc / Pausa) e usar SELECT permite sair da fase de volta ao Overworld apenas em fases já concluídas anteriormente.',
    ],
  },
  {
    uid: 'R1.19.ML.6',
    version: 'R1.19.ML.6',
    label: 'Correção · Bloqueio de Modo & Editor',
    title: 'Bloqueio de Troca de Modo e Editor de Fases Após Iniciar a Partida',
    isFix: true,
    items: [
      'Após iniciar uma partida em modo Normal (Clássico), Modo World ou 7 Fases (Singleplayer), a troca de modo de jogo, seleção de fase em Configurações e abertura do Editor de Fases ficam bloqueadas.',
      'Exceções mantidas: o acesso à troca de modo e ao Editor de Fases continua liberado quando o Modo Desenvolvedor estiver ativo ou quando o jogador estiver utilizando/testando o próprio Editor de Fases.',
    ],
  },
  {
    uid: 'R1.19.BM.6',
    version: 'R1.19.BM.6',
    label: 'Recurso · Música & Fundo Bonus/Palácio',
    title: 'Música Exclusiva de Bonus Stage Aplicada Também aos Palácios de Botão com Fundo Bônus',
    isFix: false,
    items: [
      'Adicionada uma nova trilha sonora chiptune exclusiva e alegre para o Bonus Stage.',
      'Todos os Palácios Interruptores (Amarelo, Verde, Vermelho, Rosa e Azul) agora reproduzem a mesma música do Bonus Stage e utilizam o fundo clássico em índigo com losangos da sala bônus.',
    ],
  },
  {
    uid: 'R1.19.BS.6',
    version: 'R1.19.BS.6',
    label: 'Correção · Bonus Stage',
    title: 'Finalização Suave e Correta no Bonus Stage (Solo, Mapa SMW e Multiplayer)',
    isFix: true,
    items: [
      'Ao bater o 9º bloco no ar, o personagem agora pousa suavemente até o chão/blocos antes de encerrar a sala bônus, em vez de ficar congelado suspenso no ar.',
      'Quando o tempo da sala bônus termina, a fase agora executa a sequência normal de conclusão com mensagem, fechamento em íris circular e transição limpa, em vez de cortar bruscamente.',
      'Corrigida a finalização do Bonus Stage no modo Multiplayer e no Mapa do Super Mario World, mantendo espera segura por colegas na sala e reinício consistente.',
    ],
  },
  {
    uid: 'R1.19.KH.6',
    version: 'R1.19.KH.6',
    label: 'Correção · Animação de Chave SMW',
    title: 'Animação de Fim de Fase na Fechadura Aproximada ao Super Mario World Original',
    isFix: true,
    items: [
      'Ao encostar a Chave no Buraco de Chave, a chave desliza e gira suavemente para dentro da fechadura antes de travar com faíscas douradas.',
      'Substituída a íris circular simples pelo fechamento clássico em formato de fechadura (cabeça circular + haste trapezoidal com borda dourada) centralizado no emblema que amplia na tela, acompanhado por uma fanfarra exclusiva de Saída Secreta.',
      'Eliminado o flash para a tela clara após concluir a fechadura: a transição mantém o blackout contínuo e o personagem visível dentro da janela até sair da fase.',
    ],
  },
  {
    uid: 'R1.19.1CU.5',
    version: 'R1.19.1CU.5',
    label: 'Recurso · Pulo Carpado SMW',
    title: 'Pulo Carpado (Spin Jump) em Tecla Dedicada para Quicar em Fantasmas/Espinhos e Sair do Yoshi',
    isFix: true,
    items: [
      'Adicionado o Pulo Carpado clássico do Super Mario World nas teclas dedicadas C ou Q (e botão C nos controles táteis / Y no controle): o personagem gira 360° no ar com o efeito sonoro original.',
      'Durante o Pulo Carpado é possível quicar em segurança sobre fantasmas (Boo), Piranha Plants, Dry Bones, Bowser e futuros inimigos/blocos com espinhos sem sofrer dano.',
      'Pressionar a tecla de Pulo Carpado montado no Yoshi (no chão ou no ar) faz o personagem saltar girando para fora da sela, exatamente como no Super Mario World original.',
    ],
  },
  {
    uid: 'R1.19.29D.5',
    version: 'R1.19.29D.5',
    label: 'Recurso · Saída Secreta SMW',
    title: 'Cano Secreto em W-1 com Subsolo, Chave e Fechadura para Abrir o Palácio Amarelo',
    isFix: true,
    items: [
      'No modo Super Mario World, concluir W-1 pelo poste normal agora desbloqueia apenas W-2 (Caverna), mantendo o Palácio Interruptor Amarelo trancado até descobrir a saída secreta.',
      'Um dos canos de W-1 leva a um subsolo secreto contendo uma Chave e um Buraco de Chave (além de cano de retorno): segure Corrida para pegar a Chave e levá-la até a Fechadura para abrir o caminho até o Palácio Interruptor Amarelo.',
    ],
  },
  {
    uid: 'R1.19.14C.5',
    version: 'R1.19.14C.5',
    label: 'Correção · Bonus Stage',
    title: 'Bonus Stage dos 100 Pontos Concede o Power-Up Selecionado no Lugar da Vida',
    isFix: true,
    items: [
      'No Bonus Stage liberado ao alcançar 100 pontos no poste final, selecionar um bloco quando ele exibe um power-up (Cogumelo, Flor de Fogo, Pena, Tanooki ou Laço Femboy) no lugar da vida 1-UP agora equipa o power-up correspondente no personagem (e guarda reservas na carteira, mantendo o poder ao avançar de fase).',
    ],
  },
  {
    uid: 'R1.19.1GX.5',
    version: 'R1.19.1GX.5',
    label: 'Recurso · Objetos SMW',
    title: 'Chaves, Buracos de Chave, Botões Móveis (Azul/Ciano) e Carregamento de Cascos',
    isFix: true,
    items: [
      'Agora é possível segurar e carregar Chaves, Botões Móveis (Azul e Ciano) e cascos parados de Koopa mantendo o botão de Corrida pressionado, soltando ou chutando ao soltar o botão (igual ao Super Mario World original).',
      'Botão Móvel Azul transforma temporariamente as moedas próximas em blocos sólidos e depois reverte em moedas; Botão Móvel Ciano transforma inimigos próximos em moedas coletáveis (exceto o boss final do castelo).',
      'Levar uma Chave até o Buraco de Chave destranca a fechadura com a transição clássica de conclusão da fase.',
    ],
  },
  {
    uid: 'R1.19.SQ.6',
    version: 'R1.19.SQ.6',
    label: 'Correção · Visual SMW',
    title: 'Poste de Fim de Fase Refinado com Visual Clássico do Super Mario World',
    isFix: true,
    items: [
      'Redesenhado o poste duplo de fim de fase com estética 2.5D inspirada no Super Mario World original: pilares cilíndricos segmentados, cúpulas metálicas com colar dourado, viga superior em perspectiva com brasão e pedestal firme apoiado no chão.',
      'O pilar frontal agora é desenhado em camada à frente do personagem e acompanha a fita xadrez branco-e-dourada animada junto com marcadores de pontuação mais legíveis.',
    ],
  },
  {
    uid: 'R1.19.F5.6',
    version: 'R1.19.F5.6',
    label: 'Correção · Castelo SMW',
    title: 'Nomeação do 1º Boss do Primeiro Castelo de Johannnnes89 (Lorde Ignis Koopa)',
    isFix: true,
    items: [
      'O chefe do primeiro castelo de Johannnnes89 (W-5) agora possui nome próprio oficial: "Lorde Ignis Koopa", exibido no Mapa Overworld, na placa de identificação dentro da batalha e nos diálogos de vitória.',
    ],
  },
  {
    uid: 'R1.16.1RZ.4',
    version: 'R1.16.1RZ.4',
    label: 'Recurso · Expansão SMW',
    title: 'Yoshi Adicionado ao Modo Debug e Editor de Fases (Bloqueado em Castelos)',
    isFix: true,
    items: [
      'Adicionado o Yoshi com montaria completa, ataque de língua para engolir inimigos e itens, salto para desmontar e absorção de dano com fuga.',
      'Enquanto o Super Mario World segue em expansão, o Yoshi só pode ser encontrado e usado pelo Modo Debug ou pelo Editor de Fases. Se houver tentativa de inseri-lo ou spawná-lo dentro de qualquer castelo, ele não será spawnado.',
    ],
  },
  {
    uid: 'R1.16.21Z.4',
    version: 'R1.16.21Z.4',
    label: 'Correção · Switch Palaces',
    title: 'Palácios Switchers Verde, Vermelho, Rosa e Azul (Acesso Exclusivo Modo Desenvolvedor)',
    isFix: true,
    items: [
      'Adicionados os 4 novos Palácios Interruptores (Verde, Vermelho, Rosa e Azul) com interruptores gigantes próprios e seus respectivos blocos "[!]": Verde (Pena), Vermelho (Flor de Fogo), Rosa (Laço Femboy) e Azul (Tanooki).',
      'Como o Modo Super Mario World ainda está em expansão, esses 4 palácios não aparecem no mapa comum e só podem ser acessados pela opção "Ir até a fase específica" dentro da Página do Desenvolvedor.',
    ],
  },
  {
    uid: 'R1.16.GT.4',
    version: 'R1.16.GT.4',
    label: 'Correção · Poste SMW',
    title: 'Poste de Pontos Exige Acertar o Cursor (Fita Móvel) na Altura Exata',
    isFix: true,
    items: [
      'Igual ao Super Mario World original, o jogador só recebe os pontos do poste final quando o personagem atinge exatamente a altura em que o cursor (fita amarela móvel) estiver posicionado.',
      'Se atravessar o poste acima ou abaixo do cursor sem tocá-lo, a fase continua normalmente até o castelo, porém a fita permanece intacta e nenhum ponto é adicionado à carteira.',
    ],
  },
  {
    uid: 'R1.16.AC.4',
    version: 'R1.16.AC.4',
    label: 'Recurso · Motor',
    title: 'Sistema de Conquistas com Metas e Recompensas no Motor do Jogo',
    isFix: true,
    items: [
      'Implementado sistema completo de rastreamento de conquistas no GameEngine para marcos como "Caçador de Goombas" (10 Goombas), "Velocista" (concluir fase em menos de 60 segundos), moedas, blocos, moedas W e chefes.',
      'Desbloquear conquistas concede automaticamente pontos bônus e vidas extras, exibe notificação animada em tempo real e salva o progresso localmente.',
    ],
  },
  {
    uid: 'R1.16.PX.4',
    version: 'R1.16.PX.4',
    label: 'Correção · Fases',
    title: 'Remoção das Caixas de Power-Up Exceto Blocos [!] do Modo Super Mario World',
    isFix: true,
    items: [
      'Removidas todas as caixas de power-up de blocos "?" e tijolos secretos em todas as fases, geradores procedurais, importação, modo debug e paleta do editor.',
      'Mantidas exclusivamente as caixas do tipo "[!]" do Modo Super Mario World (exclam_yellow), liberadas pelo Palácio do Interruptor Amarelo.',
    ],
  },
  {
    uid: 'R1.16.MV.4',
    version: 'R1.16.MV.4',
    label: 'Correção · World',
    title: 'Movimentação Livre no Mapa e nas Fases Após Concluir Estágio no Modo World',
    isFix: true,
    items: [
      'Corrigido o erro que mantinha o gatilho de conclusão da fase ativo em loop no motor após retornar ao Overworld, impedindo o jogador de mover o personagem pelas estradas do mapa ou após vencer fases.',
      'Ao concluir qualquer estágio no Modo World, o estado do personagem e os controles são limpos de forma única e o loop de fase pausa enquanto o mapa está aberto.',
    ],
  },
  {
    uid: 'R1.16.SL.4',
    version: 'R1.16.SL.4',
    label: 'Correção · World',
    title: 'Correção do Softlock ao Salvar Progresso e Nova Opção Carregar Progresso (Modo World)',
    isFix: true,
    items: [
      'Corrigido o softlock que reabria infinitamente o modal de salvamento após salvar ou fechar o prompt de castelo concluído no Modo World.',
      'Adicionada a opção explícita "Carregar Progresso" no menu inicial, nas Configurações e na barra superior do Overworld para carregar diretamente qualquer um dos 3 slots salvos.',
    ],
  },
  {
    uid: 'R1.16.1B0.4',
    version: 'R1.16.1B0.4',
    label: 'Recurso · Editor',
    title: 'Campanha Personalizada em Sequência com Vários Mapas do Editor',
    isFix: true,
    items: [
      'Adicionado montador de Campanha Personalizada no Editor de Fases, permitindo selecionar, ordenar e reorganizar várias fases criadas ou importadas.',
      'Ao jogar a campanha personalizada, concluir cada fase avança automaticamente para a próxima fase criada na sequência até a tela de vitória final da campanha.',
    ],
  },
  {
    uid: 'R1.16.FH.4',
    version: 'R1.16.FH.4',
    label: 'Recurso · Editor',
    title: 'Atalhos Ctrl+Z e Ctrl+Y (Desfazer e Refazer) no Editor de Fases',
    isFix: true,
    items: [
      'Adicionado suporte completo a Ctrl+Z / Cmd+Z (Desfazer) e Ctrl+Y / Ctrl+Shift+Z (Refazer) no Editor de Fases, além de botões dedicados na barra de ferramentas.',
      'Pinceladas contínuas agrupam a edição inteira em um único passo reversível com histórico limitado para manter o uso de memória seguro.',
    ],
  },
  {
    uid: 'R02.16.PG.4',
    version: 'R02.16.PG.4',
    label: 'Correção · World',
    title: 'Animação de Entrada no Castelo Estilo Super Mario World',
    isFix: true,
    items: [
      'Adicionada sequência clássica de entrada no castelo ao concluir fases no modo Super Mario World: o personagem para diante do portal, adentra o arco do castelo com escala de profundidade, ergue a bandeira de vitória no topo e encerra com transição circular (iris-out) de volta ao mapa.',
    ],
  },
  {
    uid: 'R1.16.OV.4',
    version: 'R1.16.OV.4',
    label: 'Recurso · Fases',
    title: '4 Moedas Gigantes Flutuantes ("W") com Vida Extra por Fase',
    isFix: true,
    items: [
      'Adicionadas 4 Moedas Gigantes Flutuantes douradas com a letra "W" gravada distribuídas ao longo das fases jogáveis e indicador W:X/4 no HUD.',
      'Coletar todas as 4 moedas "W" dentro da mesma fase concede automaticamente +1 Vida Extra (1-UP) além de bônus de pontos.',
    ],
  },
  {
    uid: 'R1.16.SW.4',
    version: 'R1.16.SW.4',
    label: 'Correção · Combate',
    title: 'Inimigos Derrotados por Bola de Fogo Viram Moedas (Exceto Fantasmas e Esqueletos)',
    isFix: true,
    items: [
      'Inimigos comuns eliminados por bolas de fogo (como Goombas, Koopas, Paratroopas, Hammer Bros, Cheeps e Piranhas) agora se transformam diretamente em moedas coletáveis no local do impacto.',
      'Fantasmas (Boo) continuam imunes e Esqueletos (Dry Bones) mantêm o comportamento original sem virar moeda.',
    ],
  },
  {
    uid: 'R1.16.X6.4',
    version: 'R1.16.X6.4',
    label: 'Correção · World',
    title: 'Slots de Salvamento Manual Após Castelos & Fim do Salvamento Automático',
    isFix: true,
    items: [
      'Desativado completamente o salvamento automático no modo Super Mario World (partidas sempre iniciam limpas até o jogador carregar um slot salvo).',
      'Adicionados 3 Slots de Salvamento manuais exibidos automaticamente ao vencer castelos na Ilha WikiWorldWeb, com opção de salvar, carregar ou apagar cada slot pelo mapa.',
    ],
  },
  {
    uid: 'R1.16.13U.4',
    version: 'R1.16.13U.4',
    label: 'Recurso · Power-UPs',
    title: 'Carteira de Power-UPs (Reserva SMW) com Queda Automática ao Sofrer Dano',
    isFix: true,
    items: [
      'Adicionada a caixa "Carteira de Power-UPs" no topo do HUD estilo Super Mario World, armazenando power-ups extras ou substituídos (Cogumelo, Flor de Fogo, Folha, Pena ou Laço).',
      'Quando o jogador sofre dano e perde seu power-up atual, o item guardado na carteira cai automaticamente do alto da tela para ser pego e reequipado.',
    ],
  },
  {
    uid: 'R1.16.O0.4',
    version: 'R1.16.O0.4',
    label: 'Correção · World',
    title: 'Bloqueio de Reentrada no Palácio do Interruptor Amarelo Após Concluído',
    isFix: true,
    items: [
      'Impedido que o jogador entre ou jogue novamente o Palácio Interruptor Amarelo após já tê-lo concluído, mantendo a passagem pelas estradas do mapa intacta.',
    ],
  },
  {
    uid: 'R1.16.OY.4',
    version: 'R1.16.OY.4',
    label: 'Correção · Debug',
    title: 'Bloqueio e Desativação do Modo Debug ao Alcançar o Final da Fase',
    isFix: true,
    items: [
      'O Modo Debug e o cursor de posicionamento são desativados e bloqueados automaticamente caso o jogador alcance a zona final da fase (poste, castelo, machado do chefe, Switch Palace ou Bonus Stage), mesmo que já estivessem ativados.',
      'Impedida a reativação ou inserção de objetos via atalhos ou menu enquanto o personagem estiver no trecho final ou durante a conclusão da fase.',
    ],
  },
  {
    uid: 'R1.16.P4.4',
    version: 'R1.16.P4.4',
    label: 'Correção · Pontuação',
    title: 'Transformação de Inimigos Próximos ao Final da Fase em Pontos Multiplicados',
    isFix: true,
    items: [
      'Ao concluir a fase ou alcançar o objetivo final, inimigos comuns vivos próximos ao término da fase são convertidos automaticamente em pontos multiplicados (×2, ×3, ×4... até ×8).',
      'Projéteis inimigos remanescentes também são limpos na conclusão para garantir uma finalização limpa e recompensadora.',
    ],
  },
  {
    uid: 'R1.16.3FG.4',
    version: 'R1.16.3FG.4',
    label: 'Correção · Final & Bonus',
    title: 'Poste de Pontos (SMW), Carteira de Pontos & Bonus Stage de 9 Vidas',
    isFix: true,
    items: [
      'Substituído o poste de bandeira clássico pelo Poste de Pontos estilo Super Mario World (exceto nos castelos de chefe, que mantêm o machado original).',
      'Nova Carteira de Pontos (★ 00/100) exibida no HUD: atingir o topo do poste ou acumular 50 pontos concede +3 vidas (3-UP); ao atingir 100 pontos, a carteira zera e o jogador entra automaticamente no Bonus Stage.',
      'No Bonus Stage (3x3 blocos giratórios), cada bloco pode render até 1-UP (máximo de 9 vidas possíveis); quando todas as 9 possibilidades são finalizadas, a fase encerra e avança automaticamente.',
    ],
  },
  {
    uid: 'R1.16.1IZ.4',
    version: 'R1.16.1IZ.4',
    label: 'Correção · Editor',
    title: 'Tela Preta ao Testar Fase Editada & Limite Seguro de Entidades no Editor',
    isFix: true,
    items: [
      'Corrigida renderização em janela virtual (canvas limitado a 2048px de largura em memória) e reset completo de modo/efeitos ao testar fases editadas, eliminando telas pretas em fases largas ou após alternar com o Modo World.',
      'Aplicados limites seguros de entidades no Editor, na importação e no histórico de ações (máx. 60 inimigos, 120 moedas, 16 plataformas, 180 entidades no total e histórico limitado) para proteger a memória volátil do navegador.',
    ],
  },
  {
    uid: 'R1.16.116.4',
    version: 'R1.16.116.4',
    label: 'Correção · World',
    title: 'Correção das Fases Invertidas (Caverna e Água) no Modo Super Mario World',
    isFix: true,
    items: [
      'Corrigida a inversão de geração entre as fases W-2 (Caverna) e W-3 (Água) na Ilha WikiWorldWeb.',
      'W-2 agora carrega corretamente o tema subterrâneo de Caverna e W-3 carrega o tema aquático de Água.',
    ],
  },
  {
    uid: 'R1.16.HH.4',
    version: 'R1.16.HH.4',
    label: 'Correção · World',
    title: 'Remoção da Opção de Liberar Todas as Fases no Super Mario World',
    isFix: true,
    items: [
      'Removido o botão e a opção de liberar todas as fases diretamente no mapa do Super Mario World.',
      'A progressão pela Ilha WikiWorldWeb segue exclusivamente o desbloqueio sequencial ao concluir cada fase.',
    ],
  },
  {
    uid: 'R1.16.QO.4',
    version: 'R1.16.QO.4',
    label: 'Correção · Debug',
    title: 'Bloqueio de Inserção de Objetos no Modo Debug Próximo ao Final da Fase',
    isFix: true,
    items: [
      'Impedida a inserção de quaisquer objetos (moedas, power-ups, blocos ou inimigos) no Modo Debug em cima ou dentro de 3 blocos de distância do final da fase (bandeira, castelo, machado ou interruptor).',
      'Tentativas na zona protegida emitem alerta sonoro e aviso visual sem alterar blocos nem entidades do final.',
    ],
  },
  {
    uid: 'R1.16.EG.4',
    version: 'R1.16.EG.4',
    label: 'Correções · UID',
    title: 'Botão de Correções Recentes com Identificador UID por Entrada',
    isFix: true,
    items: [
      'Adicionado botão direto "Correções Recentes" na Tela Inicial, Menu de Pausa e barra inferior.',
      'Cada correção e atualização exibida no histórico agora traz sua etiqueta explícita UID: <identificador> e filtro rápido entre Correções Recentes e Todas as Atualizações.',
    ],
  },
  {
    uid: 'R1.16.UF.4',
    version: 'R1.16.UF.4',
    label: 'Correção · Menu',
    title: 'Bloqueio de Controles Interativos Durante o Menu Inicial e Overlays',
    isFix: true,
    items: [
      'Corrigido bug que permitia movimentar o personagem no menu usando os controles interativos na tela ou gamepad antes de iniciar a partida.',
      'Controles acoplados na tela só são exibidos e processados durante a partida ativa, e o loop do motor descarta comandos enquanto o jogo não foi iniciado.',
    ],
  },
  {
    uid: 'R1.16.7H.4',
    version: 'R1.16.7H.4',
    label: 'Interface · Menu',
    title: 'Simplificação da Tela Inicial',
    isFix: true,
    items: [
      'Tela Inicial reorganizada em hierarquia limpa: 3 modos principais em destaque (Clássico, Modo World Beta e Campanha 7 Mundos) e barra compacta de utilitários.',
      'Mantidos todos os recursos originais (Multiplayer, Editor, Ranking, Correções Recentes, Opções, Smart TV, Tela Cheia e classificação 16+) sem poluição visual.',
    ],
  },
  {
    uid: 'R1.16.UC.4',
    version: 'R1.16.UC.4',
    label: 'Correção · World',
    title: 'Retorno Livre para Fases Anteriores no Modo Super Mario World',
    isFix: true,
    items: [
      'Corrigida falha de navegação no mapa do Overworld que impedia voltar passo a passo pelas estradas até fases já concluídas.',
      'Movimentação por setas/D-Pad agora segue as conexões reais da estrada (incluindo retorno de W-5 até W-1 e do Palácio Amarelo), mantendo cliques e encadeamento contínuo de caminhada.',
    ],
  },
  {
    uid: 'RW0.15.0.PW.4',
    version: 'RW0.15.0.PW.4',
    label: 'World · Ilha 2',
    title: 'Segunda Ilha no Modo World (Preview Beta Indisponível)',
    isFix: true,
    items: [
      'Adicionada a Segunda Ilha (Ilha 2 · Terras de Chronus) acessível diretamente no mapa do Modo World.',
      'Na primeira fase (2-1) e no painel da ilha é exibido o aviso oficial: "(Versão Beta) ainda não disponível para jogar".',
    ],
  },
  {
    uid: 'RW0.15.0.1DM.4',
    version: 'RW0.15.0.1DM.4',
    label: 'World · Switch',
    title: 'Palácio do Interruptor Amarelo & Blocos [!] Amarelos (Ilha WikiWorldWeb)',
    isFix: true,
    items: [
      'Adicionada a fase Palácio Interruptor Amarelo conectada à Ilha WikiWorldWeb após W-1 (Overworld), com santuário próprio no mapa do Overworld.',
      'Pisar no Interruptor Amarelo gigante no final do Palácio ativa permanentemente todos os Blocos [!] Amarelos nas fases da ilha.',
      'Antes da ativação, os Blocos [!] aparecem como contornos pontilhados intangíveis; após ativar o interruptor, tornam-se blocos dourados sólidos que liberam Super Cogumelos ao serem atingidos.',
    ],
  },
  {
    uid: 'R0.15.0.6L.4',
    version: 'R0.15.0.6L.4',
    label: 'Smart TV',
    title: 'Adaptação de Jogabilidade para Controles Remotos de Smart TV',
    isFix: true,
    items: [
      'Novo Modo Smart TV (detecção automática em navegadores de TV ou ativação manual na Tela Inicial e em Configurações) com margem anti-corte (overscan) e destaque visual de foco.',
      'Suporte completo às teclas de controles remotos (Setas / 4·6·2·8, OK / Enter / Select / DPAD_CENTER, Voltar / Return Tizen e WebOS, Botões Coloridos Vermelho/Verde/Amarelo/Azul, Canal +/- e Play/Pause).',
      'Navegação espacial D-Pad pelos menus (Tela Inicial, Pausa, Fim de Jogo, Overworld e Modais) e opção de Pular com Seta ▲ ou Corrida Automática na TV para controles simples de 5 botões.',
    ],
  },
  {
    uid: 'R0.15.6J.3',
    version: 'R0.15.6J.3',
    label: 'Compatibilidade',
    title: 'Política de Preservação, Segurança Firebase & Suíte de Regressão',
    isFix: true,
    items: [
      'Estabelecida política formal de preservação garantindo integridade da física original, efeitos dos power-ups, sistema de pontuação/vidas e funcionalidades existentes.',
      'Autenticação Google e regras de segurança do Firebase preservadas e validadas contra o blueprint, incluindo documentação prévia de riscos de incompatibilidade.',
      'Adicionada suíte automatizada de testes de regressão cobrindo física, power-ups, pontuação, vidas, guarda de morte e compatibilidade multiplayer entre pares da mesma versão.',
    ],
  },
  {
    uid: 'R0.15.6J.2',
    version: 'R0.15.6J.2',
    label: 'Escalabilidade',
    title: 'Preparação Progressiva para Salas de 4 até 16 Jogadores',
    isFix: true,
    items: [
      'Capacidade de sala ampliada de 12 para até 16 jogadores simultâneos com bloqueio limpo quando a sala estiver lotada.',
      'Escala adaptativa por lotação: ajusta automaticamente a frequência efetiva (15 Hz até 4 jog. → 12 Hz até 8 → 10 Hz até 12 → 8 Hz até 16), deadband espacial e janela de agrupamento de eventos para conter operações quadráticas no Firebase.',
      'Otimização de renderização e memória para múltiplas entidades: cache de largura de crachás, descarte de partículas remotas fora de câmera, listas limitadas de IDs vistos e limpeza automática de eventos expirados.',
    ],
  },
  {
    uid: 'R0.15.6J.1',
    version: 'R0.15.6J.1',
    label: 'Multiplayer',
    title: 'Otimização da Sincronização Multiplayer & Redução de Operações',
    isFix: true,
    items: [
      'Frequência configurável de envio de posição entre 10 e 20 Hz (padrão 15 Hz), mantendo física, colisões e controles locais instantâneos a 60 FPS.',
      'Interpolação suave com predição assistida por velocidade para jogadores remotos, evitando saltos visuais entre pacotes de rede.',
      'Sincronização apenas por deltas (campos modificados) e supressão de atualizações redundantes quando parado, enviando apenas heartbeat mínimo quando ocioso.',
      'Agrupamento e deduplicação de eventos rápidos (moedas, blocos e inimigos) separados de transições críticas de fase e estado.',
      'Reconexão automática com backoff exponencial no Firebase/WebSocket e validação rigorosa de identidade e mensagens recebidas.',
    ],
  },
  {
    uid: 'R0.15.0.JM.4',
    version: 'R0.15.0.JM.4',
    label: 'Correção',
    title: 'Correção do HUD de Vidas & Alinhamento do Placar Externo',
    isFix: true,
    items: [
      'O HUD de vidas agora limita a exibição visual para até 5 corações com indicador compacto (+N) para vidas extras, evitando dezenas de ícones na barra.',
      'Corrigido o deslocamento vertical que empurrava o HUD externo para cima quando havia muitas vidas ou quebra de linha na barra superior.',
    ],
  },
  {
    uid: 'R0.15.0.RL.4',
    version: 'R0.15.0.RL.4',
    label: 'Correção',
    title: 'Bloqueio de Coleta e Colisões Após Morte do Personagem',
    isFix: true,
    items: [
      'Impedido que o personagem interaja com moedas, inimigos ou power-ups após entrar no estado de morte.',
      'Preservados placar, moedas e vidas existentes no momento da derrota.',
    ],
  },
  {
    uid: 'R0.15.0.OO.4',
    version: 'R0.15.0.OO.4',
    label: 'Correção',
    title: 'Correção de Jogabilidade · Easter Egg Restrito ao Modo Desenvolvedor',
    isFix: true,
    items: [
      'O Easter Egg "ILLEGAL INSTRUCTION" ao cair no abismo segurando corrida agora só é ativado quando o Modo Desenvolvedor estiver em uso.',
      'Em partidas normais sem o Modo Desenvolvedor, cair no abismo segurando corrida segue o comportamento padrão de perda de vida.',
    ],
  },
  {
    uid: 'SMB-REL-1.9',
    version: 'v1.9',
    label: 'Debug & Mapa',
    title: 'Modo Debug (Estilo Sonic) & Easter Egg "ILLEGAL INSTRUCTION"',
    items: [
      'Novo Modo Debug (estilo Sonic) ativável em Configurações ou na Página do Desenvolvedor: os pontos no placar viram coordenadas X/Y em tempo real.',
      'Cursor livre de inserção manual (tecla B / E): voe pela fase, alterne entre moedas, power-ups, blocos e inimigos (Shift / X / [ ]) e insira manualmente (Espaço / Z ou clique no mapa).',
      'Easter Egg do Modo Desenvolvedor: com o modo desenvolvedor ativo, cair no abismo segurando o botão de corrida aciona a tela bugada "ILLEGAL INSTRUCTION", que pode ser restaurada ao normal pressionando o Botão do Desenvolvedor.',
    ],
  },
  {
    uid: 'SMB-REL-1.8',
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
    uid: 'SMB-REL-1.7',
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
    uid: 'SMB-REL-1.6',
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
    uid: 'SMB-REL-1.5',
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
    uid: 'SMB-REL-1.4',
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
    uid: 'SMB-REL-1.3',
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

export const UpdatesModal: React.FC<UpdatesModalProps> = ({
  isOpen,
  initialFilter = 'all',
  onClose,
}) => {
  const [filter, setFilter] = useState<UpdatesModalFilter>(initialFilter);

  useEffect(() => {
    if (isOpen) {
      setFilter(initialFilter);
    }
  }, [isOpen, initialFilter]);

  const visibleEntries = useMemo(() => {
    if (filter === 'fixes') {
      return GAME_UPDATES.filter(entry => entry.isFix);
    }
    return GAME_UPDATES;
  }, [filter]);

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
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-800">
          <div className="flex items-center gap-3">
            {filter === 'fixes' ? (
              <Wrench className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <ScrollText className="w-6 h-6 text-purple-400 shrink-0" />
            )}
            <div>
              <h2
                id="updates-modal-title"
                className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-amber-400"
              >
                {filter === 'fixes' ? 'CORREÇÕES RECENTES' : 'NOVIDADES DO JOGO'}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 mt-1">
                {filter === 'fixes'
                  ? 'Registro de correções com identificador UID exclusivo'
                  : 'Atualizações e correções recentes adicionadas ao projeto'}
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

        {/* Filter Tabs (R1.16.EG.4) */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <button
            type="button"
            onClick={() => setFilter('fixes')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              filter === 'fixes'
                ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                : 'bg-stone-950/70 border-stone-700 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Correções Recentes ({GAME_UPDATES.filter(u => u.isFix).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              filter === 'all'
                ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                : 'bg-stone-950/70 border-stone-700 text-stone-400 hover:text-stone-200'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Todas as Atualizações ({GAME_UPDATES.length})</span>
          </button>
        </div>

        {/* Changelog entries */}
        <div className="space-y-4 pt-4">
          {visibleEntries.map((entry, idx) => (
            <section
              key={entry.uid}
              className={`rounded-lg border p-4 ${
                idx === 0
                  ? 'bg-purple-950/30 border-purple-500/50'
                  : 'bg-stone-950/60 border-stone-800'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-stone-400">
                  <span className={idx === 0 ? 'text-purple-300 font-bold' : 'text-amber-300 font-bold'}>
                    {entry.version}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={idx === 0 ? 'text-amber-300 font-semibold' : 'text-stone-400'}>
                    {entry.label}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-[10px] font-mono text-emerald-300 select-all">
                  UID: {entry.uid}
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
