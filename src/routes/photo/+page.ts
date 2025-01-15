import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let mvid = url.searchParams.get('mvid');
	let ctrlid = url.searchParams.get('ctrlid');
	if (!mvid && !ctrlid) {
		return redirect(302, '/');
	}

	return { url };
};
