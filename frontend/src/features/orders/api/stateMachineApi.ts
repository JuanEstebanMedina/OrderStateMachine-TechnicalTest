import { apiClient } from '../../../shared/api/apiClient';
import type { StateMachineDefinition } from '../model/stateMachine.types';

export async function getStateMachineDefinition(
  signal?: AbortSignal,
): Promise<StateMachineDefinition> {
  const response = await apiClient.get<StateMachineDefinition>('/state-machine', {
    signal,
  });
  return response.data;
}
