import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let mvid = url.searchParams.get('mvid');
	let ctrlid = url.searchParams.get('ctrlid');
	let nkName = url.searchParams.get('nkname');

	if (!mvid || !nkName) {
		return redirect(302, '/');
	}

	return { url };
};
