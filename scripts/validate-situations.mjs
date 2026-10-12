import { execFileSync } from "node:child_process";

const code = `
import { validateSampleSituationActionRefs } from './src/lib/situations/validate';
const result = validateSampleSituationActionRefs(1700000000000);
if (!result.ok) {
  console.error(JSON.stringify(result.unresolved, null, 2));
  process.exit(1);
}
console.log('situation action refs ok');
`;

execFileSync('pnpm', ['exec', 'tsx', '--eval', code], { stdio: 'inherit' });
