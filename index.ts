export const Shell = {
	tell(prefix: string, command: string) {
		console.log(`${prefix}:${command}`);
	},

	exec: (cmd: string) => Shell.tell("exec", cmd),
	bg: (cmd: string) => Shell.tell("exec", cmd),
	kill: (cmd: string) => Shell.tell("exec", cmd),
}
