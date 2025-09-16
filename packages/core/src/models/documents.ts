import type { CorePagination } from '@tg-search/common'

import { useLogger } from '@unbird/logg'
import { Ok } from '@unbird/result'
import { desc, eq, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { documentsTable } from '../schemas/documents'

export async function recordDocuments(documents: {
  chatMessagesId: string
  rawContent: string
  processedContent: string
  processedContentJiebaTokens: string[]
  summary: string
  summaryVector1536?: number[]
  summaryVector1024?: number[]
  summaryVector768?: number[]
  tags?: string[]
}[]) {
  if (documents.length === 0) {
    return Ok(undefined)
  }

  return withDb(async db => db
    .insert(documentsTable)
    .values(documents.map(doc => ({
      chat_messages_id: doc.chatMessagesId,
      raw_content: doc.rawContent,
      processed_content: doc.processedContent,
      processed_content_jieba_tokens: doc.processedContentJiebaTokens,
      summary: doc.summary,
      summary_vector_1536: doc.summaryVector1536,
      summary_vector_1024: doc.summaryVector1024,
      summary_vector_768: doc.summaryVector768,
      tags: doc.tags || [],
    })))
    .onConflictDoUpdate({
      target: [documentsTable.chat_messages_id],
      set: {
        raw_content: sql`excluded.raw_content`,
        processed_content: sql`excluded.processed_content`,
        processed_content_jieba_tokens: sql`excluded.processed_content_jieba_tokens`,
        summary: sql`excluded.summary`,
        summary_vector_1536: sql`COALESCE(excluded.summary_vector_1536, ${documentsTable.summary_vector_1536})`,
        summary_vector_1024: sql`COALESCE(excluded.summary_vector_1024, ${documentsTable.summary_vector_1024})`,
        summary_vector_768: sql`COALESCE(excluded.summary_vector_768, ${documentsTable.summary_vector_768})`,
        tags: sql`excluded.tags`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

export async function fetchDocuments(chatMessagesId: string, pagination: CorePagination) {
  return withDb(async db => db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.chat_messages_id, chatMessagesId))
    .orderBy(desc(documentsTable.created_at))
    .limit(pagination.limit)
    .offset(pagination.offset),
  )
}

export async function retrieveDocuments(
  content: {
    text?: string
    embedding?: number[]
  },
  pagination?: CorePagination,
) {
  const logger = useLogger('models:documents:retrieveDocuments')
  const documents = []

  if (content.text) {
    const relevantDocs = (await withDb(async db => db
      .select()
      .from(documentsTable)
      .where(sql`${documentsTable.processed_content_jieba_tokens} @> ${content.text}`)
      .limit(pagination?.limit || 10)
      .offset(pagination?.offset || 0),
    )).unwrap()
    logger.withFields({ relevantDocs: relevantDocs.length }).verbose('Retrieved jieba documents')
    documents.push(...relevantDocs)
  }

  if (content.embedding && content.embedding.length > 0) {
    const relevantDocs = (await withDb(async db => db
      .select()
      .from(documentsTable)
      .where(sql`${documentsTable.summary_vector_1536} <=> ${content.embedding}`)
      .limit(pagination?.limit || 10)
      .offset(pagination?.offset || 0),
    )).unwrap()
    logger.withFields({ relevantDocs: relevantDocs.length }).verbose('Retrieved vector documents')
    documents.push(...relevantDocs)
  }

  return Ok(documents)
}
