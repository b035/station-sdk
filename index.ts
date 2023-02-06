import Child from "child_process";
import Fs from "fs/promises";
import Path from "path";

// Basic
export enum ExitCodes {
	ok = 0,
	err = 1,
}

export class Result<C, V> {
	code: C;
	value: V | undefined;

	unwrap_message: () => string = () => "Unknown: invalid result.";

	constructor(code: C, value: V) {
		this.code = code;
		this.value = value;
	}

	err(cb: (result: Result<C, V>) => any) {
		if (this.failed) {
			cb(this);
		}
		return this;
	}

	ok(cb: (result: Result<C, V>) => any) {
		if (!this.failed) {
			cb(this);
		}
		return this;
	}

	unwrap(msg?: string) {
		if (this.failed) {
			console.trace(this);
			const message = msg ?? this.unwrap_message();
			log("PANIC", message);
			throw message;
		}
		return this;
	}

	log_error(msg?: string) {
		if (this.failed) {
			log("ERROR", msg ?? this.unwrap_message());
		}
		return this;
	}

	get failed(): boolean {
		return this.code > 0;
	}
}

// Log
export type LogType = "ACTIVITY" | "ERROR" | "PANIC" | "OTHER" | "STATUS";
const LOG_DIR = "logs/current";

export async function log(type: LogType, msg: string) {
	msg = `TYPE ${type}\nPID ${process.pid}\n${msg}`;
	const timestamp= new Date().toISOString() + Math.random().toString();
	const filename= `log-${timestamp}`;

	const path = Path.join(LOG_DIR, filename);
	(await Registry.write(path, msg))
		.unwrap("failed to log");
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
class RegistryResult<T> extends Result<RegistryExitCodes, T> {}

export const Registry = {
	base_path: "registry",
	get_full_path: (path: string) => Path.join(Registry.base_path, ...path.split("/")),

	get_unwrap_message: (msg: string) => `Registry: ${msg}`,

	async mkdir(path: string): Promise<RegistryResult<undefined>> {
		const full_path = Registry.get_full_path(path);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);
		result.unwrap_message = () => Registry.get_unwrap_message(`failed to create directory "${path}"`);

		try {
			await Fs.mkdir(full_path, { recursive: true });
			result.code = RegistryExitCodes.ok;
		} catch {
			(await Registry.test(full_path))
				.ok(() => result.code = RegistryExitCodes.ok_unchanged)
				.err(() => result.code = RegistryExitCodes.err_unknown);
		}

		return result;
	},

	async write(path: string, content: string): Promise<RegistryResult<undefined>> {
		const full_path = Registry.get_full_path(path);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);
		result.unwrap_message = () => Registry.get_unwrap_message(`failed to write file "${path}"`);

		try {
			await Fs.writeFile(full_path, content);
			result.code = RegistryExitCodes.ok;
		} catch {
			result.code = RegistryExitCodes.err_write;
		}

		return result;
	},

	async read(path: string): Promise<RegistryResult<string|undefined>> {
		const full_path = Registry.get_full_path(path);

		const result: RegistryResult<string|undefined> = new RegistryResult(RegistryExitCodes.err_unknown, undefined);
		result.unwrap_message = () => Registry.get_unwrap_message(`failed to read file "${path}"`);

		try {
			const text = await Fs.readFile(full_path, { encoding: "utf8" });
			result.code = RegistryExitCodes.ok;
			result.value = text;
		} catch {
			result.code = RegistryExitCodes.err_read;
		}

		return result;
	},

	async ls(path: string): Promise<RegistryResult<string[]|undefined>> {
		const full_path = Registry.get_full_path(path);

		const result: RegistryResult<string[]|undefined> = new RegistryResult(RegistryExitCodes.err_unknown, undefined);
		result.unwrap_message = () => Registry.get_unwrap_message(`failed to read directory "${path}"`);

		try {
			const items = await Fs.readdir(full_path);
			result.code = RegistryExitCodes.ok;
			result.value = items;
		} catch {
			result.code = RegistryExitCodes.err_read;
		}

		return result;
	},

	async delete(path: string): Promise<RegistryResult<undefined>> {
		const full_path = Registry.get_full_path(path);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);
		result.unwrap_message = () => Registry.get_unwrap_message(`failed to delete item "${path}"`);

		try {
			await Fs.rm(full_path, { recursive: true });
			log("ACTIVITY", `Registry: deleted "${path}"`);

			result.code = RegistryExitCodes.ok;
		} catch {
			result.code = RegistryExitCodes.err_del;
		}

		return result;
	},

	async read_or_create(path: string, default_value: string): Promise<RegistryResult<string|undefined>> {
		const read_result = await Registry.read(path);
		if (!read_result.failed) return read_result;

		const write_result = await Registry.write(path, default_value);
		return new RegistryResult(write_result.code, default_value);
	},

	async test(path: string): Promise<RegistryResult<undefined>> {
		const full_path = Registry.get_full_path(path);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);

		try {
			await Fs.stat(full_path);
			result.code = RegistryExitCodes.ok;
		} catch {}

		return result;
	},
	
	async copy(src: string, dest: string): Promise<RegistryResult<undefined>> {
		const full_src = Registry.get_full_path(src);
		const full_dest = Registry.get_full_path(dest);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);

		try {
			await Fs.cp(full_src, full_dest, { recursive: true });
			result.code = RegistryExitCodes.ok;
		} catch {}

		return result;
	},

	async move(src: string, dest: string): Promise<RegistryResult<undefined>> {
		const full_src = Registry.get_full_path(src);
		const full_dest = Registry.get_full_path(dest);

		const result = new RegistryResult(RegistryExitCodes.err_unknown, undefined);

		try {
			await Fs.rename(full_src, full_dest);
			result.code = RegistryExitCodes.ok;
		} catch {}

		return result;
	},
}

