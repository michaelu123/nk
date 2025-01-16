import { mv2DBStr, type ControlEntry, type MarkerEntryProps, type State } from './state.svelte';

interface IdAndChanged {
	id: string;
	changedAt: string;
}

// who has newer data, server or client?
// both occurs, if some new controls on both.
type ServerOrClient = 'client' | 'server' | 'none' | 'both';

export interface ServerChanges {
	id: number;
	changedAt: string;
	ctrlChanges: {
		id: number;
		changedAt: string;
	}[];
}
export const defaultDate = '2000-01-01T12:00:00Z';

export class Sync {
	private nkState: State;
	private fetch: Function;
	private setProgress: Function;

	constructor(nkState: State, fetch: Function, setProgress: Function) {
		this.nkState = nkState;
		this.fetch = fetch;
		this.setProgress = setProgress;
	}

	async sync() {
		const scMap = new Map<string, ServerChanges>(); // changedAt date of db entries
		const csMap = new Map<string, ServerOrClient>(); // server: newer or new on server
		const resp1 = await this.fetch('/api/changes', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const serverChanges = (await resp1.json()) as ServerChanges[];
		for (let sc of serverChanges) {
			const idS = sc.id.toString();
			scMap.set(idS, sc);
			csMap.set(idS, 'server');
		}
		let mvalsP = await this.nkState.fetchMarkersProps(); // including deleted items
		await this.nkState.fetchCtrlsProps(mvalsP);

		const testm = mvalsP.find((x) => x.id == '1737056352000')!;
		// testm.id = '120';
		// testm.ctrls![0].id = '206';
		// testm.ctrls![1].id = '207';
		mvalsP = [testm];

		for (let mvP of mvalsP) {
			const cmp = compareChanges(mvP, scMap.get(mvP.id));
			csMap.set(mvP.id, cmp); // may overwrite entries set to server above
			if (cmp == 'none') continue;
		}
		csMap.forEach((v, k) => {
			if (v == 'none') csMap.delete(k);
		});
		let len = csMap.size;
		let index = 0;
		for (const [mvid, sorc] of csMap.entries()) {
			if (sorc == 'server') continue; // TODO
			if (sorc == 'client') {
				let mvP = mvalsP.find((m) => m.id == mvid);
				let js = mv2DBStr(mvP!);
				const response = await fetch!('/api/todb', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: js
				});
				const idChanges = await response.json();
				console.log('idChanges', idChanges);
				/* newid:121, oldid:xxx, ctrls: [{newid ..., oldid ...}] TODO */
			}

			index++;
			const progress = (index / len) * 100;
			this.setProgress(progress);
			break; // TODO
		}
		this.setProgress(0);
	}
}

function compareChanges(
	mvP: MarkerEntryProps,
	sc: ServerChanges | undefined
): 'client' | 'server' | 'none' | 'both' {
	if (!sc) return 'client';

	let mchangedAt = mvP.changedAt;
	if (!mchangedAt) mchangedAt = mvP.createdAt;
	if (!mchangedAt) mchangedAt = defaultDate;
	const mchangedAtS = mchangedAt ? (mchangedAt as string) : defaultDate;
	const mics = convertControlEntriesToICArray(mvP.ctrls || []);
	const sics = convertServerChangesControlEntries(sc.ctrlChanges);
	if (mchangedAtS < sc.changedAt) return compareCtrlChanges(mics, sics, 'server');
	if (mchangedAtS > sc.changedAt) return compareCtrlChanges(mics, sics, 'client');
	return compareCtrlChanges(mics, sics, 'none');
}

function convertControlEntriesToICArray(ctrls: ControlEntry[]): IdAndChanged[] {
	let res: IdAndChanged[] = [];
	for (const ctrl of ctrls || []) {
		let changedAt = ctrl.changedAt;
		if (!changedAt) changedAt = ctrl.createdAt;
		const changedAtS = changedAt ? (changedAt as string) : defaultDate;
		res.push({ id: ctrl.id, changedAt: changedAtS });
	}
	return res;
}

function convertServerChangesControlEntries(
	ctrls: {
		id: number;
		changedAt: string;
	}[]
): IdAndChanged[] {
	let res: IdAndChanged[] = [];
	for (const ctrl of ctrls || []) {
		res.push({ id: ctrl.id.toString(), changedAt: ctrl.changedAt });
	}
	return res;
}

function compareCtrlChanges(
	m: IdAndChanged[],
	s: IdAndChanged[],
	msorc: ServerOrClient
): ServerOrClient {
	let server = false;
	let client = false;

	for (const me of m) {
		let foundMinS = false;
		for (const se of s) {
			if (me.id == se.id) {
				foundMinS = true;
				if (me.changedAt < se.changedAt) {
					server = true;
				}
				if (me.changedAt > se.changedAt) {
					client = true;
				}
				break;
			}
		}
		if (!foundMinS) client = true; // client has a control that server does not or is newer
	}
	for (const se of s) {
		let foundSinM = false;
		for (const me of m) {
			if (se.id == me.id) {
				foundSinM = true;
				if (se.changedAt < me.changedAt) {
					client = true;
				}
				if (se.changedAt > me.changedAt) {
					server = true;
				}
				break;
			}
		}
		if (!foundSinM) server = true; // server has a control that client does not or is newer
	}
	if (server && client) return 'both';
	if (server && msorc == 'client') return 'both';
	if (client && msorc == 'server') return 'both';
	if (server) return 'server';
	if (client) return 'client';
	return msorc;
}
