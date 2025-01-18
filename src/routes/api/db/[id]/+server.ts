import { type RequestHandler, error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { flattenObj } from '$lib/utils';

export const GET: RequestHandler = async ({ params }) => {
	const nkid = +params.id!;
	if (isNaN(nkid)) return error(404, 'must supply integer key');
	let res = await db.select().from(table.nk).where(eq(table.nk.id, nkid));
	if (!res || res.length != 1) {
		return error(404, 'no nk entry for id ' + nkid);
	}
	const mvdb = res[0]!;
	const data = JSON.parse(mvdb.data as string);
	mvdb.data = data;

	const ctrls = await db.select().from(table.kontrollen).where(eq(table.kontrollen.nkid, nkid));
	for (const ctrl of ctrls) {
		if (ctrl.data) {
			ctrl.data = JSON.parse(ctrl.data);
		}
	}
	for (const i in ctrls) {
		ctrls[i] = flattenObj(ctrls[i], {});
	}

	(mvdb as any).ctrls = ctrls;

	const mvP = flattenObj(mvdb, {});
	return json(mvP);
};
