<script lang="ts">
	import CSV from '$lib/csv';
	import { UploadOutline } from 'flowbite-svelte-icons';
	import Dropzone from 'svelte-file-dropzone';
	import { getState, type ControlEntry, MarkerEntry } from '$lib/state.svelte';
	import { goto } from '$app/navigation';
	import { Button } from 'svelte-5-ui-lib';

	let nkState = getState();
	let isLoading = $state(false);
	let errorMessage = $state('');
	let cnt = $state(0);

	const nabuMap: Map<string, string> = new Map([
		['NiKa (Nistkasten)', 'Nistkasten'],
		['HöKa FMaus HoBe (Höhlenkasten, Fledermaus, Holzbeton)', 'FL-Sommerkasten'],
		['FlaKa FMaus HoBe B (Flachkasten, Fledermaus, Holzbeton, Baum)', 'Flachkasten'],
		['WiQu FMaus HoBe (Winterquartier, Fledermaus, Holzbeton)', 'FL-Winterkasten'],
		['FlaKa FMaus Ho B (Flachkasten, Fledermaus, Holz, Baum)', 'Flachkasten'],
		['Meise (alle)', 'Meise'],
		['Kleiber, nordeuropäische Unterart', 'Kleiber'],
		['Maus (alle)', 'Maus'],
		['Europäische Hornisse', 'Hornissen']
	]);

	function nbmap(k: string) {
		if (k == 'Nisthilfe allgemein') return '';
		return nabuMap.get(k) || k;
	}

	export async function convertFileToText(file: File): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onloadend = () => {
				const res = reader.result as string;
				if (res) {
					resolve(res);
				} else {
					reject('Failed to convert file to string');
				}
			};

			reader.onerror = () => {
				reject('Error reading file');
			};

			reader.readAsText(file);
		});
	}

	async function handleDrop(e: CustomEvent<any>) {
		const { acceptedFiles } = e.detail;
		if (acceptedFiles.length) {
			try {
				isLoading = true;
				const file = acceptedFiles[0] as File;
				const str = await convertFileToText(file);
				if (!str) {
					errorMessage = 'no str??';
					console.log('no str??');
					return;
				}
				const dialect = { delimiter: ';' };
				const records = (CSV as any).parse(str, dialect);
				if (records[0].length < 12) {
					await importKontrollen(records);
				} else {
					await importMarker(records);
				}
			} catch (error) {
				errorMessage = 'Konnte die hochgeladene Datei nicht verarbeiten:' + error;
			} finally {
				isLoading = false;
			}
		} else {
			errorMessage =
				'Konnte Datei nicht laden. Es muß eine .csv-Datei mit einer Länge kleiner 1MB sein';
		}
	}

	function datum2Date(datum: string): Date {
		// 27.12.2024 -> 2024-12-27T12:00:00.000Z
		const d =
			datum.slice(6, 10) + '-' + datum.slice(3, 5) + '-' + datum.slice(0, 2) + 'T12:00:00.000Z';
		return new Date(d);
	}

	async function importMarker(records: string[][]) {
		// ID der Nisthilfe;Gruppenname;Name der Nisthilfe;Typ der Nisthilfe;Hersteller;Besonderheit;Befestigung;Höhe;Ausrichtung;Kameralink;Grundsätzlich reinigen;Bemerkung/Hinweise;Aufgehängt;Abgehängt;GPS Latitude;GPS Longitude;Erfasser;Gebiet;
		const headers = records[0];
		const idIndex = headers.findIndex((h) => h === 'ID der Nisthilfe');
		const nameIndex = headers.findIndex((h) => h === 'Name der Nisthilfe');
		const typIndex = headers.findIndex((h) => h === 'Typ der Nisthilfe');
		const commentIndex = headers.findIndex((h) => h === 'Bemerkung/Hinweise');
		const latIndex = headers.findIndex((h) => h === 'GPS Latitude');
		const lngIndex = headers.findIndex((h) => h === 'GPS Longitude');
		const gebietIndex = headers.findIndex((h) => h === 'Gebiet');
		const aufgehängtIndex = headers.findIndex((h) => h === 'Aufgehängt'); // 21.11.2023
		const abgehängtIndex = headers.findIndex((h) => h === 'Abgehängt');
		const today = new Date();
		today.setMilliseconds(0);

		for (const r of records.slice(1)) {
			const id = (r[idIndex] + 1000000000).toString(); // keep id for now, but make sure it can not be an id in the DB
			const name = r[nameIndex].toString();
			const typ = nbmap(r[typIndex]);
			const comment = r[commentIndex];
			const lat = parseFloat(r[latIndex].replace(',', '.')); // TODO: check if within bounds
			const lng = parseFloat(r[lngIndex].replace(',', '.'));
			const aufgehängt = r[aufgehängtIndex];
			const abgehängt = r[abgehängtIndex];
			if (abgehängt) continue;
			const aufgehängtDate = datum2Date(aufgehängt);
			const mv = new MarkerEntry({
				latLng: [lat, lng],
				ctrls: [],
				selected: false,
				color: 'red',
				lastCleaned: null,
				id,
				name,
				nkType: typ,
				comment,
				image: null,
				createdAt: aufgehängtDate,
				changedAt: null,
				deletedAt: null
			});
			await nkState.importMV(mv);
			cnt++;
		}
	}

	async function importKontrollen(records: string[][]) {
		const headers = records[0];
		// ID der Nisthilfe;Name der Nisthilfe;Datum;Art;Neststadium;Anzahl;Hinweise / Spuren / Erfassungstyp;Brutzeitcode;Bemerkung;Erfasser;

		const idIndex = headers.findIndex((h) => h === 'ID der Nisthilfe');
		const nameIndex = headers.findIndex((h) => h === 'Name der Nisthilfe');
		const datumIndex = headers.findIndex((h) => h === 'Datum');
		const artIndex = headers.findIndex((h) => h === 'Art');
		const bemerkungIndex = headers.findIndex((h) => h === 'Bemerkung');

		const nestIndex = headers.findIndex((h) => h === 'Neststadium');
		// const erfasserIndex = headers.findIndex((h) => h === 'Erfasser');
		const brutZeitCodeIndex = headers.findIndex((h) => h === 'Brutzeitcode');
		// const anzahlIndex = headers.findIndex((h) => h === 'Anzahl');
		// const hinweiseIndex = headers.findIndex((h) => h === 'Hinweise / Spuren / Erfassungstyp');

		const today = new Date();
		today.setMilliseconds(0);
		const ctrlMap: Map<string, ControlEntry> = new Map();

		let nowId = Date.now();
		for (const r of records.slice(1)) {
			const id = '';
			const nkid = (r[idIndex] + 1000000000).toString();
			const name = r[nameIndex].toString();
			const datum = r[datumIndex]; // 27.12.2024
			const date = datum2Date(datum);
			const species = nbmap(r[artIndex]);
			const comment = r[bemerkungIndex];
			const cleaned = r[brutZeitCodeIndex] == 'gereinigt';
			const nestStadium = r[nestIndex];

			// make one entry from these lines
			// 7913;9;16.12.2023;Nisthilfe allgemein;;;;gereinigt;;Michael Uhlenberg;
			// 7913;9;16.12.2023;Blaumeise;;;;;;Michael Uhlenberg;
			const key = nkid + datum;
			let ctrl = ctrlMap.get(key);
			if (!ctrl) {
				ctrl = {
					id,
					nkid,
					name,
					date,
					species,
					comment,
					image: null,
					cleaned,
					createdAt: today,
					changedAt: null,
					deletedAt: null
				};
				ctrlMap.set(key, ctrl);
			}
			if (species) {
				ctrl.species = species;
				ctrl.comment = comment;
			}
			if (nestStadium && !ctrl.species && !species) {
				ctrl.species = nestStadium;
			}
			if (cleaned) {
				ctrl.cleaned = true;
			}
		}
		for (const ctrl of ctrlMap.values()) {
			ctrl.id = (nowId++).toString();
			await nkState.importCtrl(ctrl);
			cnt++;
		}
		await nkState.fetchData();
	}
