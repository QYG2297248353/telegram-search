import { initConfig } from '@tg-search/common/node'
import { initLogger as initLogg, useLogger } from '@unbird/logg'

import { initDrizzle } from './db'

export function initLogger(): ReturnType<typeof useLogger> {
  initLogg()
  return useLogger()
}

export async function initDB(): Promise<ReturnType<typeof useLogger>> {
  const logger = initLogger()
  const config = await initConfig()

  try {
    await initDrizzle(logger, config)
    logger.log('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    throw error
  }

  return logger
}
