import type { PageServerLoad } from './$types';
import { getIconStudioData } from '@agenter/ui';

export const prerender = true;

export const load: PageServerLoad = async () => getIconStudioData();
