import Fs from "fs/promises";
import Path from "path";

// Log
type LogType = "ACTIVITY" | "ERROR" | "OTHER" | "STATUS";

export async function log(type: LogType, msg: string) {
	msg = `TYPE ${type}\n${msg}`;
	const dirname = "logs";
	const timestamp= new Date().toISOString();
	const filename= `log-${timestamp}`;

	const dir_result = await Registry.mkdir(dirname);
	if (dir_result.code > 0) return console.trace("failed to create logs directory");

	const path = Path.join(dirname, filename);
	const file_result = await Registry.write(path, msg);
	if (file_result.code > 0) return console.trace("failed to log");
}

// Registry
export enum RegistryExitCodes {
	ok_unchanged = -1,
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

	async mkdir(path: string): Promise<RegistryResult<null>> {
		const full_path = Registry.full_path(path);

		try {
			await Fs.mkdir(full_path, { recursive: true });
			return {
				code: RegistryExitCodes.ok,
				value: null,
			}
		} catch {
			try {
				await Fs.stat(full_path);
				return {
					code: RegistryExitCodes.ok_unchanged,
					value: null,
				}
			} catch {
				return {
					code: RegistryExitCodes.err_unknown,
					value: null,
				}
			}
		}
	},

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
			const text = await Fs.readFile(Registry.full_path(path), { encoding: "utf8" });
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
			await Fs.rm(Registry.full_path(path), { recursive: true });
			log("ACTIVITY", `Registry: deleting "${path}"`);
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

	async read_or_create(path: string, default_value: string): Promise<RegistryResult<string|null>> {
		const read_result = await Registry.read(path);
		if (read_result.code == RegistryExitCodes.ok) return read_result;

		const write_result = await Registry.write(path, default_value);
		return write_result;
	},
}

// Shell
type ShellAction = "exec" | "bg" | "kill";

export function shell(action: ShellAction, cmd: string) {
	const output = `${action}:${cmd}`;
	log("ACTIVITY", `Running shell command\n${output}`);
	console.log(output);

	//TODO hanle output
}
