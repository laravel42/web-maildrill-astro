CREATE TABLE "email_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"domain_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_domains_name_uq" ON "email_domains" USING btree ("domain_name");--> statement-breakpoint
CREATE INDEX "email_domains_tenant_idx" ON "email_domains" USING btree ("tenant_id");