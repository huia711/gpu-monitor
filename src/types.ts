export interface SshHostConfig {
  host: string;           // SSH config alias (e.g. "Lu-A6000")
  hostname: string;       // actual IP or hostname
  user: string;
  port: number;
  identityFile?: string;
  proxyJump?: string;
  usePassword: boolean;   // PreferredAuthentications includes "password"
}

export interface ProcessInfo {
  pid: number;
  processName: string;
  memUsedMiB: number;
}

export interface GpuInfo {
  index: number;
  name: string;
  utilizationPct: number;
  memUsedMiB: number;
  memTotalMiB: number;
  temperatureC: number;
  processes: ProcessInfo[];
}

export type ServerStatusKind =
  | 'idle'        // not yet fetched
  | 'loading'     // fetching in progress
  | 'online'      // data fetched successfully
  | 'no-gpu'      // connected but nvidia-smi not found
  | 'needs-auth'  // password not stored; waiting for user to enter
  | 'error';      // connection or other error

export interface ServerStatus {
  config: SshHostConfig;
  kind: ServerStatusKind;
  gpus: GpuInfo[];
  error?: string;
  lastUpdated?: Date;
}

export interface FetchResult {
  gpus: GpuInfo[];
  noGpu?: boolean;
  needsAuth?: boolean;  // password not stored; caller should prompt explicitly
  error?: string;
}
