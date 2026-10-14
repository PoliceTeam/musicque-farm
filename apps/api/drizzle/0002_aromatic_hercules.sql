ALTER TABLE "players" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;