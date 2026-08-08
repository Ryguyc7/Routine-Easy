import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const routines = sqliteTable("routines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  time: text("time").notNull(),
  days: text("days").notNull(),
  trackingMode: text("tracking_mode").notNull().default("simple"),
  targetCount: integer("target_count").notNull().default(1),
  unit: text("unit").notNull().default("times"),
  amountConfig: text("amount_config").notNull().default("[]"),
  dayVariants: text("day_variants").notNull().default("{}"),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
});

export const completions = sqliteTable("completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  routineId: integer("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
}, (table) => [uniqueIndex("idx_completions_owner_routine_date").on(table.ownerKey, table.routineId, table.date)]);

export const routineItems = sqliteTable("routine_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  routineId: integer("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
}, (table) => [index("idx_routine_items_owner_routine_position").on(table.ownerKey, table.routineId, table.position)]);

export const itemCompletions = sqliteTable("item_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  itemId: integer("item_id").notNull().references(() => routineItems.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
}, (table) => [uniqueIndex("idx_item_completions_owner_item_date").on(table.ownerKey, table.itemId, table.date)]);

export const quantityCompletions = sqliteTable("quantity_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  routineId: integer("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [uniqueIndex("idx_quantity_completions_owner_routine_date").on(table.ownerKey, table.routineId, table.date)]);

export const amountCompletions = sqliteTable("amount_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key").notNull(),
  routineId: integer("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
  amountKey: text("amount_key").notNull(),
  date: text("date").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [uniqueIndex("idx_amount_completions_owner_routine_amount_date").on(table.ownerKey, table.routineId, table.amountKey, table.date)]);
