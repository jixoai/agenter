<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";

  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  let {
    open = $bindable(false),
    query,
    matchCount,
    activeIndex,
    onQueryChange,
    onPrevious,
    onNext,
  }: {
    open?: boolean;
    query: string;
    matchCount: number;
    activeIndex: number;
    onQueryChange: (value: string) => void;
    onPrevious: () => void;
    onNext: () => void;
  } = $props();

  const countLabel = $derived(matchCount === 0 ? "No matches" : `${activeIndex + 1}/${matchCount}`);
</script>

<Dialog.Root bind:open>
  <Dialog.Content preventScroll={false} class="gap-4 sm:max-w-md" data-testid="room-search-dialog">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2 text-base">
        <SearchIcon class="size-4" />
        <span>Search messages</span>
      </Dialog.Title>
      <Dialog.Description>
        Search only the transcript rows currently loaded in this room.
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-3">
      <Input
        aria-label="Search messages"
        value={query}
        placeholder="Search loaded transcript"
        oninput={(event) => {
          onQueryChange(event.currentTarget.value);
        }}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) {
              onPrevious();
              return;
            }
            onNext();
          }
        }}
      />

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-muted-foreground" data-testid="room-search-count">{countLabel}</span>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onclick={onPrevious} disabled={matchCount === 0}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onclick={onNext} disabled={matchCount === 0}>
            Next
          </Button>
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
