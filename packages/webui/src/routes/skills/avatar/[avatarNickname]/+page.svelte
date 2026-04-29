<script lang="ts">
	import { page } from '$app/state';

	import SkillAvatarRoute from '$lib/features/skills/skill-avatar-route.svelte';
</script>

<SkillAvatarRoute avatarNickname={page.params.avatarNickname ?? ''} />
