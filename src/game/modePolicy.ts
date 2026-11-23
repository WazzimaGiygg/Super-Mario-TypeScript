/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ActiveGameMode = 'classic' | 'smw_world_map' | 'singleplayer';

export interface ModeAndEditorPolicyInput {
  hasStarted: boolean;
  isDeveloperMode: boolean;
  isUsingEditor: boolean;
  isCampaignVictory?: boolean;
  isGameOver?: boolean;
}

/**
 * Uma vez iniciada a partida (Normal/Clássico, Modo World ou 7 Fases),
 * trocar de modo de jogo ou abrir o Editor de Fases fica bloqueado,
 * exceto quando o Modo Desenvolvedor estiver ativo ou o usuário estiver usando o Editor.
 */
export function isModeAndEditorLocked(input: ModeAndEditorPolicyInput): boolean {
  return Boolean(input.hasStarted && !input.isDeveloperMode && !input.isUsingEditor);
}

export function canOpenLevelEditor(input: ModeAndEditorPolicyInput): boolean {
  return !isModeAndEditorLocked(input);
}

export function canSwitchGameMode(input: ModeAndEditorPolicyInput): boolean {
  return !isModeAndEditorLocked(input);
}

export function canExitToMainMenu(input: ModeAndEditorPolicyInput): boolean {
  return (
    !isModeAndEditorLocked(input) ||
    Boolean(input.isCampaignVictory) ||
    Boolean(input.isGameOver)
  );
}
