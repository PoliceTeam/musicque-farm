ALTER TABLE "players" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "username_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "registration_bonus_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_renamed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_username_unique" UNIQUE("username");