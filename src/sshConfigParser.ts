import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SshHostConfig } from './types';

/**
 * Parse ~/.ssh/config and return a list of host configs.
 * Skips wildcard hosts (Host *, Host *.*) and comment-only entries.
 */
export function parseSshConfig(configPath?: string): SshHostConfig[] {
  const filePath = configPath ?? path.join(os.homedir(), '.ssh', 'config');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const hosts: SshHostConfig[] = [];
  let current: Partial<SshHostConfig> | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip blank lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Key-value split: "Key Value" or "Key=Value"
    const match = line.match(/^(\S+)\s*[= ]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    if (key === 'host') {
      // Save the previous block
      if (current?.host && current.hostname) {
        hosts.push(finalizeConfig(current as SshHostConfig & { host: string }));
      }
      // Skip wildcard patterns
      if (value.includes('*') || value.includes('?')) {
        current = null;
      } else {
        current = { host: value };
      }
      continue;
    }

    if (!current) {
      continue;
    }

    switch (key) {
      case 'hostname':
        current.hostname = value;
        break;
      case 'user':
        current.user = value;
        break;
      case 'port':
        current.port = parseInt(value, 10);
        break;
      case 'identityfile':
        current.identityFile = expandHome(value);
        break;
      case 'proxyjump':
        current.proxyJump = value;
        break;
      case 'preferredauthentications':
        // Mark as password-only if password is listed (and pubkey is not)
        current.usePassword =
          value.toLowerCase().includes('password') &&
          !value.toLowerCase().includes('publickey');
        break;
    }
  }

  // Don't forget the last block
  if (current?.host && current.hostname) {
    hosts.push(finalizeConfig(current as SshHostConfig & { host: string }));
  }

  return hosts;
}

function finalizeConfig(
  c: Partial<SshHostConfig> & { host: string; hostname: string }
): SshHostConfig {
  return {
    host: c.host,
    hostname: c.hostname,
    user: c.user ?? os.userInfo().username,
    port: c.port ?? 22,
    identityFile: c.identityFile,
    proxyJump: c.proxyJump,
    usePassword: c.usePassword ?? false,
  };
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}
