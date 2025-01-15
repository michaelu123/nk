import { mysqlTable, int, varchar, datetime, json, serial } from 'drizzle-orm/mysql-core';

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
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	data: json(),
	createdAt: datetime('created_at'),
	changedAt: datetime('changed_at'),
	deletedAt: datetime('deleted_at')
});

export const kontrollen = mysqlTable('kontrollen', {
	id: int().primaryKey().autoincrement(),
	userId: varchar('user_id', { length: 255 })
		.notNull()
		.references(() => user.id),
	nkId: int('nk_id')
		.notNull()
		.references(() => nk.id, { onDelete: 'cascade' }),
	data: json(),
	createdAt: datetime('created_at'),
	changedAt: datetime('changed_at'),
	deletedAt: datetime('deleted_at')
});

export type NKDbSelect = typeof nk.$inferSelect;
export type CtrlDbSelect = typeof kontrollen.$inferSelect;
export type NKDbInsert = typeof nk.$inferInsert;
export type CtrlDbInsert = typeof kontrollen.$inferInsert;
