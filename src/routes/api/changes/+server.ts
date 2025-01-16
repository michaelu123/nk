import { json, type RequestHandler } from '@sveltejs/kit';
import { defaultDate, type ServerChanges } from '$lib/sync';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ request }) => {
	let scMap = new Map<number, ServerChanges>();
	let mchanges = await db
		.select({ id: table.nk.id, createdAt: table.nk.createdAt, changedAt: table.nk.changedAt })
		.from(table.nk);
	for (const mchange of mchanges) {
		let changedAt = mchange.changedAt;
		if (changedAt == null) changedAt = mchange.createdAt;
		const chgS = changedAt ? changedAt.toJSON() : defaultDate;
		scMap.set(mchange.id, { id: mchange.id, changedAt: chgS, ctrlChanges: [] });
	}
	let cchanges = await db
		.select({
			id: table.kontrollen.id,
			nkId: table.kontrollen.nkId,
			createdAt: table.kontrollen.createdAt,
			changedAt: table.kontrollen.changedAt
		})
		.from(table.kontrollen);
	for (const cchange of cchanges) {
		let changedAt = cchange.changedAt;
		if (changedAt == null) changedAt = cchange.createdAt;
		const chgS = changedAt ? changedAt.toJSON() : defaultDate;
		const mchange = scMap.get(cchange.nkId);
		if (mchange) {
			mchange.ctrlChanges.push({ id: cchange.id, changedAt: chgS });
		} else {
			console.log(`unknown marker id ${cchange.nkId} for kontrolle with id ${cchange.id}`);
		}
	}
	console.log('csMap', scMap);
	return json(scMap.values().toArray());
};
