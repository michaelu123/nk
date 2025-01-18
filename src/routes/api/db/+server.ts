import { type ControlEntry, type MarkerEntryProps } from '$lib/state.svelte';
import { type RequestHandler, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as nktables from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { type ServerChanges } from '$lib/sync';
import type { CtrlDbInsert, CtrlDbSelect, NKDbInsert } from '$lib/server/db/schema';
import { ctrl2Str, flattenObj, lastChanged, mv2DBStr } from '$lib/utils';

function toNk(mvP: MarkerEntryProps, username: string): NKDbInsert {
	return {
		id: +mvP.id,
		username,
		data: mv2DBStr(mvP, false),
		createdAt: mvP.createdAt ? new Date(mvP.createdAt) : null,
		changedAt: mvP.changedAt ? new Date(mvP.changedAt) : null,
		deletedAt: null
	};
}

function toKontrollen(nkid: number, ctrl: ControlEntry, username: string): CtrlDbInsert {
	return {
		id: +ctrl.id,
		nkid,
		username,
		data: ctrl2Str(ctrl, false),
		createdAt: ctrl.createdAt ? new Date(ctrl.createdAt) : null,
		changedAt: ctrl.changedAt ? new Date(ctrl.changedAt) : null,
		deletedAt: null
	};
}

function findMvCtrl(mvP: MarkerEntryProps, id: string): ControlEntry | null {
	const ctrls = mvP.ctrls || [];
	for (const ctrl of ctrls) {
		if (ctrl.id == id) return ctrl;
	}
	return null;
}

function findDbCtrl(dbctrls: CtrlDbSelect[], id: number): CtrlDbSelect | null {
	for (const ctrl of dbctrls) {
		if (ctrl.id == id) return ctrl;
	}
	return null;
}

async function mvinsert(mv: MarkerEntryProps, username: string): Promise<number> {
	const data = mv2str(mv);
	const values: NKDbInsert = {
		username,
		data,
		createdAt: mv.createdAt ? new Date(mv.createdAt) : null,
		changedAt: mv.changedAt ? new Date(mv.changedAt) : null,
		deletedAt: null
	};
	const newid = await db.insert(nktables.nk).values(values).$returningId();
	const id: number = newid[0].id;
	return id;
}

async function ctrlinsert(nkid: number, ctrl: ControlEntry, username: string, ctrlIds: Object[]) {
	const data = ctrl2Str(ctrl, false);
	const values: CtrlDbInsert = {
		username,
		nkid,
		data,
		createdAt: ctrl.createdAt ? new Date(ctrl.createdAt) : null,
		changedAt: ctrl.changedAt ? new Date(ctrl.changedAt) : null,
		deletedAt: null
	};
	const newid = await db.insert(nktables.kontrollen).values(values).$returningId();
	const id: number = newid[0].id;
	ctrlIds.push({ newid: id, oldid: ctrl.id });
}

function mv2str(mv: MarkerEntryProps): string {
	const js = JSON.stringify(mv, (k, v) => {
		if (k == 'id') return undefined;
		if (k == 'ctrls') return undefined;
		if (k == 'selected') return undefined;
		if (k == 'color') return undefined;
		if (k == 'lastCleaned') return undefined;
		if (k == 'createdAt') return undefined;
		if (k == 'changedAt') return undefined;
		if (k == 'deletedAt') return undefined;
		return v;
	});
	return js;
}

// the post handler gets a mv with ctrls and stores them into the DB if newer
export const POST: RequestHandler = async ({ request, locals }) => {
	const username = locals.user!.username;
	const mvP = (await request.json()) as MarkerEntryProps;

	const [mvDb] = await db.select().from(nktables.nk).where(eq(nktables.nk.id, +mvP.id));

	// case 1: mv not yet in the db, insert unless deleted
	if (!mvDb) {
		if (mvP.deletedAt) {
			// client can delete this entry
			return json({ delete: { oldid: mvP.id } }, { status: 200 });
		}
		const id = await mvinsert(mvP, username);
		const ctrlIds: Object[] = [];
		for (const ctrl of mvP.ctrls || []) {
			await ctrlinsert(id, ctrl, username, ctrlIds);
		}
		// client must update id's
		return json({ updateids: { newid: id, oldid: mvP.id, ctrls: ctrlIds } }, { status: 200 });
	}

	// case 2: marker in the db, but deletedAt is set
	// in the db mark as deleted
	if (mvDb && mvP.deletedAt) {
		const deletedAt = new Date(mvP.deletedAt);
		await db
			.update(nktables.kontrollen)
			.set({ deletedAt })
			.where(eq(nktables.kontrollen.nkid, +mvP.id));
		await db.update(nktables.nk).set({ deletedAt }).where(eq(nktables.nk.id, +mvP.id));
		return json({ delete: { oldid: mvP.id } }, { status: 200 });
	}

	// case 3: marker in the db, must merge dependent on changedAt
	const dbChanged = lastChanged(mvDb);
	const mvPChanged = lastChanged(mvP);
	if (dbChanged < mvPChanged) {
		await db.update(nktables.nk).set(toNk(mvP, username)).where(eq(nktables.nk.id, +mvP.id));
	}

	let dbCtrls = (await db
		.select()
		.from(nktables.kontrollen)
		.where(eq(nktables.kontrollen.nkid, +mvP.id))) as CtrlDbSelect[];

	for (const dbCtrl of dbCtrls) {
		const mvCtrl = findMvCtrl(mvP, dbCtrl.id.toString());
		if (!mvCtrl) continue;
		const dbChanged = lastChanged(dbCtrl);
		const mvChanged = lastChanged(mvCtrl);
		if (dbChanged < mvChanged) {
			await db
				.update(nktables.kontrollen)
				.set(toKontrollen(dbCtrl.id, mvCtrl, username))
				.where(eq(nktables.kontrollen.id, dbCtrl.id));
		}
	}
	const ctrlIds: Object[] = [];
	for (const mvCtrl of mvP.ctrls || []) {
		const dbCtrl = findDbCtrl(dbCtrls, +mvCtrl.id);
		if (!dbCtrl) {
			await ctrlinsert(mvDb.id, mvCtrl, username, ctrlIds);
		}
	}
	return json({ updatectrlids: { ctrls: ctrlIds } }, { status: 200 });
};

async function getChgs(): Promise<Response> {
	let scMap = new Map<number, ServerChanges>();
	let mchanges = await db
		.select({
			id: nktables.nk.id,
			createdAt: nktables.nk.createdAt,
			changedAt: nktables.nk.changedAt,
			deletedAt: nktables.nk.deletedAt
		})
		.from(nktables.nk);
	for (const mchange of mchanges) {
		let lc = lastChanged(mchange);
		scMap.set(mchange.id, { id: mchange.id, lastChanged: lc, ctrlChanges: [] });
	}
	let cchanges = await db
		.select({
			id: nktables.kontrollen.id,
			nkid: nktables.kontrollen.nkid,
			createdAt: nktables.kontrollen.createdAt,
			changedAt: nktables.kontrollen.changedAt,
			deletedAt: nktables.kontrollen.deletedAt
		})
		.from(nktables.kontrollen);
	for (const cchange of cchanges) {
		let lc = lastChanged(cchange);
		const mchange = scMap.get(cchange.nkid);
		if (mchange) {
			mchange.ctrlChanges.push({ id: cchange.id, lastChanged: lc });
		} else {
			console.log(`unknown marker id ${cchange.nkid} for kontrolle with id ${cchange.id}`);
		}
	}
	if (scMap.size) return json(scMap.values().toArray());
	return json([]);
}

async function getMvs(): Promise<Response> {
	let mvalsDB = await db.select().from(nktables.nk).where(isNull(nktables.nk.deletedAt));
	let mvalsP: MarkerEntryProps[] = [];
	for (const mvdb of mvalsDB) {
		const data = JSON.parse(mvdb.data as string);
		mvdb.data = data;
		const mvP = flattenObj(mvdb, {});
		mvalsP.push(mvP);
	}
	return json(mvalsP);
}

async function getCtrls(): Promise<Response> {
	let ctrlsDB = await db.select().from(nktables.kontrollen).where(isNull(nktables.nk.deletedAt));
	let ctrls: ControlEntry[] = [];
	for (const ctrlDB of ctrlsDB) {
		const data = JSON.parse(ctrlDB.data as string);
		ctrlDB.data = data;
		const ctrl = flattenObj(ctrlDB, {});
		ctrls.push(ctrl);
	}
	return json(ctrls);
}

// the get handler gets all change dates, or all mvs, or all ctrls
export const GET: RequestHandler = async ({ url }) => {
	const what = url.searchParams.get('what');
	if (what == 'chg') return await getChgs();
	if (what == 'nk') return await getMvs();
	if (what == 'kn') return await getCtrls();
	return json([]);
};
