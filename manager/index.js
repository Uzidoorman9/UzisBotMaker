import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { fork } from 'child_process';
import path from 'path';
import { formatDuration } from '../utils/helpers.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ALLOWED_USERS = (process.env.ALLOWED_USERS || "").split(",");

const botProcesses = new Map(); // token -> { child, ownerId, userTag, startedAt, persona }
const disabledUsers = new Set();

client.once('ready', () => console.log(`✓ UziBot manager running as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Block disabled users
  if (disabledUsers.has(interaction.user.id)) {
    return interaction.reply({ content: "❌ You are disabled from using the bot manager.", ephemeral: true });
  }

  const token = interaction.options.getString('token');
  const persona = interaction.options.getString('persona');

  // --- SPAWN ---
  if (interaction.commandName === 'spawn') {
    if (!ALLOWED_USERS.includes(interaction.user.id)) return;
    if (botProcesses.has(token)) return interaction.reply({ content: "⚠️ Bot already running", ephemeral: true });

    const child = fork(path.resolve('./worker/worker.js'));
    botProcesses.set(token, { child, ownerId: interaction.user.id, userTag: null, startedAt: Date.now(), persona });

    child.send({ token, persona });

    child.on('message', (msg) => {
      if (msg.type === 'ready') {
        const entry = botProcesses.get(token);
        if (entry) entry.userTag = msg.user;
        interaction.followUp(`✅ Bot logged in as **${msg.user}**`);
      } else if (msg.type === 'error') {
        interaction.followUp(`❌ Failed to start bot: ${msg.error}`);
        botProcesses.delete(token);
      }
    });

    return interaction.reply({ content: `⏳ Spawning bot with persona: "${persona}"`, ephemeral: true });
  }

  // --- STOP ---
  if (interaction.commandName === 'stop') {
    if (!ALLOWED_USERS.includes(interaction.user.id)) return;
    if (!botProcesses.has(token)) return interaction.reply({ content: "⚠️ No bot running with that token", ephemeral: true });

    botProcesses.get(token).child.kill();
    botProcesses.delete(token);
    return interaction.reply({ content: `✂️ Bot stopped`, ephemeral: true });
  }

  // --- RESTART ---
  if (interaction.commandName === 'restart') {
    if (!ALLOWED_USERS.includes(interaction.user.id)) return;
    const entry = botProcesses.get(token);
    if (!entry) return interaction.reply({ content: "⚠️ No bot running with that token", ephemeral: true });

    entry.child.kill();
    botProcesses.delete(token);

    const newChild = fork(path.resolve('./worker/worker.js'));
    botProcesses.set(token, { child: newChild, ownerId: entry.ownerId, userTag: null, startedAt: Date.now(), persona: entry.persona });
    newChild.send({ token, persona: entry.persona });

    newChild.on('message', (msg) => {
      if (msg.type === 'ready') {
        const e = botProcesses.get(token);
        if (e) e.userTag = msg.user;
        interaction.followUp(`✅ Bot restarted and logged in as **${msg.user}**`);
      } else if (msg.type === 'error') {
        interaction.followUp(`❌ Failed to restart bot: ${msg.error}`);
        botProcesses.delete(token);
      }
    });

    return interaction.reply({ content: "⏳ Restarting bot...", ephemeral: true });
  }

  // --- LIST ---
  if (interaction.commandName === 'list') {
    if (botProcesses.size === 0) return interaction.reply({ content: "No bots running", ephemeral: true });
    let msg = "🤖 **Running Bots:**\n";
    for (const [t, { ownerId, userTag, startedAt, persona }] of botProcesses.entries()) {
      const shortToken = t.slice(0,6) + '...';
      const uptime = formatDuration(Date.now() - startedAt);
      msg += `• ${userTag || "(starting...)"}\n  (token: \`${shortToken}\`, owner: <@${ownerId}>, persona: "${persona}", uptime: ${uptime})\n`;
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }

  // --- KILLALL ---
  if (interaction.commandName === 'killall') {
    if (!ALLOWED_USERS.includes(interaction.user.id)) return;
    for (const [t, { child }] of botProcesses.entries()) child.kill();
    botProcesses.clear();
    return interaction.reply({ content: `✂️ All bots stopped`, ephemeral: true });
  }

  // --- ADMIN ---
  if (interaction.commandName === 'admin') {
    const targetUser = interaction.options.getUser('user');
    if (!ALLOWED_USERS.includes(interaction.user.id)) return;
    if (disabledUsers.has(targetUser.id)) {
      disabledUsers.delete(targetUser.id);
      return interaction.reply({ content: `✅ ${targetUser.tag} can now use UziBot manager.`, ephemeral: true });
    } else {
      disabledUsers.add(targetUser.id);
      return interaction.reply({ content: `⛔ ${targetUser.tag} is now disabled from using UziBot manager.`, ephemeral: true });
    }
  }

  // --- ACTIVE toggle ---
  if (interaction.commandName === 'active') {
    // pass to workers via IPC if desired, or implement in worker per channel
    return interaction.reply({ content: "⚡ Active mode toggled (handled in worker)", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
