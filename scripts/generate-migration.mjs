import { execSync } from 'node:child_process';

try {
  const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

  const sanitizedName = branchName.replaceAll(/[\\/_]/g, '-').replaceAll(/[^a-zA-Z0-9-]/g, '');

  if (!sanitizedName) {
    console.error('Error: Could not determine a valid migration name from the branch.');
    process.exit(1);
  }

  console.log(`Generating migration from branch: '${branchName}' -> '${sanitizedName}'`);

  execSync(`supabase db diff --use-migra --schema public,auth -f "${sanitizedName}"`, {
    stdio: 'inherit',
  });

  console.log('Migration file generated.');
} catch (error) {
  console.error('\nError generating migration:', error.message);
  process.exit(1);
}
