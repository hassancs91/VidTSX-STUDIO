export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  whenToUse?: string;
  body: string;
  filePath: string;
  resourcesDir?: string;
  resources?: string[];
}
