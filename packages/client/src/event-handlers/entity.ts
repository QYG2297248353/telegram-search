import type { ClientRegisterEventHandler } from '.'

// import { useWebsocketStore } from '../stores/useWebsocket'
import { useCoreBridgeWebsocketStore as useWebsocketStore } from '../stores/useCoreBridgeWebsocket'

export function registerEntityEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('entity:me:data', (data) => {
    useWebsocketStore().getActiveSession()!.me = data
  })
}
