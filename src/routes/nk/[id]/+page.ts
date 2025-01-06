import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
	const { id } = params;
	console.log('ID', id);
	return { id, url };
};
