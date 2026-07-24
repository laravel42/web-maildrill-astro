ALTER TABLE "campaigns" ADD COLUMN "channel" "channel" DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "list_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "segment_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "content" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;