<script lang="ts">
	import { Label, Input, Select } from 'svelte-5-ui-lib';

	interface Props {
		itemMap: Map<string, number>;
		value: string;
	}
	let { itemMap, value = $bindable() }: Props = $props();

	let valueList: string[] = $derived.by(() => {
		let keys = itemMap.keys().toArray();
		let uc = value.toUpperCase();
		keys = keys.filter((k) => k.toUpperCase().includes(uc));
		keys = keys.toSorted((b, a) => itemMap.get(a)! - itemMap.get(b)!);
		keys = keys.slice(0, 8);
		return keys;
	});
</script>

<div class="w-full">
	<div class="mb-4 flex flex-row">
		<Label class="w-40 shrink-0" for="value_id">Typ:</Label>
		<Input list="valuelist" id="value_id" name="value" type="text" bind:value />
		<datalist id="valuelist">
			{#each valueList as nkt}
				<option value={nkt}></option>
			{/each}
		</datalist>
	</div>
	<!-- datalist does currently not work on Android Chrome! -->
	<div class="flex flex-row">
		<Label class="w-40 shrink-0" for="value_select">Vordef:</Label>
		<Select class="" name="valueA" id="value-select" bind:value>
			{#each valueList as nkt}
				<option value={nkt}>{nkt}</option>
			{/each}
		</Select>
	</div>
</div>
