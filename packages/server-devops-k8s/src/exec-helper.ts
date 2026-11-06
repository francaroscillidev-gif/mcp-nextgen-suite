import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Execute command safely without shell expansion vulnerabilities
 */
export async function safeExec(cmd: string, args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(cmd, args, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024 // 10MB
  });
}
