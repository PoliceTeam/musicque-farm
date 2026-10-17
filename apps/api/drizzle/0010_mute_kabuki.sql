CREATE TABLE "friendships" (
	"low_id" uuid NOT NULL,
	"high_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_low_id_high_id_pk" PRIMARY KEY("low_id","high_id"),
	CONSTRAINT "friendships_order" CHECK ("friendships"."low_id" < "friendships"."high_id"),
	CONSTRAINT "friendships_requester" CHECK ("friendships"."requested_by" IN ("friendships"."low_id", "friendships"."high_id")),
	CONSTRAINT "friendships_status" CHECK ("friendships"."status" IN ('pending', 'accepted', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_low_id_players_id_fk" FOREIGN KEY ("low_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_high_id_players_id_fk" FOREIGN KEY ("high_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_players_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friendships_high_status" ON "friendships" USING btree ("high_id","status");--> statement-breakpoint
CREATE INDEX "friendships_low_status" ON "friendships" USING btree ("low_id","status");