// Shell
class ShellResult extends Result<ExitCodes, Child.ChildProcess|undefined> {
	command: string = "";
	unwrap_message = () => `Shell: an error occured while trying to run "${this.command}".`;
}

const PROCESS_TRACKING_DIR = "tmp/processes"

export const Shell = {
	async exec(stsh_cmd: string): Promise<ShellResult> {
		let result = new ShellResult(ExitCodes.err, undefined);
		result.command = stsh_cmd;

		stsh_cmd = stsh_cmd.replace(/^ /g, "");
		const separator_index = stsh_cmd.indexOf(" ");
		let service, args;

		if (separator_index > -1) {
			service = stsh_cmd.substring(0, separator_index);
			args = stsh_cmd.substring(separator_index);
		} else {
			service = stsh_cmd;
		}

		//get service command
		const cmd_result = await Registry.read(Path.join("services", service));
		if (cmd_result.failed) {
			log("ERROR", `Shell: failed to get service for "${service}".`);
			return result;
		}

		//get full command
		const service_cmd = cmd_result.value!.split("\n")[0];
		const sys_cmd = `${service_cmd}${args ?? ""}`;

		//spawn process
		const cp = Child.spawn(sys_cmd, {
			shell: true,
			detached: true,
		});

		//track
		Shell.track(sys_cmd, cp);

		result.code = ExitCodes.ok;
		result.value = cp;
		return result;
	},

	async track(cmd: string, cp: Child.ChildProcess) {
		const pid = cp.pid;

		//safety
		if (pid == undefined) {
			cp.kill();
			return;
		}

		const path = Path.join(PROCESS_TRACKING_DIR, pid.toString());

		const abort = async (type: LogType) => {
			if (cp.killed == false) cp.kill();
			log(type, `Shell: ${pid} killed`);
			(await Registry.delete(path)).log_error();
		}

		//create tracking directory if needed
		(await Registry.mkdir(PROCESS_TRACKING_DIR))
			.err(() => abort("ERROR"));
		//track process
		(await Registry.write(path, ""))
			.err(() => abort("ERROR"))
			.ok(() => log("ACTIVITY", `Shell: started tracking "${cmd}" (${pid})`));
	
		//handle killing
		cp.on("exit", () => abort("STATUS"));
		//in case it already died
		if (cp.exitCode != null) abort("STATUS");
	},

	async kill(pid: number) {
		//check if process exists
		if ((await Registry.read(Path.join(PROCESS_TRACKING_DIR, pid.toString()))).failed) return;

		process.kill(pid);
	}
}
