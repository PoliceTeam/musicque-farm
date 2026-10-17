CREATE TABLE "pet_race_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"chances" json DEFAULT '[24,22,18,15,12,9]'::json NOT NULL,
	"return_rate_bps" integer DEFAULT 9000 NOT NULL,
	CONSTRAINT "pet_race_config_singleton" CHECK ("pet_race_config"."id" = 'default'),
	CONSTRAINT "pet_race_config_return_rate" CHECK ("pet_race_config"."return_rate_bps" > 0 AND "pet_race_config"."return_rate_bps" <= 10000)
);
