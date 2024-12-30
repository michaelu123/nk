import type { LayoutServerLoad } from './$types';
export const ssr = false;
export const load: LayoutServerLoad = async (event) => {
	return { user: event.locals.user };
};
