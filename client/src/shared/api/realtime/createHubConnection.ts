import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'

const REALTIME_BASE_URL = 'https://localhost:7018'
//const REALTIME_BASE_URL = 'https://enplusflow.dev.enplus.digital'

export function createHubConnection(path: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${REALTIME_BASE_URL}${path}`, {
      withCredentials: true,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
}
