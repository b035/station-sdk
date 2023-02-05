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

	constructor(code: C, value: V) {
		this.code = code;
		this.value = value;
	}

	err(cb: (result: Result<C, V>) => any): Result<C, V> {
		if (this.code > 0) {
			cb(this);
		}
		return this;
	}

	ok(cb: (result: Result<C, V>) => any): Result<C, V> {
		if (this.code <= 0) {
			cb(this);
		}
		return this;
	}

	get failed(): boolean {
		return this.code > 0;
	}
}

// Log
export type LogType = "ACTIVITY" | "ERROR" | "OTHER" | "STATUS";

export async function log(type: LogType, msg: string) {
	msg = `TYPE ${type}\n${msg}`;
	const dirname = "logs";
	const timestamp= new Date().toISOString();
	const filename= `log-${timestamp}`;

	const path = Path.join(dirname, filename);
	(await Registry.write(path, msg))
		.err(() => console.trace("failed to log"));
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
type RegistryResult<T> = Result<RegistryExitCodes, T>

export const Registry = {
	base_path: "registry",
	full_path: (path: string) => Path.join(Registry.base_path, path),

	async mkdir(path: string): Promise<RegistryResult<undefined>> {
		const full_path = Registry.full_path(path);

		try {
			await Fs.mkdir(full_path, { recursive: true });
			return new Result(RegistryExitCodes.ok, undefined);
		} catch {
			try {
				await Fs.stat(full_path);
				return new Result(RegistryExitCodes.ok_unchanged, undefined);
			} catch {
				return new Result(RegistryExitCodes.err_unknown, undefined);
			}
		}
	},

	async write(path: string, content: string): Promise<RegistryResult<undefined>> {
		try {
			await Fs.writeFile(Registry.full_path(path), content);
			return new Result(RegistryExitCodes.ok, undefined);
		} catch {
			return new Result(RegistryExitCodes.err_write, undefined);
		}
	},

	async read(path: string): Promise<RegistryResult<string|undefined>> {
		try {
			const text = await Fs.readFile(Registry.full_path(path), { encoding: "utf8" });
			return new Result(RegistryExitCodes.ok, text);
		} catch {
			return new Result(RegistryExitCodes.err_read, undefined);
		}
	},

	async delete(path: string): Promise<RegistryResult<undefined>> {
		try {
			await Fs.rm(Registry.full_path(path), { recursive: true });
			log("ACTIVITY", `Registry: deconsting "${path}"`);
			return new Result(RegistryExitCodes.ok, undefined);
		} catch {
			return new Result(RegistryExitCodes.err_del, undefined);
		}
	},

	async read_or_create(path: string, default_value: string): Promise<RegistryResult<string|undefined>> {
		const read_result = await Registry.read(path);
		if (read_result.code == RegistryExitCodes.ok) return read_result;

		const write_result = await Registry.write(path, default_value);
		return new Result(write_result.code, default_value);
	},
}

// Shell
const PROCESS_TRACKING_DIR = Path.join("tmp", "processes");
export const Shell = {
	async exec(service: string, args: string): Promise<Result<ExitCodes, Child.ChildProcess|undefined>> {
		let result = new Result<ExitCodes, Child.ChildProcess|undefined>(ExitCodes.err, undefined);

		//get service command
		const cmd_result = await Registry.read(Path.join("services", service));
		if (cmd_result.failed) {
			log("ERROR", `Shell: failed to get service for "${service}".`);
			return result;
		}

		//get full command
		const service_cmd = cmd_result.value!.split("\n")[0];
		const cmd = `${service_cmd} ${args}`;

		//spawn process
		const cp = Child.spawn(cmd, {
			shell: true,
			detached: true,
		});
		
		const pid = cp.pid;

		//safety
		if (pid == undefined) {
			cp.kill();
			return result; 
		};

		const path = Path.join(PROCESS_TRACKING_DIR, `process-${pid}`);

		const abort = async (type: LogType) => {
			if (cp.killed == false) cp.kill();
			await Registry.delete(path);

			log(type, `Shell: killed "${pid}"`);
		}

		cp.on("exit", () => abort("ACTIVITY"));

		//create tracking directory if needed
		(await Registry.mkdir(PROCESS_TRACKING_DIR))
			.err(() => abort("ERROR"));
		//track process
		(await Registry.write(path, ""))
			.err(() => abort("ERROR"))
			.ok(() => log("ACTIVITY", `Shell: started "${cmd}" as ${pid}`));

		result.code = ExitCodes.ok;
		result.value = cp;
		return result;
	}
}
