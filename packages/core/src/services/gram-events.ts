import type { Config } from '@tg-search/common'
import type { Api } from 'telegram'

import type { CoreContext } from '../context'

import { isBrowser } from '@unbird/logg/utils'
import { NewMessage } from 'telegram/events'

export interface GramEventsEventToCore {}

export interface GramEventsEventFromCore {
  'gram:message:received': (data: { message: Api.Message }) => void
}

export type GramEventsEvent = GramEventsEventFromCore & GramEventsEventToCore
export type GramEventsService = ReturnType<typeof createGramEventsService>

export function createGramEventsService(ctx: CoreContext) {
  const { emitter, getClient } = ctx

  async function registerGramEvents() {
    let useConfig: () => Config
    if (isBrowser()) {
      const { useConfig: useConfigBrowser } = await import('@tg-search/common/browser')
      useConfig = useConfigBrowser
    }
    else {
      const { useConfig: useConfigNode } = await import('@tg-search/common/node')
      useConfig = useConfigNode
    }
    getClient().addEventHandler((event) => {
      if (event.message && useConfig().api.telegram.receiveMessage) {
        emitter.emit('gram:message:received', { message: event.message })
      }
    }, new NewMessage({}))
  }

  return {
    registerGramEvents,
  }
}
