import {
	Client,
	Collection,
	MessageEmbed,
	MessageEmbedOptions,
	ClientOptions,
	MessageInteraction,
} from 'discord.js';
import { promisify } from 'util';
import consola from 'consola';
import glob from 'glob';
import config from '../config.json';
import { Manager, Payload, Structure } from 'erela.js';
import Spotify from 'erela.js-spotify';
import Deezer from 'erela.js-deezer';
import type Command from "./types/command";
import type Event from "./types/event";
import type consolatypes from "./types/consolatypes";

const globPromise = promisify(glob);

Structure.extend(
	'Queue',
	(Queue) =>
		class extends Queue {
			swap(where: number, to: number): void {
				if (typeof where !== 'number')
					throw new TypeError('[BOT] > from must be a number');
				if (typeof to !== 'number')
					throw new TypeError('[BOT] > to must be a number');
				if (where < 1 || to < 1 || where > this.length || to > this.length)
					throw new Error(
						`[BOT] > from/to must be between 1 and ${this.length}`
					);
				const fromPosition = this[where - 1];
				const toPosition = this[to - 1];
				this[where - 1] = toPosition;
				this[to - 1] = fromPosition;
			}
			move(where: number, to: number): void {
				if (typeof where !== 'number')
					throw new TypeError('[BOT] > from must be a number');
				if (typeof to !== 'number')
					throw new TypeError('[BOT] > to must be a number');
				if (where < 1 || to < 1 || where > this.length || to > this.length)
					throw new Error(
						`[BOT] > from/to must be between 1 and ${this.length}`
					);
				const fromPosition = this[where - 1];
				const toPosition = this[to - 1];
				this[to - 1] = fromPosition;
				this.remove(where - 1);
				for (let i = to; i < this.length; i += 1) {
					i === to ? (this[i - 1] = toPosition) : (this[i - 1] = this[i]);
				}
				this[to] = toPosition;
			}
		}
);

export default class guineabotClient extends Client {
	public config: typeof config;
	public commands: Collection<string, Command>;
	public events: Collection<string, Event>;
	public musicEvents: Collection<string, Event>;
	public consola: typeof consola;
	public manager: Manager;

	constructor(options: ClientOptions) {
		super(options);
		this.config = config;
		this.commands = new Collection();
		this.events = new Collection();
		this.musicEvents = new Collection();
		this.consola = consola;
		this.manager = new Manager({
			plugins: [
				new Spotify({
					clientID: config.spotify_client_id,
					clientSecret: config.spotify_client_secret,
					playlistLimit: 0,
					albumLimit: 0,
				}),
				new Deezer({
					playlistLimit: 0,
					albumLimit: 0,
				}),
			],
			clientName: 'Guineabot-Music',
			nodes: [
				{
					host: config.lavalink.server,
					password: config.lavalink.password,
					port: config.lavalink.port,
					retryDelay: 1000,
					identifier: 'Guineabot-Music',
				},
			],
			send(id: string, payload: Payload) {
				const guild = this.guilds.cache.get(id);
				if (guild) guild.shard.send(payload);
			},
		});
	}

	public async loadCommands(): Promise<void> {
		const commandFiles = await globPromise(`${__dirname}/commands/**/{*.ts,*.js}`);

		this.log({
			level: 'info',
			content: `Loaded ${commandFiles.length} commands`,
		});

		commandFiles.map((command) => {
			const file = require(command);
			this.commands.set(file.name, file);
			if (!file.ownerOnly) file.ownerOnly = false;
			if (!file.userPermissions) file.userPermissions = [];
			if (!file.botPermissions) file.botPermissions = [];
			if (!file.options) file.options = [];
		});
	}

	public async loadEvents(): Promise<void> {
		const eventFiles = await globPromise(`${__dirname}/events/discord/**/{*.ts,*.js}`);
		const musicEventFiles = await globPromise(
			`${__dirname}/events/music/**/{*.ts,*.js}`
		);

		this.log({
			level: "info",
			content: `${eventFiles.length} events loaded`,
		});
		this.log({
			level: "info",
			content: `${musicEventFiles.length} music events loaded`,
		});

		eventFiles.map((event) => {
			const file = require(event);
			this.events.set(file.name, file);
			this.on(file.name, file.execute.bind(null, this));
		});
		musicEventFiles.map((event) => {
			const file = require(event);
			this.musicEvents.set(file.name, file);
			this.on(file.name, file.execute.bind(null, this));
		});
	}

	public embed(options: MessageEmbedOptions, interaction: MessageInteraction): MessageEmbed {
		return new MessageEmbed({ color: "RANDOM", footer: {
			text: `${interaction.user.tag}`,
			iconURL: interaction.user.displayAvatarURL({ 
				dynamic: true,
				format: 'png',
			})
		}, ...options })
		.setTimestamp();
	}

	public log(options: consolatypes): void {
		this.consola[`${options.level}`](`[BOT] > ${options.content}`);
	}

	public connect(): void {
		this.login(this.config.bot_token);
	}
}
