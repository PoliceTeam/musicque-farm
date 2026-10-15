CREATE TABLE "character_cosmetic_grants" (
	"player_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"data" json NOT NULL,
	CONSTRAINT "character_cosmetic_grants_player_id_character_id_grant_id_pk" PRIMARY KEY("player_id","character_id","grant_id")
);
--> statement-breakpoint
CREATE TABLE "character_item_instances" (
	"player_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"instance_id" text NOT NULL,
	"container" text NOT NULL,
	"bag_slot" integer,
	"equipped_slot" text,
	"data" json NOT NULL,
	CONSTRAINT "character_item_instances_player_id_character_id_instance_id_pk" PRIMARY KEY("player_id","character_id","instance_id"),
	CONSTRAINT "character_item_location" CHECK (("character_item_instances"."container" = 'bag' AND "character_item_instances"."bag_slot" >= 0 AND "character_item_instances"."bag_slot" IS NOT NULL AND "character_item_instances"."equipped_slot" IS NULL) OR ("character_item_instances"."container" = 'equipped' AND "character_item_instances"."equipped_slot" IS NOT NULL AND "character_item_instances"."bag_slot" IS NULL) OR ("character_item_instances"."container" = 'warehouse' AND "character_item_instances"."bag_slot" IS NULL AND "character_item_instances"."equipped_slot" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "character_inventories" (
	"player_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"bag_slots" integer NOT NULL,
	CONSTRAINT "character_inventories_player_id_character_id_pk" PRIMARY KEY("player_id","character_id"),
	CONSTRAINT "character_bag_slots_positive" CHECK ("character_inventories"."bag_slots" > 0)
);
--> statement-breakpoint
CREATE TABLE "character_cosmetic_unlocks" (
	"player_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"cosmetic_id" text NOT NULL,
	"data" json NOT NULL,
	CONSTRAINT "character_cosmetic_unlocks_player_id_character_id_cosmetic_id_pk" PRIMARY KEY("player_id","character_id","cosmetic_id")
);
--> statement-breakpoint
ALTER TABLE "character_cosmetic_grants" ADD CONSTRAINT "character_cosmetic_grants_player_id_character_id_character_inventories_player_id_character_id_fk" FOREIGN KEY ("player_id","character_id") REFERENCES "public"."character_inventories"("player_id","character_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_item_instances" ADD CONSTRAINT "character_item_instances_player_id_character_id_character_inventories_player_id_character_id_fk" FOREIGN KEY ("player_id","character_id") REFERENCES "public"."character_inventories"("player_id","character_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_inventories" ADD CONSTRAINT "character_inventories_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_cosmetic_unlocks" ADD CONSTRAINT "character_cosmetic_unlocks_player_id_character_id_character_inventories_player_id_character_id_fk" FOREIGN KEY ("player_id","character_id") REFERENCES "public"."character_inventories"("player_id","character_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_one_bag_slot" ON "character_item_instances" USING btree ("player_id","character_id","bag_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "character_one_equipped_slot" ON "character_item_instances" USING btree ("player_id","character_id","equipped_slot");