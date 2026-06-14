import { apiClient } from './client';
import type { StateMachineDefinition } from '../types/stateMachine';

export async function getStateMachineDefinition(): Promise<StateMachineDefinition> {
  const response = await apiClient.get<StateMachineDefinition>('/state-machine');
  return response.data;
}
