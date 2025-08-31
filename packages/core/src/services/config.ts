import type { Config } from '@tg-search/common'

import type { CoreContext } from '../context'

import { configSchema } from '@tg-search/common'
import { isBrowser } from '@unbird/logg/utils'
import { safeParse } from 'valibot'

export interface ConfigEventToCore {
  'config:fetch': () => void
  'config:update': (data: { config: Config }) => void
}

export interface ConfigEventFromCore {
  'config:data': (data: { config: Config }) => void
}

export type ConfigEvent = ConfigEventFromCore & ConfigEventToCore

export type ConfigService = ReturnType<typeof createConfigService>

export function createConfigService(ctx: CoreContext) {
  const { emitter } = ctx

  async function fetchConfig() {
    let useConfig: () => Config
    if (isBrowser()) {
      const { useConfig: useConfigBrowser } = await import('@tg-search/common/browser')
      useConfig = useConfigBrowser
    }
    else {
      const { useConfig: useConfigNode } = await import('@tg-search/common/node')
      useConfig = useConfigNode
    }
    const config = useConfig()

    emitter.emit('config:data', { config })
  }

  async function updateConfig(config: Config) {
    const validatedConfig = safeParse(configSchema, config)
    // TODO: handle error
    if (!validatedConfig.success) {
      throw new Error('Invalid config')
    }

    if (isBrowser()) {
      const { updateConfig: updateConfigBrowser } = await import('@tg-search/common/browser')
      updateConfigBrowser(validatedConfig.output)
    }
    else {
      const { updateConfig: updateConfigNode } = await import('@tg-search/common/node')
      updateConfigNode(validatedConfig.output)
    }

    emitter.emit('config:data', { config: validatedConfig.output })
  }

  return {
    fetchConfig,
    updateConfig,
  }
}
