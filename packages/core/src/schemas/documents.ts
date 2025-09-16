// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { bigint, index, jsonb, pgTable, text, uuid, vector } from 'drizzle-orm/pg-core'

import { chatMessagesTable } from './chat_messages'

export const documentsTable = pgTable('documents', {
  id: uuid().primaryKey().defaultRandom(),
  chat_messages_id: uuid().notNull().references(() => chatMessagesTable.id),

  tags: jsonb().notNull().default([]),
  raw_content: text().notNull().default(''),
  processed_content: text().notNull().default(''),

  processed_content_jieba_tokens: jsonb().notNull().default([]),

  summary: text().notNull().default(''),
  summary_vector_1536: vector({ dimensions: 1536 }),
  summary_vector_1024: vector({ dimensions: 1024 }),
  summary_vector_768: vector({ dimensions: 768 }),

  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  deleted_at: bigint({ mode: 'number' }).notNull().default(0),
}, table => [
  index('documents_summary_vector_1536_index').using('hnsw', table.summary_vector_1536.op('vector_cosine_ops')),
  index('documents_summary_vector_1024_index').using('hnsw', table.summary_vector_1024.op('vector_cosine_ops')),
  index('documents_summary_vector_768_index').using('hnsw', table.summary_vector_768.op('vector_cosine_ops')),
  index('documents_processed_content_jieba_tokens_index').using('gin', table.processed_content_jieba_tokens.op('jsonb_path_ops')),
])
