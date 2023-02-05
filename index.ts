import Fs from "fs/promises";
import Path from "path";

// Log
enum LogType {
	status,
	error,
	other,
}

export function log(type: LogType, msg: string) {
	let msg = `TYPE ${type}\n${msg}`;
}

// Shell
enum ShellAction {
	exec,
	bg,
	kill,
}

export function shell(action: ShellAction, cmd: string) {
	console.log(`${action}:${cmd}`);

	//TODO hanle output
}
