<script module lang="ts">
  let nextMountId = 1;
</script>

<script lang="ts">
  let {
    row,
  }: {
    row: {
      id: number;
      title: string;
      body: string;
    };
  } = $props();

  const mountId = nextMountId++;
</script>

<article
  class="grid gap-3 rounded-[1rem] border border-border/60 bg-background px-4 py-3 shadow-sm"
  data-identity-mount-id={mountId}
  data-testid={`identity-row-${row.id}`}
>
  <div class="grid gap-2" data-testid={`identity-row-section-${row.id}`}>
    <div class="font-medium text-foreground" data-testid={`identity-row-leaf-${row.id}`}>
      {row.title}
    </div>
    <p class="text-sm text-muted-foreground">{row.body}</p>
  </div>
</article>
