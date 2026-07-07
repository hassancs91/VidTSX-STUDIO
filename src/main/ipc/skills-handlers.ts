import type { SkillsListResponse } from '../../shared/ipc/types';
import { listSkills } from '../services/skills-registry';

export async function handleSkillsList(): Promise<SkillsListResponse> {
  try {
    const skills = await listSkills();
    return {
      success: true,
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        whenToUse: s.whenToUse,
        ...(s.resources && s.resources.length > 0 ? { resources: s.resources } : {}),
      })),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list skills';
    return { success: false, skills: [], error };
  }
}
