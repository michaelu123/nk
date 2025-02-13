import { db } from '$lib/server/db';
import * as nktables from '$lib/server/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';

import type { LayoutServerLoad } from './$types';
export const ssr = false;
export const load: LayoutServerLoad = async (event) => {
	const pathname = event.url.pathname;
	if (pathname.startsWith('/log') || pathname == '/register') {
		return { user: null, regionsDB: null };
	}
	const user = event.locals.user;
	const regionIdQuery = db
		.select({ regionid: nktables.userregions.region })
		.from(nktables.userregions)
		.where(eq(nktables.userregions.userid, user!.id));

	const regionsDB = await db
		.select({
			shortname: nktables.regions.shortname,
			regionname: nktables.regions.regionname,
			data: nktables.regions.data
		})
		.from(nktables.regions)
		.where(and(isNull(nktables.regions.deletedAt), inArray(nktables.regions.id, regionIdQuery)));
	return { user: event.locals.user, regionsDB };
};
