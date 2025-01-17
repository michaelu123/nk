import type { ControlEntry, MarkerEntryProps } from '$lib/state.svelte';
import { type RequestHandler, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as nktables from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { defaultDate, type ServerChanges } from '$lib/sync';

export const POST: RequestHandler = async ({ request, locals }) => {
	const username = locals.user!.username;
	const mvP = (await request.json()) as MarkerEntryProps;

	const [mvDb] = await db.select().from(nktables.nk).where(eq(nktables.nk.id, +mvP.id));

	// case 1: marker not yet in the db, insert unless deleted
	if (!mvDb) {
		if (mvP.deletedAt) {
			// client can delete this entry
			return json({ delete: mvP.id }, { status: 200 });
		}
		const id = await mvinsert(mvP, username);
		const ctrlIds: Object[] = [];
		for (const ctrl of mvP.ctrls || []) {
			if (ctrl.deletedAt) continue;
			await ctrlinsert(id, ctrl, username, ctrlIds);
		}
		// client must update id's
		return json({ newid: id, oldid: mvP.id, ctrls: ctrlIds }, { status: 200 });
	}

	// case 2: marker in the db, but deletedAt is set
	if (mvDb && mvP.deletedAt) {
		await db.delete(nktables.nk).where(eq(nktables.nk.id, +mvP.id));
		return json({ delete: mvP.id }, { status: 200 });
	}

	// TODO case 3: marker in the db, must merge dependent on changedAt

	return json({ error: 'error' }, { status: 500 });
};

async function mvinsert(mv: MarkerEntryProps, username: string): Promise<number> {
	const data = mv2str(mv);
	const values: nktables.NKDbInsert = {
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
	const data = ctrl2str(ctrl);
	const values: nktables.CtrlDbInsert = {
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

function ctrl2str(ctrl: ControlEntry): string {
	const js = JSON.stringify(ctrl, (k, v) => {
		if (k == 'id') return undefined;
		if (k == 'nkid') return undefined;
		if (k == 'createdAt') return undefined;
		if (k == 'changedAt') return undefined;
		if (k == 'deletedAt') return undefined;
		return v;
	});
	return js;
}

export const GET: RequestHandler = async () => {
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
		if (mchange.deletedAt) continue;
		let changedAt = mchange.changedAt;
		if (changedAt == null) changedAt = mchange.createdAt;
		const chgS = changedAt ? changedAt.toJSON() : defaultDate;
		scMap.set(mchange.id, { id: mchange.id, changedAt: chgS, ctrlChanges: [] });
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
		if (cchange.deletedAt) continue;
		let changedAt = cchange.changedAt;
		if (changedAt == null) changedAt = cchange.createdAt;
		const chgS = changedAt ? changedAt.toJSON() : defaultDate;
		const mchange = scMap.get(cchange.nkid);
		if (mchange) {
			mchange.ctrlChanges.push({ id: cchange.id, changedAt: chgS });
		} else {
			console.log(`unknown marker id ${cchange.nkid} for kontrolle with id ${cchange.id}`);
		}
	}
	if (scMap.size) return json(scMap.values().toArray());
	return json([]);
};
