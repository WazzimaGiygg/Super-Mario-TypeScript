# Política de Preservação e Compatibilidade — Super-Mario-TypeScript (R0.15.6J.3)

Este documento define as diretrizes obrigatórias para evolução segura do projeto, protegendo mecânicas originais, compatibilidade multiplayer entre jogadores da mesma versão, integridade das regras do Firebase e estabilidade da autenticação Google.

---

## 1. Regras Obrigatórias de Preservação

1. **Preservação de Funcionalidades Existentes**: Nenhuma modalidade ou recurso funcional pode ser removido (Clássico, Campanha 7×5, Mapa SMW Beta V0.9, Modo Sem Fim, Editor de Fases, Ranking local, Modo Debug/Desenvolvedor, Controles Touch mobile, Áudio chiptune, Multiplayer Firebase e LAN WebSocket).
2. **Não Substituição de Sistemas Funcionais**: Sistemas estáveis (`GameEngine`, `SpriteAtlas`, `SoundEngine`, `ParticleSystem`, `CameraSystem`, `MultiplayerClient`, `src/firebase.ts`, `server.ts`) não devem ser substituídos sem necessidade técnica comprovada.
3. **Integridade dos Power-Ups (Efeitos Congelados)**:
   - `mushroom` → `super` (cresce para 30px; não regride formas superiores; +1000 pts).
   - `fireflower` → `fire` (permite até 2 bolas de fogo ativas; flor permanece parada sobre o bloco; +1000 pts).
   - `leaf` → `tanooki` (flutter no ar com `vy <= 1.15`, forma de estátua imune ao segurar Baixo no chão, ataque giratório 360° de cauda; +1000 pts).
   - `feather` → `cape` (impulso extra `1.12x` correndo, planagem ampla `vy <= 0.85`, mergulho com Baixo, giro de capa com deflexão de projéteis; +1000 pts).
   - `femboy` → `femboy` (multiplicador de salto `Math.SQRT2`, disparo de 2 bolas de fogo brancas ao aterrissar, partículas de coração; +1000 pts).
   - `star` → invencibilidade temporária por 600 frames (~10s), bônus de velocidade `1.15x`, derrota inimigos por contato em cadeia crescente; +1000 pts.
   - `1up` → +1 vida (`stats.lives + 1`).
4. **Integridade da Física Original**:
   - Constantes congeladas sem autorização explícita: resolução lógica `256×240`, tile `16px`, aceleração `0.16` (caminhada) / `0.22` (corrida) / `0.13` (água), velocidades máximas `2.0` / `3.4` (terra) e `1.55` / `2.2` (água), atrito `0.72` (chão) / `0.90` (ar), impulsos de salto `-7.4` / `-8.4`, corte variável de salto `-2.5`, gravidade `0.38` (subida) / `0.62` (descida) / `0.085` (água), velocidade terminal `7.0`.
5. **Integridade de Pontuação e Vidas**:
   - Moeda: `+200` pontos e `+1` moeda; ao atingir `100` moedas, zera o contador e concede `+1` vida.
   - Combos de pisoteio e casco seguem as tabelas clássicas (`100..8000` e `500..8000` antes de conceder `1-UP`).
   - Vidas iniciais por dificuldade: `easy` (`5`), `normal` (`3`), `hard` (`1`).
   - Proteção de recordes: partidas com Cheats/Debug ativos ou fases customizadas do Editor nunca atualizam o High Score nem gravam no Ranking local.
   - Personagem morto (`marioState === 'dead'`) não interage com inimigos, moedas ou power-ups.
6. **Autenticação Google (`src/firebase.ts`)**:
   - Evitar qualquer alteração desnecessária em `signInWithGoogle`, `signOutGoogle`, `subscribeAuth`, `upsertUserProfile` e `updatePreferredCharacter`.
7. **Regras de Segurança do Firebase (`firestore.rules` + `firebase-blueprint.json`)**:
   - Manter alinhamento estrito entre entidades do blueprint, payloads do cliente e validações de `firestore.rules`, validado continuamente via `@firebase/eslint-plugin-security-rules`.

---

## 2. Contrato de Compatibilidade Entre Jogadores da Mesma Versão

