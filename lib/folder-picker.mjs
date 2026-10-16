import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export async function pickFolder(platform = process.platform, run = execute) {
  let command, args;
  if (platform === "darwin") {
    command = "/usr/bin/osascript";
    args = [
      "-e",
      'POSIX path of (choose folder with prompt "Choose a new or empty folder for your Folio vault")',
    ];
  } else if (platform === "win32") {
    command = "powershell.exe";
    args = [
      "-NoProfile",
      "-STA",
      "-Command",
      'Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = "Choose a new or empty folder for your Folio vault"; $picker.ShowNewFolderButton = $true; if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $picker.SelectedPath }',
    ];
  } else {
    command = "zenity";
    args = [
      "--file-selection",
      "--directory",
      "--title=Choose a folder for your Folio vault",
    ];
  }
  try {
    const { stdout } = await run(command, args, {
      timeout: 120000,
      maxBuffer: 16384,
    });
    return stdout.trim() || null;
  } catch (e) {
    if (
      (platform === "darwin" && /-128|User canceled/.test(e.stderr || "")) ||
      (platform !== "darwin" && e.code === 1)
    )
      return null;
    if (e.killed) throw Error("Folder selection timed out. Try again.");
    throw Error(
      "Could not open the system folder picker. You can paste a folder path below instead.",
    );
  }
}
