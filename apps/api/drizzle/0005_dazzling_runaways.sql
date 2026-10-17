CREATE TABLE "pet_race_bets" (
	"round_id" text NOT NULL,
	"player_id" uuid NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pet_race_bets_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "pet_race_rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"record" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pet_race_bets" ADD CONSTRAINT "pet_race_bets_round_id_pet_race_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."pet_race_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_race_bets" ADD CONSTRAINT "pet_race_bets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pet_race_pending" ON "pet_race_bets" USING btree ("settled","ends_at");