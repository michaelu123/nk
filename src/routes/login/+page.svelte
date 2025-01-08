<script lang="ts">
	import { enhance } from '$app/forms';
	import { EyeOutline, EyeSlashOutline } from 'flowbite-svelte-icons';
	import { Input, Label, Button } from 'svelte-5-ui-lib';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let show = $state(false);
</script>

<div class="mx-4">
	<h1 class="my-5 text-xl font-semibold">Login</h1>
	<form method="post" use:enhance>
		<Label for="username" class="mb-4">
			Name
			<Input
				id="username"
				name="username"
				type="text"
				placeholder="Dein Name"
				size="lg"
				class="pl-10"
				autocomplete="username"
			/>
		</Label>
		<Label for="passwort" class="mb-4">
			Passwort
			<Input
				id="password"
				name="password"
				autocomplete="new-password"
				type={show ? 'text' : 'password'}
				placeholder="Dein Passwort"
				size="lg"
				class="pl-10"
			>
				{#snippet left()}
					<button onclick={() => (show = !show)} class="pointer-events-auto">
						{#if show}
							<EyeOutline class="h-6 w-6" />
						{:else}
							<EyeSlashOutline class="h-6 w-6" />
						{/if}
					</button>
				{/snippet}
			</Input>
		</Label>
		<div class="flex flex-col gap-4">
			<a href="/register">Noch nicht registriert? <span class="underline">Zum Registrieren</span></a
			>
			<Button type="submit" class="w-40">Login</Button>
		</div>
	</form>
	<p class="my-4 text-red-400">{form?.message ?? ''}</p>
</div>
