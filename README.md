# Super Mario Bros. TypeScript Canvas

Recriação em **TypeScript + React + HTML5 Canvas (60 FPS)** inspirada nos clássicos *Super Mario Bros.* (NES) e *Super Mario World* (SNES), com física fiel, áudio chiptune 8-bit sintetizado via Web Audio API, editor completo de fases, campanha no mapa do mundo (*Ilha WikiWorldWeb*), multiplayer via WebSocket e placar online via Firebase.

---

## Sumário

- [Visão Geral e Modos de Jogo](#visão-geral-e-modos-de-jogo)
- [Controles](#controles)
- [Power-Ups, Carteira e Mecânicas Especiais](#power-ups-carteira-e-mecânicas-especiais)
- [Inimigos, Objetos e Chefes](#inimigos-objetos-e-chefes)
- [Modo World (Ilha WikiWorldWeb) e Fases em JSON](#modo-world-ilha-wikiworldweb-e-fases-em-json)
- [Editor de Fases e Campanhas Personalizadas](#editor-de-fases-e-campanhas-personalizadas)
- [Multiplayer em Tempo Real](#multiplayer-em-tempo-real)
- [Dificuldade, Conquistas e Ranking](#dificuldade-conquistas-e-ranking)
- [Comerciais Pré-Jogo (Ecossistema WazzimaGiygg)](#comerciais-pré-jogo-ecossistema-wazzimagiygg)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar e Testar](#como-executar-e-testar)

---

## Visão Geral e Modos de Jogo

Ao abrir o jogo, o menu principal oferece três modos principais de aventura além dos utilitários:

1. **Jogar Clássico (`classic`)**
   - Progressão tradicional inspirada no NES com fases como *Mundo 1-1*, *Mundo 1-2* (caverna), *Mundo 2-2* (aquática), *Mansão Fantasma*, *Mundo 1-4* (castelo com Bowser) e *Modo Sem Fim* (geração procedural).
2. **Modo World (`smw_world_map`)**
   - Mapa interativo estilo *Super Mario World* (**Ilha WikiWorldWeb**) com estradas conectadas, movimentação bidirecional entre fases já desbloqueadas, **3 slots manuais de salvamento** (*Carregar World*), saída secreta por cano + chave/fechadura, **Palácios Interruptores `[!]`** e **Poste de Pontos (Goal Tape)**.
   - Também inclui uma prévia da **Ilha 2 · Terras de Chronus** (marcada como indisponível na Beta).
3. **7 Mundos (`singleplayer`)**
   - Campanha estendida estruturada em 7 mundos com 5 fases por mundo (35 fases em sequência até a vitória final).

> **Bloqueio de segurança em partida**: Após iniciar uma partida normal, a troca de modo e o Editor de Fases ficam bloqueados durante a sessão (exceto quando o jogador está testando no próprio Editor ou no Modo Desenvolvedor).

---

## Controles

### Teclado (PC)

| Ação | Teclas |
| --- | --- |
| **Mover / Agachar / Entrar em canos** | `Setas` ou `W A S D` |
| **Pular** (segure para salto mais alto) | `Espaço`, `Z` ou `W` |
| **Correr / Lançar Bola de Fogo / Girar Cauda / Planar / Carregar Casco ou Chave** | `Shift`, `X` ou `K` |
| **Pulo Carpado (Spin Jump / Desmontar do Yoshi)** | `C` ou `Q` |
| **Select** *(usar Power-Up da Carteira; quando pausado no Modo World, sair de fase já concluída)* | `V` ou `Tab` |
| **Pausar / Continuar** | `P` ou `Esc` |

### Gamepad, Touch e Smart TV

- **Gamepad (USB / Bluetooth)**: Suporte nativo via Browser Gamepad API (D-Pad/Analógico, pulo, corrida/ataque, Start e Select).
- **Dispositivos Touch**: Controles virtuais na tela (`TouchControls`) para movimentação, pulo, corrida e botões de ação.
- **Smart TV (Tizen, WebOS, Android TV, Fire TV, Roku)**:
  - Detecção automática (ou ativável nas *Opções*) com navegação espacial D-Pad entre botões dos menus.
  - Suporte opcional de **Corrida Automática na TV**, mapeamento de teclas de controle remoto (`Direcional`, `4/6/8`, `OK/Enter/Vermelho`, `Azul/Verde/Amarelo/0`, `Voltar/Return/Play-Pause`).

---

## Power-Ups, Carteira e Mecânicas Especiais

### Power-Ups

- **Super Mushroom**: Transforma Mario em Super Mario (`30px` de altura) e permite quebrar blocos de tijolo por baixo.
- **Fire Flower**: Permite lançar até **2 bolas de fogo simultâneas** (transformando inimigos comuns em moedas, exceto fantasmas e esqueletos).
- **Super Leaf (Tanooki)**: Concede ataque giratório de cauda, planagem controlada (`vy <= 1.15`) e transformação temporária em estátua imune.
- **Cape Feather (Capa)**: Super impulso ao correr, salto elevado e planagem ampla estilo SMW (`vy <= 0.90`).
- **Laço Femboy**: Concede salto amplificado (`√2`) e dispara **2 bolas de fogo brancas** ao aterrissar.
- **Starman**: Invencibilidade temporária (600 frames) que derrota inimigos ao toque.
- **1-UP Mushroom**: +1 vida extra (também ganha +1 vida a cada **100 moedas**).

### Carteira de Power-Up e Pontos de Poste (SMW)

- **Carteira de Power-Up (Caixa de Reserva)**: Ao pegar um novo power-up já estando transformado, o item anterior fica armazenado na reserva superior do HUD. Ao sofrer dano ou pressionar **Select (`V` / `Tab`)**, o item reserva cai do topo da tela.
- **Moedas Gigantes `W`**: Cada fase possui **4 Moedas `W`** flutuantes; coletar as 4 concede **+1 vida**.
- **Poste de Pontos (Goal Tape)**: Acertar a fita móvel do poste soma pontos na carteira de metas:
  - **50 pontos**: concede **+3 vidas**.
  - **100 pontos**: abre o **Bonus Stage** (fase bônus com seleção de power-up e vidas extras).
- **Pulo Carpado (Spin Jump)**: Quica em segurança sobre inimigos espinhosos e Boos, além de desmontar do Yoshi.
- **Chave, Fechadura e Botões `P`**: No Modo World e em fases customizadas, é possível segurar chaves (`Correr`) e levá-las até a **Fechadura (`Keyhole`)** para abrir saídas secretas com animação de íris estilo SMW, além de pisar em botões `P` azuis/cianos móveis.

---

## Inimigos, Objetos e Chefes

- **Inimigos clássicos**: *Goomba*, *Koopa Troopa* (verde e vermelho que evita cair de quinas, entra no casco e desliza ao ser chutado), *Paratroopa*, *Piranha Plant* (emerge de canos verdes em intervalos temporizados e pausa quando Mario está próximo), *Hammer Bro*, *Bullet Bill*, *Lava Bubble*, *Blooper*, *Cheep-Cheep* (normal e rápido).
- **Mansão e Castelo**: *Boo* (persegue apenas quando Mario vira de costas), *Dry Bones* (reconstitui após ser pisado) e **Bowser / Lorde Ignis Koopa** (boss do castelo *W-5*, derrotado pelo machado na ponte ou ataques).
- **Blocos `[!]` Coloridos**: Blocos intangíveis que se tornam sólidos após concluir o respectivo **Palácio Interruptor `[!]`** (Amarelo desbloqueado pela saída secreta de *W-1*; Verde, Vermelho, Rosa e Azul acessíveis via Modo Desenvolvedor).
- **Yoshi**: Montaria disponível no **Editor de Fases** e no **Modo Debug** (automaticamente impedido de entrar em fases com tema de castelo).

---

## Modo World (Ilha WikiWorldWeb) e Fases em JSON

Todas as **11 fases do Modo World** ficam armazenadas como arquivos JSON individuais em `src/game/worldLevels/` no formato exato de exportação do Editor (`smb-custom-level` v1):

| Arquivo JSON | Fase no Modo World |
| --- | --- |
| `wiki-1-overworld.json` | **W-1** — Overworld (*Yoshi's Island 2* + cano secreto da caverna da chave em `x = 33`) |
| `smw-wiki-1-secret.json` | **W-1 Subsolo** — Caverna da Chave + Fechadura (retorno exato para `W-1` e saída secreta para `PA`) |
| `wiki-2-caverna.json` | **W-2** — Caverna subterrânea |
| `wiki-3-agua.json` | **W-3** — Lagoa costeira (tema aquático) |
| `wiki-4-mansao.json` | **W-4** — Mansão Fantasma |
| `wiki-5-castelo.json` | **W-5** — Castelo de Johannnnes89 (*1º Chefe: Lorde Ignis Koopa*) |
| `wiki-switch-yellow.json` | **PA** — Palácio Interruptor Amarelo |
| `wiki-switch-green.json` | **PV** — Palácio Interruptor Verde *(Dev)* |
| `wiki-switch-red.json` | **PR** — Palácio Interruptor Vermelho *(Dev)* |
| `wiki-switch-pink.json` | **PP** — Palácio Interruptor Rosa *(Dev)* |
| `wiki-switch-blue.json` | **PB** — Palácio Interruptor Azul *(Dev)* |

### Fluxo de Edição e Substituição Manual

1. Abra o **Editor de Fases** no jogo.
2. Em **Importar Base... → Modo World (JSON)**, escolha qualquer uma das 11 fases (ou envie um `.json` via **Upload**).
3. Edite terreno, blocos, moedas, inimigos, canos ou checkpoints (até os limites seguros do editor) e clique em **Exportar**.
4. O arquivo baixado já virá com o nome exato da fase (ex.: `wiki-1-overworld.json`), permitindo substituir diretamente o arquivo correspondente em `src/game/worldLevels/`.

---

## Editor de Fases e Campanhas Personalizadas

O **Editor de Fases** (`LevelEditorModal`) permite criar e testar mapas na memória da sessão sem poluir os recordes oficiais:

- **Paleta completa**: blocos (`ground`, `brick`, `question`, `hard_block`, blocos invisíveis, blocos bônus), itens, moedas, inimigos, plataformas flutuantes, Yoshi, fechadura, chave, botões `P`, mastro de bandeira, machado de castelo e o **Cano Caverna Chave** exclusivo (leva o jogador ao subsolo secreto com chave/fechadura e retorna ao cano de origem ou avança a campanha).
- **Temas e largura ajustável**: Superfície, Caverna, Água, Mansão Fantasma e Castelo, com redimensionamento de largura (incluindo larguras customizadas das fases do Modo World).
- **Histórico e testes**: Desfazer/Refazer (`Ctrl+Z` / `Ctrl+Y`, até 35 ações), modo **Imortal ON/OFF** para testar fases difíceis e validação automática de objetivo da fase.
- **Campanha Personalizada**: Adicione várias fases criadas em sequência na aba **Campanha** e jogue todas em ordem contínua.

---

## Multiplayer em Tempo Real

O servidor Express integrado (`server.ts`) expõe um servidor WebSocket em `/ws` com suporte a salas de até **16 jogadores**:

- **Sincronização em tempo real**: posição, velocidade, estado, power-up, eventos de partida em lote e detecção de inatividade (heartbeat a cada 20s e remoção de salas ociosas após 5 minutos).
- **Personagens selecionáveis**: jogue como **Mario** ou **Wazzima**.
- **Modos de sala e placar**: criação/entrada por código de sala, medição de ping e compatibilidade estrita por versão do protocolo.

---

## Dificuldade, Conquistas e Ranking

### Dificuldades

- **Fácil**: **5 vidas** iniciais.
- **Normal**: **3 vidas** iniciais.
- **Difícil**: **1 vida** inicial.

> Na tela de **Game Over**, a trilha é encerrada sem loops e o jogador conta com a opção direta de voltar para a **Tela Inicial**.

### Conquistas

O jogo rastreia **8 conquistas** persistidas localmente, concedendo pontos extras e vidas bônus ao desbloquear:
- *Caçador de Goombas*, *Velocista* (< 60s), *Varredor de Fases*, *Caçador de Moedas*, *Demolidor*, *Colecionador W*, *Algoz de Bowser* e *Aventureiro*.

### Ranking Online (Firebase) e Proteção de Recordes

- Autenticação com **Google** via Firebase Auth e envio de pontuações para o **Firestore** (`leaderboard`), protegido por `firestore.rules`.
- **Anti-trapaça**: partidas iniciadas no **Editor de Fases** ou com **Modo Desenvolvedor / Cheats** ativados bloqueiam automaticamente a gravação de High Score e o envio ao Ranking.

---

## Comerciais Pré-Jogo (Ecossistema WazzimaGiygg)

Antes de iniciar uma partida a partir da tela inicial, é exibido um comercial interativo de **15 segundos** com botão **"Pular comercial"** liberado ao fim da contagem, trilha sonora própria, narração sintetizada de texto (*SpeechSynthesis*) e suspensão automática do áudio do jogo durante a exibição:

1. **WikiMaker** (`https://wikimaker.wazzimagiygg.com/`) — plataforma para criação e publicação de wikis no ecossistema WazzimaGiygg.
2. **Dossiê A Verdade — Wikipédia** (`https://wazzimagiygg.com/averdade/`) — apresentação do dossiê investigativo sobre a Wikipédia lusófona.

---

## Estrutura do Projeto

```text
├── server.ts                     # Servidor Express + Vite middleware + WebSocket multiplayer (/ws)
├── index.html                    # Entrada HTML e fontes retrô
├── firestore.rules               # Regras de segurança do Firestore
├── scripts/
│   └── regression-tests.ts       # Suíte automatizada de testes de regressão (75 testes)
└── src/
    ├── App.tsx                   # Shell principal da aplicação
    ├── firebase.ts               # Inicialização Firebase Auth + Firestore
    ├── components/
    │   ├── GameCanvas.tsx        # Loop de renderização Canvas, teclado/gamepad, menus e overlays
    │   ├── SmwOverworldMap.tsx   # Mapa interativo do Modo World (Ilha WikiWorldWeb e Ilha 2)
    │   ├── LevelEditorModal.tsx  # Editor de fases, campanhas e importação/exportação JSON
    │   ├── WazzimaCommercialOverlay.tsx # Overlay dos comerciais pré-jogo de 15s
    │   ├── RetroHUD.tsx          # HUD estilo clássico/SMW (pontos, moedas, tempo, reserva)
    │   ├── SettingsModal.tsx     # Seleção de fases, dificuldade, escala, Smart TV e Debug
    │   ├── MultiplayerModal.tsx  # Criação/entrada em salas WebSocket
    │   ├── LeaderboardModal.tsx  # Ranking global via Firestore
    │   ├── AchievementsModal.tsx # Painel de conquistas
    │   ├── CheatMenuModal.tsx    # Página do Desenvolvedor
    │   ├── UpdatesModal.tsx      # Histórico de novidades e correções
    │   └── TouchControls.tsx     # Controles virtuais para telas sensíveis ao toque
    └── game/
        ├── engine.ts             # Motor de física, colisão, power-ups, IA de chefes e estados
        ├── levels.ts             # Geradores clássicos, sanitização, serialize/parse JSON
        ├── smwWorldMap.ts        # Grafo da Ilha WikiWorldWeb, slots e registro dos JSONs do World
        ├── worldLevels/          # 11 arquivos .json das fases do Modo World
        ├── audio.ts              # Sintetizador chiptune 8-bit (Web Audio API)
        ├── sprites.ts            # Atlas procedural de sprites e tiles em Canvas
        ├── commercials.ts        # Dados e cenas dos comerciais do ecossistema WazzimaGiygg
        ├── achievements.ts       # Definições e persistência das conquistas
        ├── multiplayer.ts        # Cliente WebSocket e sincronização de rede
        ├── smartTv.ts            # Detecção de Smart TV e mapeamento de controle remoto
        ├── modePolicy.ts         # Políticas de bloqueio de modo/editor em partida
        └── types.ts              # Tipos TypeScript do motor e entidades
```

---

## Como Executar e Testar

### Pré-requisitos
- **Node.js 22+** (com `npm`)

### Instalação e Execução Local

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (Express + Vite + WebSocket na porta 3000)
npm run dev
```

Acesse `http://localhost:3000` no navegador.

### Scripts Disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor completo (`tsx server.ts`) na porta `3000` |
| `npm run build` | Gera o build de produção em `dist/` via Vite |
| `npm run start` | Executa o servidor em modo de produção |
| `npm run lint` | Executa verificação de tipos TypeScript (`tsc --noEmit`) |
| `npm run test:regression` | Roda toda a suíte de testes automatizados de regressão |

---

*Projeto não oficial de fãs (WazzimaGiygg). Personagens e elementos originais pertencem à Nintendo.*
