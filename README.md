# Super Mario Bros — TypeScript
 
Recriação do clássico Super Mario Bros em **TypeScript**, renderizada em **HTML5 Canvas** na resolução nativa do NES (256×240), com áudio chiptune sintetizado, controles retrô e **multiplayer online** via WebSocket.
 
> Projeto de fãs, sem fins comerciais e sem vínculo com a Nintendo. Veja o [aviso legal](#aviso-legal).
 
## Recursos
 
- **Renderização em Canvas** com escala configurável (0.5x a 2x ou ajuste automático) e filtro CRT opcional
- **Física e mecânicas clássicas:** corrida, derrapagem, pulo variável, blocos, canos de warp, mastro de bandeira e checkpoints
- **Power-ups:** Mario pequeno, super, fogo (bolas de fogo) e Tanooki (cauda, planar e estátua)
- **Inimigos:** Goomba, Koopa (com casco) e Planta Piranha
- **Fases:** 1-1, 1-2, cofre secreto e um modo de fase infinita
- **Dificuldades:** fácil, normal e difícil (vidas e tempo diferentes)
- **Áudio 8-bit** gerado em tempo real pelo Web Audio API, com controle de som e música
- **Placar local** (top 10) salvo no navegador
- **Controles:** teclado, gamepad e controles de toque para celular
- **Multiplayer:** salas, dois personagens (`mario` e `wazzima`), chat e sincronização de posição a 30 Hz
## Tecnologias
 
| Camada | Stack |
| --- | --- |
| Linguagem | TypeScript |
| Interface | React 19, Tailwind CSS 4, lucide-react, motion |
| Build | Vite 8 |
| Servidor | Node.js, Express, `ws` (WebSocket), `tsx` |
| Gerenciador de pacotes | **Bun** (`bun.lock`) |
 
## Requisitos
 
- [Bun](https://bun.sh) (recomendado) e Node.js 20 ou superior
- Um navegador moderno com suporte a Canvas e Web Audio
> **Atenção:** use `bun install`. O `npm install` pode falhar com erro `ERESOLVE`, por conflito entre a versão fixada do `esbuild` e o peer opcional do Vite 8. Se precisar usar npm, rode `npm install --legacy-peer-deps`.
 
## Como executar
 
```bash
# 1. Clonar o repositório
git clone https://github.com/WazzimaGiygg/Super-Mario-TypeScript.git
cd Super-Mario-TypeScript
 
# 2. Instalar as dependências
bun install
 
# 3. Iniciar em modo de desenvolvimento
bun run dev
```
 
Abra **http://localhost:3000** no navegador. Para usar outra porta:
 
```bash
PORT=8080 bun run dev
```
 
### Produção
 
```bash
bun run build                     # gera a pasta dist/
NODE_ENV=production bun run start # serve dist/ e o WebSocket
```
 
> O servidor importa o `vite` e roda via `tsx`, então as dependências de desenvolvimento precisam estar instaladas também em produção.
 
## Scripts
 
| Comando | Descrição |
| --- | --- |
| `bun run dev` | Servidor Express + Vite (HMR) + WebSocket |
| `bun run build` | Build de produção do cliente em `dist/` |
| `bun run start` | Mesmo servidor do `dev`; com `NODE_ENV=production` serve `dist/` |
| `bun run preview` | Pré-visualização do build via Vite (sem multiplayer) |
| `bun run lint` | Verificação de tipos (`tsc --noEmit`) |
| `bun run clean` | Remove `dist` e `server.js` |
 
## Controles
 
### Teclado
 
| Ação | Teclas |
| --- | --- |
| Mover | `←` `→` ou `A` `D` |
| Pular | `Espaço` ou `Z` |
| Correr / bola de fogo | `Shift`, `X` ou `K` |
| Agachar / entrar no cano | `↓` ou `S` |
| Pausar | `P` ou `Esc` |
| Reiniciar | `R` |
 
### Gamepad
 
D-Pad ou analógico para mover, `A` para pular, `B` para correr e `Start` para pausar.
 
### Celular
 
Os controles de toque aparecem na tela em dispositivos compatíveis.
 
## Multiplayer
 
O servidor mantém salas em memória e retransmite o estado dos jogadores via WebSocket no caminho `/ws`.
 
1. Abra o menu **Multiplayer** dentro do jogo.
2. Escolha o endereço do servidor (por padrão, o host atual), o nome da sala, seu nome e o personagem.
3. Conecte. Todos que entrarem na mesma sala se verão no mesmo mapa e poderão conversar pelo chat.
Para jogar em rede local, inicie o servidor em uma máquina e acesse `http://<IP-da-máquina>:3000` nas outras.
 
### Endpoints HTTP
 
| Rota | Retorno |
| --- | --- |
| `GET /api/health` | Status, conexões ativas e número de salas |
| `GET /api/rooms` | Lista de salas e jogadores conectados |
 
### Protocolo (resumo)
 
Mensagens JSON com o formato `{ type, roomId, senderId, payload }`. Tipos: `join`, `room_joined`, `player_joined`, `player_left`, `player_update`, `world_event` e `chat`.
 
## Estrutura do projeto
 
```
.
├── server.ts            # Express + WebSocket + Vite (dev) / arquivos estáticos (prod)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx / App.tsx
    ├── index.css
    ├── components/      # GameCanvas, HUD, controles de toque e modais
    └── game/
        ├── engine.ts       # Física, entidades, colisão e renderização
        ├── levels.ts       # Definição das fases
        ├── sprites.ts      # Atlas de sprites e paleta NES
        ├── audio.ts        # Sintetizador de som e música
        ├── multiplayer.ts  # Cliente WebSocket
        ├── scoreboard.ts   # Placar em localStorage
        └── types.ts        # Tipos compartilhados
```
 
## Limitações conhecidas
 
- A física é contada por frame, então a velocidade do jogo pode variar em monitores com taxa de atualização acima de 60 Hz.
- O multiplayer é cosmético: o estado de cada jogador é confiado ao próprio cliente e o servidor não valida identidade, tamanho de mensagens nem limita salas. **Não exponha o servidor diretamente na internet sem proteção adicional.**
- O placar é armazenado apenas no navegador (`localStorage`).
- Não há testes automatizados nem integração contínua.
## Contribuindo
 
1. Faça um fork e crie uma branch (`git checkout -b minha-melhoria`).
2. Rode `bun run lint` e `bun run build` antes de enviar.
3. Abra um Pull Request descrevendo a mudança.
## Licença
 
Distribuído sob a licença **GPL-3.0**. Consulte o arquivo [LICENSE](LICENSE).
 
## Aviso legal
 
Super Mario Bros e seus personagens pertencem à Nintendo. Este é um projeto de fãs, feito para estudo e entretenimento, sem fins lucrativos e sem afiliação ou endosso da Nintendo. A licença do código não concede direitos sobre propriedade intelectual de terceiros.
