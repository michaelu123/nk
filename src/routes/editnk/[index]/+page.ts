import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const { index } = params;
	console.log('INDEX', index);
	return { index };
};
