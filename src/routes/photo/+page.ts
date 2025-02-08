import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	let nkid = url.searchParams.get('nkid');
	let ctrlid = url.searchParams.get('ctrlid');
	let nkName = url.searchParams.get('nkname');

	if (!nkid || !nkName) {
		return redirect(302, '/');
	}

	return { url };
};
