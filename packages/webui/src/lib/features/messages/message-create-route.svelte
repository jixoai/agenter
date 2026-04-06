<script lang="ts">
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import {
		buildActorDirectory,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';

	const controller = getAppControllerContext();

	let title = $state('');
	let selectedActors = $state<Record<string, boolean>>({});
	let createBusy = $state(false);
	let errorMessage = $state<string | null>(null);

	const selectableActors = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}).filter((actor) => actor.actorKind !== 'system'),
	);

	const toggleActor = (actor: ActorDirectoryEntry): void => {
		selectedActors = {
			...selectedActors,
			[actor.actorId]: !selectedActors[actor.actorId],
		};
	};

	const handleSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (createBusy) {
			return;
		}
		createBusy = true;
		errorMessage = null;
		try {
			const created = await controller.runtimeStore.createGlobalRoom({
				title: title.trim() || undefined,
				participants: Object.entries(selectedActors)
					.filter(([, selected]) => selected)
					.map(([actorId]) => {
						const actor = selectableActors.find((candidate) => candidate.actorId === actorId);
						return {
							id: actorId,
							label: actor?.label,
						};
					}),
			});
			await goto(`/messages/room/${encodeURIComponent(created.chatId)}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			createBusy = false;
		}
	};
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="mx-auto grid w-full max-w-5xl gap-6"
	data-testid="message-create-route"
>
	{#snippet header()}
		<div class="grid gap-2">
			<h2 class="text-base font-semibold">Create room</h2>
			<p class="text-sm text-muted-foreground">Open a new global room directly from a fixed workbench tab.</p>
		</div>
	{/snippet}

	<form class="grid gap-6" onsubmit={handleSubmit}>
		<section class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:p-5">
			<label class="grid gap-2 text-sm font-medium">
				<span>Room title</span>
				<Input bind:value={title} placeholder="Incident bridge" />
			</label>

			<div class="grid gap-3">
				<div class="grid gap-1">
					<div class="text-sm font-medium">Initial participants</div>
					<p class="text-sm text-muted-foreground">Select any human or session actor that should join immediately.</p>
				</div>

				{#if selectableActors.length === 0}
					<div class="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
						No eligible actors available yet.
					</div>
				{:else}
					<div class="grid gap-2 md:grid-cols-2">
						{#each selectableActors as actor (actor.actorId)}
							<label class="flex items-start gap-3 rounded-2xl border px-4 py-3">
								<Checkbox
									checked={selectedActors[actor.actorId] ?? false}
									onCheckedChange={() => {
										toggleActor(actor);
									}}
								/>
								<span class="grid gap-1">
									<span class="text-sm font-medium">{actor.label}</span>
									<span class="text-xs text-muted-foreground">{actor.subtitle ?? actor.actorId}</span>
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		{#if errorMessage}
			<NoticeBanner tone="destructive" message={errorMessage} />
		{/if}

		<div class="flex justify-end">
			<Button type="submit" disabled={createBusy}>
				{createBusy ? 'Creating…' : 'Create room'}
			</Button>
		</div>
	</form>
</WorkbenchScaffold>
