import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export async function pickFolder(
  platform = process.platform,
  run = execute,
  signal,
) {
  let command, args;
  if (platform === "darwin") {
    command = "/usr/bin/osascript";
    args = [
      "-e",
      'tell application "Finder"\nactivate\nreturn POSIX path of (choose folder with prompt "Choose a new or empty folder for your Clarity vault")\nend tell',
    ];
  } else if (platform === "win32") {
    command = "powershell.exe";
    args = [
      "-NoProfile",
      "-STA",
      "-Command",
      'Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = "Choose a new or empty folder for your Clarity vault"; $picker.ShowNewFolderButton = $true; if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $picker.SelectedPath }',
    ];
  } else {
    command = "zenity";
    args = [
      "--file-selection",
      "--directory",
      "--title=Choose a folder for your Clarity vault",
    ];
  }
  try {
    const { stdout } = await run(command, args, {
      timeout: 120000,
      maxBuffer: 16384,
      signal,
    });
    return stdout.trim() || null;
  } catch (e) {
    if (
      (platform === "darwin" && /-128|User canceled/.test(e.stderr || "")) ||
      (platform !== "darwin" && e.code === 1)
    )
      return null;
    if (e.killed)
      throw Error(
        "Folder selection timed out. You can paste a folder path below instead.",
      );
    if (
      platform === "darwin" &&
      /-1743|not authorized|not permitted/i.test(e.stderr || "")
    )
      throw Error(
        "macOS did not allow the folder picker to control Finder. Check Privacy & Security → Automation for the app that started Clarity, or paste a folder path below instead.",
      );
    throw Error(
      "Could not open the system folder picker. You can paste a folder path below instead.",
    );
  }
}
