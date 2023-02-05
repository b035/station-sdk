import Fs from "fs/promises";
import Path from "path";

// Log
enum LogTypes {
	status,
	error,
	other,
}

export function log(type: LogTypes, msg: string) {
	let msg = `TYPE ${type}\n${msg}`;
}

// Registry
enum RegistryExitCodes {
	ok = 0,
	err_unknown = 1,
	err_read = 2,
	err_write = 3,
	err_del = 4,
}

interface RegistryResult<T> {
	code: RegistryExitCodes,
	value: T,
}

export const Registry = {
	base_path: "registry",
	full_path: (path: string) => Path.join(Registry.base_path, path),

	async write(path: string, content: string): Promise<RegistryResult<null>> {
		try {
			await Fs.writeFile(Registry.full_path(path), content);
			return {
				code: RegistryExitCodes.ok,
				value: null,
			};
		} catch {
			return {
				code: RegistryExitCodes.err_write,
				value: null,
			};
		}
	},

	async read(path: string): Promise<RegistryResult<string|null>> {
		try {
			let text = await Fs.readFile(Registry.full_path(path), { encoding: "utf8" });
			return {
				code: RegistryExitCodes.ok,
				value: text,
			}
		} catch {
			return {
				code: RegistryExitCodes.err_read,
				value: null,
			}
		}
	},

	async delete(path: string): Promise<RegistryResult<null>> {
		try {
			await Fs.rm(Registry.full_path(path));
			return {
				code: RegistryExitCodes.ok,
				value: null,
			}
		} catch {
			return {
				code: RegistryExitCodes.err_del,
				value: null,
			}
		}
	},
}

// Shell
enum ShellActions {
	exec,
	bg,
	kill,
}

export function shell(action: ShellActions, cmd: string) {
	console.log(`${action}:${cmd}`);

	//TODO hanle output
}
