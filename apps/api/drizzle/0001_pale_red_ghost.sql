CREATE TABLE "arcade_seats" (
	"player_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"table_id" uuid NOT NULL,
	CONSTRAINT "arcade_seats_player_id_game_id_pk" PRIMARY KEY("player_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "arcade_tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"channel" integer NOT NULL,
	"room_id" integer NOT NULL,
	"table_id" integer NOT NULL,
	"record" json NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arcade_seats" ADD CONSTRAINT "arcade_seats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcade_seats" ADD CONSTRAINT "arcade_seats_table_id_arcade_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."arcade_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arcade_tables_address" ON "arcade_tables" USING btree ("game_id","channel","room_id","table_id");