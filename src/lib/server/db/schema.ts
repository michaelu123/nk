import { relations } from 'drizzle-orm';
import { mysqlTable, int, varchar, datetime, text, primaryKey } from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
	id: varchar('id', { length: 255 }).primaryKey(),
	age: int('age'),
	username: varchar('username', { length: 32 }).notNull().unique(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull()
});

export const session = mysqlTable('session', {
	id: varchar('id', { length: 255 }).primaryKey(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	expiresAt: datetime('expires_at').notNull()
});

export type Session = typeof session.$inferSelect;

export type User = typeof user.$inferSelect;

export const nk = mysqlTable('nk', {
	id: int().primaryKey().autoincrement(),
	username: varchar({ length: 255 }),
	region: varchar({ length: 6 })
		.notNull()
		.references(() => regions.shortname),
	data: text(),
	createdAt: datetime('created_at'),
	changedAt: datetime('changed_at'),
	deletedAt: datetime('deleted_at')
});

export const kontrollen = mysqlTable('kontrollen', {
	id: int().primaryKey().autoincrement(),
	username: varchar({ length: 255 }),
	nkid: int('nkid')
		.notNull()
		.references(() => nk.id, { onDelete: 'cascade' }),
	region: varchar({ length: 6 })
		.notNull()
		.references(() => regions.shortname),
	data: text(),
	createdAt: datetime('created_at'),
	changedAt: datetime('changed_at'),
	deletedAt: datetime('deleted_at')
});

export const regions = mysqlTable('regions', {
	id: int().primaryKey().autoincrement(),
	shortname: varchar({ length: 6 }).unique(),
	regionname: varchar({ length: 255 }).unique(),
	data: text(),
	createdAt: datetime('created_at'),
	changedAt: datetime('changed_at'),
	deletedAt: datetime('deleted_at')
});

// user <-> region many to many
export const userregions = mysqlTable(
	'userregions',
	{
		userid: varchar('userid', { length: 255 })
			.notNull()
			.references(() => user.id),
		region: int()
			.notNull()
			.references(() => regions.id)
	},
	(t) => [primaryKey({ columns: [t.userid, t.region] })]
);

export const regionsNkRelations = relations(regions, ({ many }) => ({
	nk: many(nk)
}));

export const regionsKontrollenRelations = relations(regions, ({ many }) => ({
	kontrollen: many(kontrollen)
}));

export const nkRegionsRelations = relations(nk, ({ one }) => ({
	region: one(regions, {
		fields: [nk.region],
		references: [regions.id]
	})
}));

export const kontrollenRegionsRelations = relations(kontrollen, ({ one }) => ({
	region: one(regions, {
		fields: [kontrollen.region],
		references: [regions.id]
	})
}));

export const userRelations = relations(user, ({ many }) => ({
	userregions: many(userregions)
}));

export const regionsRelations = relations(regions, ({ many }) => ({
	userregions: many(userregions)
}));

export const userRegionsRelations = relations(userregions, ({ one }) => ({
	user: one(user, {
		fields: [userregions.userid],
		references: [user.id]
	}),
	region: one(regions, {
		fields: [userregions.region],
		references: [regions.id]
	})
}));

export type NKDbSelect = typeof nk.$inferSelect;
export type NKDbInsert = typeof nk.$inferInsert;
export type CtrlDbSelect = typeof kontrollen.$inferSelect;
export type CtrlDbInsert = typeof kontrollen.$inferInsert;
export type RegionsDbSelect = typeof regions.$inferSelect;
export type RegionsDbInsert = typeof regions.$inferInsert;
