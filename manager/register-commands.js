import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('spawn')
    .setDescription('Spawn a new bot')
    .addStringOption(o => o.setName('persona').setDescription('Bot personality').setRequired(true))
    .addStringOption(o => o.setName('token').setDescription('Bot token').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop a bot')
    .addStringOption(o => o.setName('token').setDescription('Token to stop').setRequired(true)),

  new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart a bot')
    .addStringOption(o => o.setName('token').setDescription('Token to restart').setRequired(true)),

  new SlashCommandBuilder().setName('list').setDescription('List all running bots'),
  new SlashCommandBuilder().setName('killall').setDescription('Stop all bots'),
  new SlashCommandBuilder().setName('active').setDescription('Toggle active mode for the channel'),
  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Disable/Enable a user from manager')
    .addUserOption(o => o.setName('user').setDescription('User to toggle').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const appId = process.env.DISCORD_APP_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    // ⚡ Register commands **instantly in the guild**
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log('✓ Slash commands registered instantly in the guild!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
