type Fragment = Record<string, any> | null;
export function mergeManifests(input: {
  fragments: { macos?: Fragment; windows?: Fragment; linux?: Fragment };
  tag: string;
  repo: string;
  notes?: string;
}): Record<string, any>;
export function filesIn(manifest: Record<string, any>): string[];
