import type { PageLoad, PageLoadEvent } from './$types';
export const load: PageLoad = async ({ url, params, data, route }) => {
	console.log('load url:', url, 'params:', params, 'data:', data, 'route:', route);
	return { blogid: params.blogid };
};
