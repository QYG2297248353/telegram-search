CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_messages_id" uuid NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_content" text DEFAULT '' NOT NULL,
	"processed_content" text DEFAULT '' NOT NULL,
	"processed_content_jieba_tokens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"summary_vector_1536" vector(1536),
	"summary_vector_1024" vector(1024),
	"summary_vector_768" vector(768),
	"created_at" bigint DEFAULT 0 NOT NULL,
	"updated_at" bigint DEFAULT 0 NOT NULL,
	"deleted_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_chat_messages_id_chat_messages_id_fk" FOREIGN KEY ("chat_messages_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_summary_vector_1536_index" ON "documents" USING hnsw ("summary_vector_1536" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "documents_summary_vector_1024_index" ON "documents" USING hnsw ("summary_vector_1024" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "documents_summary_vector_768_index" ON "documents" USING hnsw ("summary_vector_768" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "documents_processed_content_jieba_tokens_index" ON "documents" USING gin ("processed_content_jieba_tokens" jsonb_path_ops);