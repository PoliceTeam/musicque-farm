ALTER TABLE "players" ADD COLUMN "experience" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "fashion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "friendliness" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "happiness" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "mischief" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "health" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_experience_range" CHECK ("players"."experience" >= 0 AND "players"."experience" <= 9007199254740991);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_fashion_nonnegative" CHECK ("players"."fashion" >= 0);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_friendliness_nonnegative" CHECK ("players"."friendliness" >= 0);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_happiness_nonnegative" CHECK ("players"."happiness" >= 0);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_mischief_nonnegative" CHECK ("players"."mischief" >= 0);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "player_health_nonnegative" CHECK ("players"."health" >= 0);