- **Limite de sala**: `MAX_ROOM_PLAYERS = 16` em ambos os transportes (`firebase` e `websocket`).
- **Esquema `RoomPlayer` (23 chaves obrigatórias/permitidas no Firestore)**:
  `uid`, `roomId`, `name`, `photoUrl`, `character`, `x`, `y`, `vx`, `vy`, `facing`, `power`, `state`, `animFrame`, `isStatue`, `tailWhipTimer`, `isFluttering`, `invulnerable`, `score`, `lives`, `coins`, `stageCleared`, `levelId`, `updatedAt`.
- **Interoperabilidade de Frequência**: clientes operando entre `10` e `20 Hz` (ou sob escala adaptativa `15/12/10/8 Hz`) mantêm compatibilidade total via interpolação assistida por velocidade (`renderX`/`renderY`), envio por deltas parciais (`updateDoc` / `player_update`) e ordenação monotônica por `seq` (WebSocket).
- **Eventos de Mundo**: tipos permitidos `['enemy_defeat', 'coin_collect', 'brick_break', 'level_change']`, suportando tanto eventos unitários quanto agrupados (`b:code@x,y|...` em `meta <= 64` no Firestore e `world_events_batch` no WebSocket).

---

## 3. Registro de Riscos de Incompatibilidade (Documentação Pré-Alteração)

Qualquer futura alteração que toque nos itens abaixo **deve ser documentada aqui antes da implementação**:

| ID | Área | Risco de Incompatibilidade | Mitigação Adotada / Regra |
|----|------|-----------------------------|---------------------------|
| **RISK-01** | `MarioPower: 'cape'` vs `firestore.rules` | `types.ts` e `server.ts` aceitam `'cape'`, mas `firestore.rules` restringe `data.power` a `['small', 'super', 'fire', 'tanooki', 'femboy']`. Alterar sem deploy sincronizado quebraria clientes na mesma versão. | `sanitizePowerForFirestore('cape')` serializa `'super'` apenas no Firestore e preserva `'cape'` localmente e via WebSocket. Não alterar `firestore.rules` sem deploy coordenado via `DeployRules`. |
| **RISK-02** | `affectedKeys().hasOnly(...)` no Firestore | Adicionar ou renomear campos em `RoomPlayer`, `MultiplayerRoom` ou `UserProfile` causaria `permission-denied` para clientes ou regras não sincronizadas. | Toda mudança de campos exige atualização conjunta em `firebase-blueprint.json`, `firestore.rules`, `multiplayer.ts`/`firebase.ts` e revalidação por testes de regressão. |
| **RISK-03** | Eventos agrupados (`b:...` / `world_events_batch`) | Mudanças no prefixo `b:` ou no limite de `64` caracteres em `RoomEvent.meta` causariam rejeição pelo Firestore ou falha de decodificação nos pares. | Manter formato `b:<c|b|e>@<x>,<y>` com limite rígido de 64 caracteres e fallback compatível para evento unitário. |
| **RISK-04** | Queries Firestore sem índices compostos adicionais | Adicionar `orderBy` combinado a `where('roomId', '==', roomId)` nas coleções `players`, `messages` ou `events` exige índices compostos novos e pode falhar em runtime. | Manter queries atuais com `where(...)` + `limit(...)` e ordenação local em memória. |
| **RISK-05** | Mudança de contratos WebSocket (`server.ts`) | Alterar nomes de mensagens (`join`, `room_joined`, `room_full`, `player_update`, `world_event`, `world_events_batch`, `chat`, `ping_probe`, `pong_probe`) ou semântica de `seq` quebra clientes LAN da mesma versão. | Contrato congelado na versão `R0.15.6J.x`; qualquer mudança requer versionamento explícito ou fallback retrocompatível. |
| **RISK-06** | Autenticação Google e `/users/{uid}` | Alterar chaves criadas/atualizadas em `src/firebase.ts` pode violar `isValidUserProfile` ou `diff(existing()).affectedKeys().hasOnly(...)`. | `src/firebase.ts` permanece congelado sem alterações desnecessárias. |

---

## 4. Pipeline Obrigatório de Verificação Após Cada Alteração

1. **TypeScript**: `npm run lint` (`tsc --noEmit`) — zero erros de tipagem.
2. **ESLint / Regras Firebase**: `npx eslint .` e `npx eslint firestore.rules` — zero erros ou avisos de segurança.
3. **Build de Produção**: `npm run build` (`vite build`) — compilação limpa.
4. **Testes de Regressão**: `npm run test:regression` (`tsx scripts/regression-tests.ts`) — 100% de aprovação em física, power-ups, pontuação, vidas, guarda de morte, regras do Firebase e compatibilidade multiplayer.
