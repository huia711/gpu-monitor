import * as vscode from 'vscode';
import { parseSshConfig } from './sshConfigParser';
import { SshHostConfig } from './types';

interface SaveMessage {
  type: 'save';
  refreshInterval: number;
  connectionTimeout: number;
  excludedServers: string[];
}

interface CancelMessage {
  type: 'cancel';
}

export class SettingsPanel {
  static readonly viewType = 'gpuMonitorSettings';
  static currentPanel: SettingsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];

  // ---- Public factory ----

  static createOrShow(): void {
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      'GPU Monitor — Settings',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    SettingsPanel.currentPanel = new SettingsPanel(panel);
  }

  // ---- Private ----

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.iconPath = new vscode.ThemeIcon('settings-gear');
    this._render();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (msg: SaveMessage | CancelMessage) => {
        if (msg.type === 'cancel') { this.dispose(); return; }
        if (msg.type !== 'save')   { return; }

        const cfg = vscode.workspace.getConfiguration('gpuMonitor');
        await cfg.update('refreshInterval',  msg.refreshInterval,  vscode.ConfigurationTarget.Global);
        await cfg.update('connectionTimeout', msg.connectionTimeout, vscode.ConfigurationTarget.Global);
        await cfg.update('excludedServers',  msg.excludedServers,  vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage('GPU Monitor: Settings saved.');
        this.dispose();
      },
      null,
      this._disposables
    );
  }

  private _render(): void {
    const cfg = vscode.workspace.getConfiguration('gpuMonitor');
    this._panel.webview.html = buildHtml({
      servers:           parseSshConfig(),
      excludedServers:   cfg.get<string[]>('excludedServers')   ?? [],
      refreshInterval:   cfg.get<number>('refreshInterval')     ?? 30,
      connectionTimeout: cfg.get<number>('connectionTimeout')   ?? 8,
    });
  }

  dispose(): void {
    SettingsPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) { d.dispose(); }
    this._disposables.length = 0;
  }
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildHtml(data: {
  servers: SshHostConfig[];
  excludedServers: string[];
  refreshInterval: number;
  connectionTimeout: number;
}): string {
  const n = nonce();
  const rows = data.servers.map(s => serverRow(s, data.excludedServers)).join('\n');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}';">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size:   var(--vscode-font-size);
    color:       var(--vscode-foreground);
    background:  var(--vscode-editor-background);
    padding: 28px 32px;
    max-width: 700px;
  }

  h1 {
    font-size: 1.25em;
    font-weight: 600;
    margin-bottom: 28px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
  }

  section { margin-bottom: 32px; }

  .section-title {
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    opacity: 0.55;
    margin-bottom: 14px;
  }

  /* ---- Polling fields ---- */
  .field {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .field-label {
    width: 170px;
    flex-shrink: 0;
  }
  .field-hint {
    font-size: 0.8em;
    opacity: 0.5;
    margin-top: -10px;
    margin-bottom: 14px;
    padding-left: 182px;
  }

  input[type="range"] {
    flex: 1;
    height: 4px;
    accent-color: var(--vscode-focusBorder, #007fd4);
    cursor: pointer;
  }
  .range-val {
    min-width: 42px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    opacity: 0.85;
  }

  input[type="number"] {
    width: 72px;
    background: var(--vscode-input-background);
    color:      var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 4px 8px;
    border-radius: 3px;
    font-size: inherit;
    font-family: inherit;
  }
  input[type="number"]:focus {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .unit { opacity: 0.6; }

  /* ---- Server list ---- */
  .server-list {
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 4px;
    overflow: hidden;
  }
  .server-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    transition: background 0.1s;
  }
  .server-row:last-child { border-bottom: none; }
  .server-row:hover { background: var(--vscode-list-hoverBackground); }

  .server-row.excluded .server-name,
  .server-row.excluded .server-addr { opacity: 0.35; }

  .server-name {
    font-weight: 500;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .server-addr {
    font-size: 0.82em;
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .auth-chip {
    font-size: 0.72em;
    padding: 2px 7px;
    border-radius: 10px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .auth-chip.password {
    background: var(--vscode-inputValidation-warningBackground, #6b4c00);
  }

  /* ---- Toggle switch ---- */
  .toggle {
    position: relative;
    width: 38px;
    height: 22px;
    flex-shrink: 0;
  }
  .toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .toggle-track {
    position: absolute;
    inset: 0;
    background: var(--vscode-input-border, #555);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.18s;
  }
  .toggle input:checked + .toggle-track {
    background: var(--vscode-button-background, #0e639c);
  }
  .toggle-track::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    top: 3px;
    background: var(--vscode-button-foreground, #fff);
    border-radius: 50%;
    transition: transform 0.18s;
  }
  .toggle input:checked + .toggle-track::after {
    transform: translateX(16px);
  }

  /* ---- Actions ---- */
  .actions {
    display: flex;
    gap: 10px;
    padding-top: 8px;
  }
  button {
    padding: 6px 18px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    font-weight: 500;
  }
  .btn-primary {
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
  }
  .btn-primary:hover {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .btn-secondary:hover {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }
  .hint {
    font-size: 0.8em;
    opacity: 0.5;
    margin-bottom: 10px;
  }
</style>
</head>
<body>

<h1>GPU Monitor — Settings</h1>

<!-- ── Polling ── -->
<section>
  <div class="section-title">Polling</div>

  <div class="field">
    <span class="field-label">Refresh interval</span>
    <input type="range" id="refreshInterval" min="5" max="300" step="5"
           value="${data.refreshInterval}">
    <span class="range-val" id="refreshVal">${data.refreshInterval}s</span>
  </div>

  <div class="field">
    <span class="field-label">Connection timeout</span>
    <input type="number" id="connectionTimeout" min="3" max="60"
           value="${data.connectionTimeout}">
    <span class="unit">seconds</span>
  </div>
  <p class="field-hint">
    How long to wait for SSH before marking a server as offline.
  </p>
</section>

<!-- ── Servers ── -->
<section>
  <div class="section-title">Servers</div>
  <p class="hint">Detected from ~/.ssh/config — toggle to skip during refresh.</p>
  <div class="server-list">
${rows}
  </div>
</section>

<!-- ── Actions ── -->
<div class="actions">
  <button class="btn-primary"   id="saveBtn">Save</button>
  <button class="btn-secondary" id="cancelBtn">Cancel</button>
</div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();

  // Slider live update
  const slider = document.getElementById('refreshInterval');
  const sliderVal = document.getElementById('refreshVal');
  slider.addEventListener('input', () => {
    sliderVal.textContent = slider.value + 's';
  });

  // Toggle row dimming
  document.querySelectorAll('.server-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.server-row').classList.toggle('excluded', !cb.checked);
    });
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', () => {
    const excluded = [];
    document.querySelectorAll('.server-toggle').forEach(cb => {
      if (!cb.checked) { excluded.push(cb.dataset.host); }
    });
    vscode.postMessage({
      type: 'save',
      refreshInterval:   parseInt(slider.value, 10),
      connectionTimeout: parseInt(document.getElementById('connectionTimeout').value, 10),
      excludedServers:   excluded,
    });
  });

  // Cancel
  document.getElementById('cancelBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });
</script>
</body>
</html>`;
}

function serverRow(s: SshHostConfig, excluded: string[]): string {
  const isEnabled = !excluded.includes(s.host);
  const checkedAttr = isEnabled ? 'checked' : '';
  const rowClass = isEnabled ? '' : 'excluded';

  const addrStr = s.port === 22
    ? s.hostname
    : `${s.hostname}:${s.port}`;

  const proxyStr = s.proxyJump ? ` → ${s.proxyJump}` : '';

  const authLabel = s.usePassword ? '🔒 password' : '🔑 key';
  const authClass = s.usePassword ? 'auth-chip password' : 'auth-chip';

  return `    <div class="server-row ${rowClass}">
      <label class="toggle">
        <input type="checkbox" class="server-toggle" data-host="${s.host}" ${checkedAttr}>
        <span class="toggle-track"></span>
      </label>
      <span class="server-name">${s.host}</span>
      <span class="server-addr">${addrStr}${proxyStr}</span>
      <span class="${authClass}">${authLabel}</span>
    </div>`;
}
