import type { ControlEntry, NkEntry, Region } from './state.svelte';

export function date2Str(val: any) {
	if ('getYear' in val) val = val.toJSON();
	return val;
}

export function flattenObj(obj: any, res: any) {
	for (let key in obj) {
		if (key == 'username') continue;
		let val = obj[key];
		if (!val || Array.isArray(val) || typeof val != 'object') {
			res[key] = val;
		} else {
			if ('getYear' in val) {
				val = val.toJSON();
				res[key] = val;
			} else {
				flattenObj(val, res);
			}
		}
	}
	return res;
}

export function nk2DBStr(obj: NkEntry, withCtrls: boolean) {
	const js = JSON.stringify(obj, (k, v) => {
		if (k == 'selected') return undefined;
		if (k == 'color') return undefined;
		if (k == 'lastCleaned') return undefined;
		if (k == 'ctrls' && !withCtrls) return undefined;
		if (k == 'id' && !withCtrls) return undefined;
		return v;
	});
	return js;
}

export function ctrl2Str(ctrl: ControlEntry, forLocal: boolean): string {
	const js = JSON.stringify(ctrl, (k, v) => {
		if (k == 'id') return undefined;
		if (k == 'nkid' && !forLocal) return undefined;
		if (k == 'createdAt' && !forLocal) return undefined;
		if (k == 'changedAt' && !forLocal) return undefined;
		if (k == 'deletedAt' && !forLocal) return undefined;
		return v;
	});
	return js;
}

export function region2Str(r: Region): string {
	const js = JSON.stringify(r, (k, v) => {
		if (k == 'id') return undefined;
		if (k == 'shortName') return undefined;
		if (k == 'name') return undefined;
		return v;
	});
	return js;
}

export const defaultDate = '2000-01-01T12:00:00Z';

export function lastChanged(o: any): string {
	let lc = o.deletedAt || o.changedAt || o.createdAt;
	if (!lc) lc = defaultDate;
	if (typeof lc != 'string') lc = lc.toJSON();
	return lc;
}

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
