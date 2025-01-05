<script lang="ts">
	import { Label, Input, Select } from 'svelte-5-ui-lib';

	interface Props {
		itemMap: Map<string, number>;
		value: string;
		label: string;
	}
	let { itemMap, value = $bindable(), label }: Props = $props();

	let valueList: string[] = $derived.by(() => {
		let allKeys = itemMap.keys().toArray();
		allKeys = allKeys.toSorted((b, a) => itemMap.get(a)! - itemMap.get(b)!);
		let uc = value.toUpperCase();
		let filteredKeys = allKeys.filter((k) => k.toUpperCase().includes(uc));
		if (filteredKeys.length < 8) {
			for (const k of allKeys) {
				if (!filteredKeys.includes(k)) {
					filteredKeys.push(k);
					if (filteredKeys.length >= 8) break;
				}
			}
		}
		let keys = filteredKeys.toSorted((b, a) => itemMap.get(a)! - itemMap.get(b)!);
		keys = keys.slice(0, 8);
		return keys;
	});
</script>

<div class="w-full">
	<div class="mb-4 flex flex-row">
		<Label class="w-40 shrink-0" for="value_id">{label}:</Label>
		<!-- <Input list="valuelist" id="value_id" name="value" type="text" bind:value />
		<datalist id="valuelist">
			{#each valueList as nkt}
				<option value={nkt}></option>
			{/each}
		</datalist> -->
		<Input type="text" name="typ" bind:value />
	</div>
	<!-- datalist does currently not work on Android Chrome! -->
	<div class="flex flex-row">
		<Label class="w-40 shrink-0" for="value_select">{label}auswahl:</Label>
		<Select class="" name="valueA" id="value-select" bind:value>
			{#each valueList as nkt}
				<option value={nkt}>{nkt}</option>
			{/each}
		</Select>
	</div>
</div>
