import type { ControlEntry, MarkerEntryProps } from '$lib/state.svelte';
import { type RequestHandler, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// let userId:string; // is this global or per session or request or what?

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('locals', locals, locals.user!.username, locals.user!.id);
	const userId = locals.user!.id;
	request.headers.forEach((v, k, p) => {
		console.log('header', k, v);
	});
	const mv = (await request.json()) as MarkerEntryProps;
	console.log('mv', mv);

	const [mvdb] = await db.select().from(table.nk).where(eq(table.nk.id, +mv.id));
	console.log('mvdb', mvdb);

	// case 1: marker not yet in the db, insert unless deleted
	if (!mvdb) {
		if (mv.deletedAt) {
			// client can delete this entry
			return json({ delete: mv.id }, { status: 200 });
		}
		const id = await mvinsert(mv, userId);
		const ctrlIds: Object[] = [];
		for (const ctrl of mv.ctrls || []) {
			if (ctrl.deletedAt) continue;
			await ctrlinsert(id, ctrl, userId, ctrlIds);
		}
		// client must update id's
		return json({ newid: id, oldid: mv.id, ctrls: ctrlIds }, { status: 200 });
	}

	// case 2: marker in the db, but deletedAt is set
	if (mvdb && mv.deletedAt) {
		await db.delete(table.nk).where(eq(table.nk.id, +mv.id));
		return json({ delete: mv.id }, { status: 200 });
	}

	// case 3: marker in the db, must merge dependent on changedAt

	return json({ error: 'error' }, { status: 500 });
};

async function mvinsert(mv: MarkerEntryProps, userId: string): Promise<number> {
	const data = mv2str(mv);
	console.log('data', data);
	console.log('mv', mv);
	const values: table.NKDbInsert = {
		userId,
		data,
		createdAt: mv.createdAt ? new Date(mv.createdAt) : null,
		changedAt: mv.changedAt ? new Date(mv.changedAt) : null,
		deletedAt: null
	};
	const newid = await db.insert(table.nk).values(values).$returningId();
	const id: number = newid[0].id;
	return id;
}

async function ctrlinsert(nkId: number, ctrl: ControlEntry, userId: string, ctrlIds: Object[]) {
	const data = ctrl2str(ctrl);
	console.log('data', data);
	console.log('ctrl', ctrl);
	const values: table.CtrlDbInsert = {
		userId,
		nkId,
		data,
		createdAt: ctrl.createdAt ? new Date(ctrl.createdAt) : null,
		changedAt: ctrl.changedAt ? new Date(ctrl.changedAt) : null,
		deletedAt: null
	};
	const newid = await db.insert(table.kontrollen).values(values).$returningId();
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
