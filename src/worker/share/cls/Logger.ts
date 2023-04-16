let _level: string;

const colors: {
	warn: string;
	debug: string;
	start: string;
	end: string;
	error: string;
	info: string;
} = {
	start: '\x1b[2m',
	warn: '\x1b[35m',
	info: '\x1b[33m',
	debug: '\x1b[36m',
	error: '\x1b[31m',
	end: '\x1b[0m',
};

export default class Logger {
	static levels = ['error', 'warn', 'info', 'debug'];
	private isBrowser: any;
	private messageFormat: any;

	constructor(level?: string) {
		if (!_level) {
			_level = level || 'debug';
		}

		this.messageFormat = '[%t] [%l] - %m';
	}

	static setLevel(level: string) {
		_level = level;
	}

	/**
	 *
	 * @param level {string}
	 * @returns {boolean}
	 */
	canSend(level: string) {
		return Logger.levels.indexOf(_level) >= Logger.levels.indexOf(level);
	}

	/**
	 * @param message {string}
	 */
	warn(message: string) {
		// todo remove later
		if (_level === 'debug') {
			// eslint-disable-next-line no-console
			console.error(new Error().stack);
		}
		this._log('warn', message, colors.warn);
	}

	info(...arg: any) {
		this._log('info', colors.info, ...arg);
	}

	debug(...arg: any) {
		this._log('debug', colors.debug, ...arg);
	}

	/**
	 * @param message {string}
	 */
	error(message: string) {
		// todo remove later
		if (_level === 'debug') {
			// eslint-disable-next-line no-console
			console.error(new Error().stack);
		}
		this._log('error', message, colors.error);
	}

	format(level: string, message: any) {
		if (message.length > 1) {
			message = message
				.map((m: any) => {
					return typeof m === 'string' ? m : JSON.stringify(m);
				})
				.join(' ');
		} else {
			message = typeof message === 'string' ? message : JSON.stringify(message);
		}
		if (message)
			return this.messageFormat
				.replace('%t', new Date().toISOString())
				.replace('%l', level.toUpperCase())
				.replace('%m', message);
	}

	_log(level: string, color: string, ...message: any[]) {
		if (!_level) {
			return;
		}
		if (this.canSend(level)) {
			if (!this.isBrowser) {
				// eslint-disable-next-line no-console
				console.log(color + this.format(level, message) + colors.end);
			} else {
				// eslint-disable-next-line no-console
				console.log(colors.start + this.format(level, message), color);
			}
		}
	}
	static log(...arg: any) {
		new Logger().info(...arg);
	}
	static debug(...arg: any[] | any) {
		new Logger().debug(...arg);
	}
}
