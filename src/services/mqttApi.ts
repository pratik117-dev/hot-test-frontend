import { api } from './api';

export interface MqttConnectPayload {
  host: string;
  port: number;
  username: string;
  password: string;
  topicPrefix: string;
  useTls: boolean;
  clientId?: string;
}

export const mqttApi = {
  getStatus:   ()                          => api.get('/mqtt/status'),
  connect:     (payload: MqttConnectPayload) => api.post('/mqtt/connect', payload),
  disconnect:  ()                          => api.post('/mqtt/disconnect'),
  publish:     (topic: string, payload: object) => api.post('/mqtt/publish', { topic, payload }),
  testPublish: ()                          => api.post('/mqtt/test-publish'),
};