</script>

<div class="m-4 h-max w-max">
	{#if cnt}
		<h1>Es wurden {cnt} Einträge importiert</h1>
	{:else}
		<h2 class="my-4 text-center text-xl">Wähle eine .csv-Datei, exportiert von der Nabu-App</h2>
		<div class="upload-area">
			<div class="upload-container">
				{#if errorMessage}
					<h4 class="m-4 text-center text-red-500">
						{errorMessage}
					</h4>
				{/if}
				{#if isLoading}
					<div class="spinner-container">
						<div class="spinner"></div>
						<p>CSV-Import wird verarbeitet</p>
					</div>
				{:else}
					<Dropzone on:drop={handleDrop} multiple={false} accept="text/csv" maxSize={1000 * 1024}>
						<UploadOutline class="h-10 w-10" />
						<p>Eine Datei hierher ziehen oder auswählen</p>
					</Dropzone>
				{/if}
			</div>
		</div>
	{/if}
	<div class="text-left">
		<Button class="mr-4 mt-4" onclick={() => goto('/')}>Karte</Button>
		{#if cnt}
			<Button class="mr-4 mt-4" onclick={() => (cnt = 0)}>Weiterer Import</Button>
		{/if}
	</div>
</div>

<style>
	.spinner-container {
		display: flex;
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-left-color: black;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: inline-block;
		margin-right: 8px;
		animation: spin 0.5s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
