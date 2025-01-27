import { type ControlEntry, type MarkerEntryProps, type Region } from '$lib/state.svelte';
import { type RequestHandler, error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as nktables from '$lib/server/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { type ServerChanges } from '$lib/sync';
import type {
	CtrlDbInsert,
	CtrlDbSelect,
	NKDbInsert,
	RegionsDbInsert,
	User
} from '$lib/server/db/schema';
import { ctrl2Str, flattenObj, lastChanged, mv2DBStr, region2Str } from '$lib/utils';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { IMAGE_ROOTDIR } from '$env/static/private';
// import { read } from '$app/server'; does not work

function toNk(mvP: MarkerEntryProps, username: string, region: string): NKDbInsert {
	return {
		id: +mvP.id,
		username,
		region,
		data: mv2DBStr(mvP, false),
		createdAt: mvP.createdAt ? new Date(mvP.createdAt) : null,
		changedAt: mvP.changedAt ? new Date(mvP.changedAt) : null,
		deletedAt: null
	};
}

function toKontrollen(
	nkid: number,
	ctrl: ControlEntry,
	username: string,
	region: string
): CtrlDbInsert {
	return {
		id: +ctrl.id,
		nkid,
		username,
		region,
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

async function mvinsert(mv: MarkerEntryProps, username: string, region: string): Promise<number> {
	const data = mv2str(mv);
	const values: NKDbInsert = {
		username,
		region,
		data,
		createdAt: mv.createdAt ? new Date(mv.createdAt) : null,
		changedAt: mv.changedAt ? new Date(mv.changedAt) : null,
		deletedAt: null
	};
	const newid = await db.insert(nktables.nk).values(values).$returningId();
	const id: number = newid[0].id;
	return id;
}

async function ctrlinsert(
	nkid: number,
	ctrl: ControlEntry,
	username: string,
	region: string,
	ctrlIds: Object[]
) {
	const data = ctrl2Str(ctrl, false);
	const values: CtrlDbInsert = {
		username,
		nkid,
		region,
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
async function postMv(
	request: Request,
	username: string,
	region: string | null
): Promise<Response> {
	if (!region) return error(400, 'need region parameter');

	const mvP = (await request.json()) as MarkerEntryProps;

	const [mvDb] = await db.select().from(nktables.nk).where(eq(nktables.nk.id, +mvP.id));

	// case 1: mv not yet in the db, insert unless deleted
	if (!mvDb) {
		if (mvP.deletedAt) {
			// client can delete this entry
			return json({ delete: { oldid: mvP.id } }, { status: 200 });
		}
		const id = await mvinsert(mvP, username, region);
		const ctrlIds: Object[] = [];
		for (const ctrl of mvP.ctrls || []) {
			await ctrlinsert(id, ctrl, username, region, ctrlIds);
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
		await db
			.update(nktables.nk)
			.set(toNk(mvP, username, region))
			.where(eq(nktables.nk.id, +mvP.id));
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
				.set(toKontrollen(dbCtrl.id, mvCtrl, username, region))
				.where(eq(nktables.kontrollen.id, dbCtrl.id));
		}
	}
	const ctrlIds: Object[] = [];
	for (const mvCtrl of mvP.ctrls || []) {
		const dbCtrl = findDbCtrl(dbCtrls, +mvCtrl.id);
		if (!dbCtrl) {
			await ctrlinsert(mvDb.id, mvCtrl, username, region, ctrlIds);
		}
	}
	return json({ updatectrlids: { ctrls: ctrlIds } }, { status: 200 });
}

async function postImage(request: Request, imgPath: string | null) {
	if (!imgPath) {
		return json({ error: 'no imgPath provided' });
	}
	const buf = await request.arrayBuffer();
	const dirPath = join(IMAGE_ROOTDIR, dirname(imgPath));
	const filePath = join(IMAGE_ROOTDIR, imgPath);
	await mkdir(dirPath, { recursive: true });
	await writeFile(filePath, Buffer.from(buf), { flush: true });
	return json({ ok: buf.byteLength });
}

async function postRegions(request: Request, userObj: any) {
	const regions = (await request.json()) as Region[];
	for (const r of regions) {
		const data = region2Str(r);
		const oldArr = await db
			.select()
			.from(nktables.regions)
			.where(eq(nktables.regions.shortname, r.shortName));
		if (oldArr.length == 0) {
			const values: RegionsDbInsert = {
				shortname: r.shortName,
				regionname: r.name,
				data,
				createdAt: new Date()
			};
			const newId = await db.insert(nktables.regions).values(values).$returningId();
			await db.insert(nktables.userregions).values({
				userid: userObj.id,
				region: newId[0].id
			});
		} else {
			const oldr = oldArr[0];
			if (oldr.regionname != r.name || oldr.data != data) {
				const values: RegionsDbInsert = {
					regionname: r.name,
					data,
					changedAt: new Date()
				};
				await db
					.update(nktables.regions)
					.set(values)
					.where(eq(nktables.regions.shortname, r.shortName));
			}
		}
	}

	// we don't want all regions, only those for this user
	// const regionsDB = await db.select().from(nktables.regions);

	// this results in a nightmare SQL query, which does also not work
	// const regionsDB = await db.query.user
	// 	.findMany({
	// 		where: eq(nktables.user.id, userObj.id),
	// 		with: { userregions: { with: { region: true } } }
	// 	})
	// 	.toSQL();

	const regionIdQuery = db
		.select({ regionid: nktables.userregions.region })
		.from(nktables.userregions)
		.where(eq(nktables.userregions.userid, userObj.id));

	const regionsDB = await db
		.select({
			shortname: nktables.regions.shortname,
			regionname: nktables.regions.regionname,
			data: nktables.regions.data
		})
		.from(nktables.regions)
		.where(and(isNull(nktables.regions.deletedAt), inArray(nktables.regions.id, regionIdQuery)));

	return json(regionsDB);
}

async function getChgs(region: string | null): Promise<Response> {
	let scMap = new Map<number, ServerChanges>();
	let mchanges = await db
		.select({
			id: nktables.nk.id,
			data: nktables.nk.data,
			createdAt: nktables.nk.createdAt,
			changedAt: nktables.nk.changedAt,
			deletedAt: nktables.nk.deletedAt
		})
		.from(nktables.nk)
		.where(and(isNull(nktables.nk.deletedAt), eq(nktables.nk.region, region!)));

	for (const mchange of mchanges) {
		const data = JSON.parse(mchange.data!);
		let lc = lastChanged(mchange);
		scMap.set(mchange.id, { id: mchange.id, lastChanged: lc, image: data.image, ctrlChanges: [] });
	}
	let cchanges = await db
		.select({
			id: nktables.kontrollen.id,
			data: nktables.kontrollen.data,
			nkid: nktables.kontrollen.nkid,
			createdAt: nktables.kontrollen.createdAt,
			changedAt: nktables.kontrollen.changedAt,
			deletedAt: nktables.kontrollen.deletedAt
		})
		.from(nktables.kontrollen)
		.where(and(isNull(nktables.kontrollen.deletedAt), eq(nktables.kontrollen.region, region!)));

	for (const cchange of cchanges) {
		const data = JSON.parse(cchange.data!);
		let lc = lastChanged(cchange);
		const mchange = scMap.get(cchange.nkid);
		if (mchange) {
			mchange.ctrlChanges.push({ id: cchange.id, lastChanged: lc, image: data.image });
		} else {
			console.log(`unknown marker id ${cchange.nkid} for kontrolle with id ${cchange.id}`);
		}
	}
	if (scMap.size) return json(scMap.values().toArray());
	return json([]);
}

async function getMvs(region: string | null): Promise<Response> {
	if (!region) return error(400, 'need region parameter');
	let mvalsDB = await db
		.select()
		.from(nktables.nk)
		.where(and(isNull(nktables.nk.deletedAt), eq(nktables.nk.region, region)));
	let mvalsP: MarkerEntryProps[] = [];
	for (const mvdb of mvalsDB) {
		const data = JSON.parse(mvdb.data as string);
		mvdb.data = data;
		const mvP = flattenObj(mvdb, {});
		mvalsP.push(mvP);
	}
	return json(mvalsP);
}

async function getCtrls(region: string | null): Promise<Response> {
	if (!region) return error(400, 'need region parameter');
	let ctrlsDB = await db
		.select()
		.from(nktables.kontrollen)
		.where(and(isNull(nktables.kontrollen.deletedAt), eq(nktables.kontrollen.region, region)));
	let ctrls: ControlEntry[] = [];
	for (const ctrlDB of ctrlsDB) {
		const data = JSON.parse(ctrlDB.data as string);
		ctrlDB.data = data;
		const ctrl = flattenObj(ctrlDB, {});
		ctrls.push(ctrl);
	}
	return json(ctrls);
}

async function getImage(imgPath: string | null): Promise<Response> {
	if (!imgPath) {
		return json({ error: 'no imgPath provided' });
	}
	const filePath = join(IMAGE_ROOTDIR, imgPath);
	// does not work: return read(filePath); // https://sveltekit.io/blog/sveltekit-fs-read
	const buf = await readFile(filePath);
	const resp = new Response(buf, {
		headers: {
			'Content-Type': 'application/octet-stream'
		}
	});
	return resp;
}

async function nkDelete(id: number) {
	await db.delete(nktables.kontrollen).where(eq(nktables.kontrollen.nkid, id));
	await db.delete(nktables.nk).where(eq(nktables.nk.id, id));
}

async function removeDuplicates(): Promise<Response> {
	let mvalArr: any = [];
	let count = 0;
	let mvals = await db
		.select({
			id: nktables.nk.id,
			data: nktables.nk.data,
			createdAt: nktables.nk.createdAt,
			changedAt: nktables.nk.changedAt,
			deletedAt: nktables.nk.deletedAt
		})
		.from(nktables.nk);
	for (const mval of mvals) {
		const data: any = JSON.parse(mval.data!);
		let lc = lastChanged(mval);
		mvalArr.push({ id: mval.id, lastChanged: lc, lat: data.latLng[0], lng: data.latLng[1] });
	}
	mvalArr = mvalArr.toSorted((a: any, b: any) => {
		if (a.lat == b.lat) return a.lng - b.lng;
		return a.lat - b.lat;
	});
	const len = mvalArr.length - 1;
	for (let i = 0; i < len; i++) {
		for (let j = i + 1; j < len; j++) {
			if (mvalArr[i].lat == mvalArr[j].lat && mvalArr[i].lng == mvalArr[j].lng) {
				await nkDelete(
					mvalArr[i].lastChanged < mvalArr[j].lastChanged ? mvalArr[i].id : mvalArr[j].id
				);
				count++;
			} else {
				i = j;
				break;
			}
		}
	}
	console.log('deleted duplicates', count);
	return json({ count });
}

// the get handler gets all change dates, or all mvs, or all ctrls, or one image
export const GET: RequestHandler = async ({ url }) => {
	const what = url.searchParams.get('what');
	const region = url.searchParams.get('region');
	if (what == 'chg') return await getChgs(region);
	if (what == 'nk') return await getMvs(region);
	if (what == 'ctrls') return await getCtrls(region);
	if (what == 'img') return await getImage(url.searchParams.get('imgPath'));
	if (what == 'dpl') return await removeDuplicates();
	return json([]);
};

export const POST: RequestHandler = async ({ url, request, locals }) => {
	const what = url.searchParams.get('what');
	if (what == 'nk')
		return await postMv(request, locals.user!.username, url.searchParams.get('region'));
	if (what == 'img') return await postImage(request, url.searchParams.get('imgPath'));
	if (what == 'regions') return await postRegions(request, locals.user!);
	return json([]);
};
