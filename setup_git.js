import { execSync } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';

const targetDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'MinGit');
const gitExe = path.join(targetDir, 'cmd', 'git.exe');

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, dest));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(gitExe)) {
    console.log('Downloading MinGit...');
    const zipPath = path.join(process.env.LOCALAPPDATA, 'mingit.zip');
    await download(
      'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/MinGit-2.44.0-64-bit.zip',
      zipPath
    );
    console.log('Extracting MinGit...');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'inherit' });
    fs.unlinkSync(zipPath);
  }

  console.log('Testing git...');
  const ver = execSync(`"${gitExe}" --version`).toString();
  console.log('Found:', ver.trim());

  // Also permanently add to User PATH if not present
  const gitCmdDir = path.join(targetDir, 'cmd');
  try {
    const currentPath = execSync('powershell -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"').toString().trim();
    if (!currentPath.includes('MinGit')) {
      const newPath = currentPath ? `${currentPath};${gitCmdDir}` : gitCmdDir;
      execSync(`powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath}', 'User')"`);
      console.log('Added MinGit to User PATH environment variable.');
    }
  } catch (e) {
    console.warn('Could not update User PATH env var:', e.message);
  }

  // Initialize git repository
  console.log('\n--- Initializing Git Repository ---');
  execSync(`"${gitExe}" init`, { stdio: 'inherit' });

  // Set default config
  execSync(`"${gitExe}" config user.name "Dashboard Admin"`);
  execSync(`"${gitExe}" config user.email "admin@financial-dashboard.local"`);

  // Stage all files
  console.log('Staging files...');
  execSync(`"${gitExe}" add .`, { stdio: 'inherit' });

  // Commit
  console.log('Committing files...');
  try {
    execSync(`"${gitExe}" commit -m "Initial commit: Property Management & Financial Dashboard with automated WhatsApp reminders"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('Commit note:', e.message);
  }

  // Set default branch to main
  execSync(`"${gitExe}" branch -M main`, { stdio: 'inherit' });

  console.log('\n--- Git Status ---');
  execSync(`"${gitExe}" status`, { stdio: 'inherit' });
}

main().catch(console.error);
