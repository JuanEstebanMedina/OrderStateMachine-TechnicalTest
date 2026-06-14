import { apiClient } from '../../../shared/api/apiClient';
import type { StateMachineDefinition } from '../model/stateMachine.types';

export async function getStateMachineDefinition(): Promise<StateMachineDefinition> {
  const response = await apiClient.get<StateMachineDefinition>('/state-machine');
  return response.data;
}
