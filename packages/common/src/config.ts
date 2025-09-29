import type { Config, SocksType } from './config-schema'
import type { RuntimeFlags } from './flags'

import { useLogger } from '@unbird/logg'
import { isBrowser } from '@unbird/logg/utils'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { safeParse } from 'valibot'

import { configSchema, generateDefaultConfig } from './config-schema'

let config: Config
const logger = useLogger('common:config')
const CONFIG_STORAGE_KEY = 'settings/config'

export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

function validateAndMergeConfig(newConfig: Partial<Config>, baseConfig?: Config): Config {
  const mergedConfig = defu({}, newConfig, baseConfig || generateDefaultConfig())
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  return validatedConfig.output
}

function applyTelegramOverrides(config: Config, flags?: RuntimeFlags): void {
  if (flags?.telegramApiId || flags?.telegramApiHash) {
    config.api = config.api || {}
    const currentTelegram = config.api.telegram || {}
    config.api.telegram = {
      ...currentTelegram,
      ...(flags.telegramApiId && { apiId: flags.telegramApiId }),
      ...(flags.telegramApiHash && { apiHash: flags.telegramApiHash }),
    }
  }
}

function applyEmbeddingOverrides(config: Config, flags?: RuntimeFlags): void {
  if (
    flags?.embeddingProvider
    || flags?.embeddingModel
    || flags?.embeddingDimension
    || flags?.embeddingApiKey
    || flags?.embeddingApiBase
  ) {
    config.api = config.api || {}
    const currentEmbedding = config.api.embedding || {}
    config.api.embedding = {
      ...currentEmbedding,
      ...(flags.embeddingProvider && { provider: flags.embeddingProvider }),
      ...(flags.embeddingModel && { model: flags.embeddingModel }),
      ...(flags.embeddingDimension && { dimension: flags.embeddingDimension }),
      ...(flags.embeddingApiKey && { apiKey: flags.embeddingApiKey }),
      ...(flags.embeddingApiBase && { apiBase: flags.embeddingApiBase }),
    }
  }
}

function applyProxyOverrides(config: Config, flags?: RuntimeFlags): void {
  // Check if any proxy flags are set
  const hasProxyFlags = flags && (
    flags.proxyIp !== undefined
    || flags.proxyPort !== undefined
    || flags.proxyMTProxy !== undefined
    || flags.proxySecret !== undefined
    || flags.proxySocksType !== undefined
    || flags.proxyTimeout !== undefined
    || flags.proxyUsername !== undefined
    || flags.proxyPassword !== undefined
  )

  // Only apply proxy overrides if proxy flags are set
  if (hasProxyFlags) {
    config.api = config.api || {}
    const currentTelegram = config.api.telegram || {}

    // Build the new proxy configuration
    // Only include fields that have actual values (not undefined)
    const newProxyConfig: Record<string, any> = {}

    if (flags!.proxyIp !== undefined) {
      newProxyConfig.ip = flags!.proxyIp
    }
    else if (currentTelegram.proxy?.ip !== undefined) {
      newProxyConfig.ip = currentTelegram.proxy.ip
    }

    if (flags!.proxyPort !== undefined) {
      newProxyConfig.port = flags!.proxyPort
    }
    else if (currentTelegram.proxy?.port !== undefined) {
      newProxyConfig.port = currentTelegram.proxy.port
    }

    if (flags!.proxyMTProxy !== undefined) {
      newProxyConfig.MTProxy = flags!.proxyMTProxy
    }
    else if (currentTelegram.proxy?.MTProxy !== undefined) {
      newProxyConfig.MTProxy = currentTelegram.proxy.MTProxy
    }

    if (flags!.proxySecret !== undefined) {
      newProxyConfig.secret = flags!.proxySecret
    }
    else if (currentTelegram.proxy?.secret !== undefined) {
      newProxyConfig.secret = currentTelegram.proxy.secret
    }

    if (flags!.proxySocksType !== undefined) {
      newProxyConfig.socksType = flags!.proxySocksType
    }
    else if (currentTelegram.proxy?.socksType !== undefined) {
      newProxyConfig.socksType = currentTelegram.proxy.socksType
    }

    if (flags!.proxyTimeout !== undefined) {
      newProxyConfig.timeout = flags!.proxyTimeout
    }
    else if (currentTelegram.proxy?.timeout !== undefined) {
      newProxyConfig.timeout = currentTelegram.proxy.timeout
    }

    if (flags!.proxyUsername !== undefined) {
      newProxyConfig.username = flags!.proxyUsername
    }
    else if (currentTelegram.proxy?.username !== undefined) {
      newProxyConfig.username = currentTelegram.proxy.username
    }

    if (flags!.proxyPassword !== undefined) {
      newProxyConfig.password = flags!.proxyPassword
    }
    else if (currentTelegram.proxy?.password !== undefined) {
      newProxyConfig.password = currentTelegram.proxy.password
    }

    // Only set the proxy configuration if it has actual values (not just defaults)
    // Both ip and port must be valid for the proxy to work
    const hasValidProxyConfig = newProxyConfig.ip !== undefined
      && newProxyConfig.ip !== ''
      && newProxyConfig.port !== undefined
      && newProxyConfig.port !== 0

    if (hasValidProxyConfig) {
      // Create a properly typed proxy configuration object
      const typedProxyConfig: {
        ip: string
        port: number
        MTProxy?: boolean
        secret?: string
        socksType?: SocksType
        timeout?: number
        username?: string
        password?: string
      } = {
        ip: newProxyConfig.ip,
        port: newProxyConfig.port,
      }

      // Add optional properties only if they exist
      if (newProxyConfig.MTProxy !== undefined)
        typedProxyConfig.MTProxy = newProxyConfig.MTProxy
      if (newProxyConfig.secret !== undefined)
        typedProxyConfig.secret = newProxyConfig.secret
      if (newProxyConfig.socksType !== undefined)
        typedProxyConfig.socksType = newProxyConfig.socksType
      if (newProxyConfig.timeout !== undefined)
        typedProxyConfig.timeout = newProxyConfig.timeout
      if (newProxyConfig.username !== undefined)
        typedProxyConfig.username = newProxyConfig.username
      if (newProxyConfig.password !== undefined)
        typedProxyConfig.password = newProxyConfig.password

      config.api.telegram = {
        ...currentTelegram,
        proxy: typedProxyConfig,
      }
    }
  }
}

