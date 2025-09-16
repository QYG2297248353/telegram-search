import type { MessageResolver, MessageResolverOpts } from '.'

import { useLogger } from '@unbird/logg'
import { Ok } from '@unbird/result'

import { recordDocuments } from '../models/documents'

export function createLinkResolver(): MessageResolver {
  const logger = useLogger('core:resolver:link')

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing link resolver')

      for (const message of opts.messages) {
        if (message.content) {
          const links = message.content.match(/https?:\/\/\S+/g)
          if (links && links.length > 0) {
            for (const link of links) {
              try {
                const response = await fetch(`https://r.jina.ai/${link}`, {
                  headers: {
                    // Authorization: `Bearer ${JINA_API_KEY}`,
                  },
                })

                if (!response.ok) {
                  logger.error(`Failed to scrape link: ${link}`)
                  continue
                }

                const doc = await response.text()

                logger.debug('Scraped document')

                await recordDocuments([{
                  chatMessagesId: message.uuid,
                  rawContent: doc,
                  processedContent: doc,
                  processedContentJiebaTokens: [],
                  summary: doc,
                }])
              }
              catch (err) {
                logger.withError(err).error(`Error scraping link: ${link}`)
              }
            }
          }
        }
      }

      return Ok(opts.messages)
    },
  }
}
