import type { ProxyConfig } from '@tg-search/common'
import type { Result } from '@unbird/result'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import type { StringSession } from 'telegram/sessions'

import type { CoreContext } from '../context'

import { updateConfig, useConfig } from '@tg-search/common'
import { useLogger } from '@unbird/logg'
import { isBrowser } from '@unbird/logg/utils'
import { Err, Ok } from '@unbird/result'
import { Api, TelegramClient } from 'telegram'

import { waitForEvent } from '../utils/promise'

export interface ConnectionEventToCore {
  'auth:login': (data: { phoneNumber: string }) => void
  'auth:logout': () => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void
}

export interface ConnectionEventFromCore {
  'auth:code:needed': () => void
  'auth:password:needed': () => void
  'auth:connected': () => void
  'auth:error': (data: { error: unknown }) => void
}

export type ConnectionEvent = ConnectionEventFromCore & ConnectionEventToCore

export type ConnectionService = ReturnType<ReturnType<typeof createConnectionService>>

export function createConnectionService(ctx: CoreContext) {
  const { emitter, withError } = ctx

  return function (options: {
    apiId: number
    apiHash: string
    proxy?: ProxyConfig
  }) {
    const logger = useLogger()

    const getProxyInterface = (proxyConfig: ProxyConfig | undefined): ProxyInterface | undefined => {
      // Check if we have a valid proxy configuration
      if (!proxyConfig || !proxyConfig.ip || proxyConfig.ip === '' || !proxyConfig.port || proxyConfig.port === 0) {
        return undefined
      }

      if (proxyConfig.MTProxy && proxyConfig.secret) {
        // MTProxy configuration
        return {
          ip: proxyConfig.ip,
          port: proxyConfig.port,
          MTProxy: true,
          secret: proxyConfig.secret,
          timeout: proxyConfig.timeout || 15, // Default timeout of 15 seconds
        }
      }

      // SOCKS proxy configuration
      return {
        ip: proxyConfig.ip,
        port: proxyConfig.port,
        socksType: proxyConfig.socksType || 5, // Default to SOCKS5
        timeout: proxyConfig.timeout || 15, // Default timeout of 15 seconds
        username: proxyConfig.username,
        password: proxyConfig.password,
      }
    }

    async function init(initOptions: {
      session: StringSession
    }): Promise<Result<TelegramClient>> {
      const { session } = initOptions

      const proxy = getProxyInterface(options.proxy)
      if (proxy) {
        logger.withFields({ proxy }).verbose('Using proxy')
      }

      let useWSS = true

      // Use node and proxy
      if (!isBrowser() && proxy) {
        useWSS = false
      }

      const client = new TelegramClient(
        session,
        options.apiId,
        options.apiHash,
        {
          connectionRetries: 3,
          retryDelay: 10000,
          useWSS,
          proxy: isBrowser() ? undefined : proxy,
        },
      )

      return Ok(client)
    }

    async function login(loginOptions: {
      phoneNumber: string
      session: StringSession
    }): Promise<Result<TelegramClient>> {
      const { phoneNumber, session } = loginOptions

      try {
        const client = (await init({ session })).expect('Failed to initialize Telegram client')

        logger.verbose('Connecting to Telegram')

        // Try to connect to Telegram by using the session
        const isConnected = await client.connect()
        if (!isConnected) {
          return Err(withError(new Error('Failed to connect to Telegram')))
        }

        const isAuthorized = await client.isUserAuthorized()
        if (!isAuthorized) {
          logger.verbose('User is not authorized, signing in')

          await client.signInUser({
            apiId: options.apiId,
            apiHash: options.apiHash,
          }, {
            phoneNumber,
            phoneCode: async () => {
              // Set auto reconnect to false
              // TODO: reactivity
              useConfig().api.telegram.autoReconnect = false
              updateConfig(useConfig())

              logger.verbose('Waiting for code')
              emitter.emit('auth:code:needed')
              const { code } = await waitForEvent(emitter, 'auth:code')
              return code
            },
            password: async () => {
              logger.verbose('Waiting for password')
              emitter.emit('auth:password:needed')
              const { password } = await waitForEvent(emitter, 'auth:password')
              return password
            },
            onError: (err: Error) => {
              emitter.emit('auth:error', { error: err })
              withError(err, 'Failed to sign in to Telegram')
            },
          })
        }

        // TODO: reactivity
        useConfig().api.telegram.autoReconnect = true
        updateConfig(useConfig())

        // NOTE: The client will return string session, so convert it directly
        const sessionString = await client.session.save() as unknown as string
        logger.withFields({ sessionString }).verbose('Saving session')

        emitter.emit('session:update', { phoneNumber, session: sessionString })

        ctx.setClient(client)

        emitter.emit('auth:connected')

        // Emit me info
        emitter.emit('entity:me:fetch')

        return Ok(client)
      }
      catch (error) {
        emitter.emit('auth:error', { error })
        return Err(withError(error, 'Failed to connect to Telegram'))
      }
    }

    async function logout(client: TelegramClient) {
      if (client.connected) {
        await client.invoke(new Api.auth.LogOut())
        await client.disconnect()
      }

      client.session.delete()
      logger.verbose('Logged out from Telegram')
      return Ok(null)
    }

    return {
      login,
      logout,
    }
  }
}