export async function initConfig(flags?: RuntimeFlags) {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const savedConfig = configStorage.value
    if (savedConfig) {
      try {
        config = validateAndMergeConfig(savedConfig)
        return config
      }
      catch {}
    }

    config = generateDefaultConfig()
    return config
  }

  const { useConfigPath } = await import('./node/path')
  const { readFileSync } = await import('node:fs')
  const { parse } = await import('yaml')

  const configPath = await useConfigPath()

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const validatedConfig = validateAndMergeConfig(configParsedData)
  const runtimeConfig = applyRuntimeOverrides(validatedConfig, flags)

  config = runtimeConfig

  logger.withFields(config).log('Config loaded')
  return config
}

function applyRuntimeOverrides(baseConfig: Config, flags?: RuntimeFlags): Config {
  const runtimeConfig: Config = {
    ...baseConfig,
    database: { ...baseConfig.database },
  }

  if (baseConfig.api) {
    runtimeConfig.api = { ...baseConfig.api }
  }

  // Apply database URL override
  runtimeConfig.database.type = flags?.dbProvider || runtimeConfig.database.type
  runtimeConfig.database.url = flags?.dbUrl || runtimeConfig.database.url || getDatabaseDSN(runtimeConfig)

  // Apply API overrides
  applyTelegramOverrides(runtimeConfig, flags)
  applyEmbeddingOverrides(runtimeConfig, flags)
  applyProxyOverrides(runtimeConfig, flags)

  return runtimeConfig
}

export async function updateConfig(newConfig: Partial<Config>) {
  if (isBrowser()) {
    const configStorage = useLocalStorage(CONFIG_STORAGE_KEY, generateDefaultConfig())

    const validatedConfig = validateAndMergeConfig(newConfig, config)

    logger.withFields({ config: validatedConfig }).log('Updating config')

    config = validatedConfig
    configStorage.value = config

    return config
  }

  const { useConfigPath } = await import('./node/path')
  const { writeFileSync } = await import('node:fs')
  const { stringify } = await import('yaml')

  const configPath = await useConfigPath()

  const validatedConfig = validateAndMergeConfig(newConfig, config)
  validatedConfig.database.url = getDatabaseDSN(validatedConfig)

  logger.withFields({ config: validatedConfig }).log('Updating config')
  writeFileSync(configPath, stringify(validatedConfig))

  config = validatedConfig
  return config
}

export function useConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized')
  }

  return config
}
