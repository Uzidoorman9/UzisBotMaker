import { Client, GatewayIntentBits } from 'discord.js';
import OpenAI from 'openai';
import { pushMemory, getLastMessages } from '../utils/helpers.js';

let userMemory = new Map();
let activeChannels = new Set();
const availableModels = ["gpt-4o-mini","gpt-3.5-turbo","gpt-4o-mini-0613"];
let currentModelIndex = 0;

process.on('message', async ({ token, persona }) => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  function switchModel() {
    currentModelIndex = (currentModelIndex + 1) % availableModels.length;
  }

  async function generateReply(userId, prompt, msg) {
    let attempt = 0;
    while (attempt < availableModels.length) {
      const model = availableModels[currentModelIndex];
      const messages = [
        { role: 'system', content: persona },
        ...getLastMessages(userMemory, userId),
        { role: 'user', content: prompt }
      ];

      try {
        const resp = await openai.chat.completions.create({
          model, messages, temperature: 0.7
        });
        return resp.choices[0].message.content;
      } catch (err) {
        console.log(`⚠️ Model ${model} failed: ${err.message}`);
        switchModel();
        msg.reply(`⚡ Switched AI model to **${availableModels[currentModelIndex]}**`);
        attempt++;
      }
    }
    return "⚠️ All AI models are unavailable right now.";
  }

  client.once('ready', () => process.send?.({ type: 'ready', user: client.user.tag }));

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    const isReply = msg.reference?.messageId && msg.reference?.guildId;
    const isMention = msg.mentions.has(client.user);
    const isActive = activeChannels.has(msg.channel.id);

    if (!msg.content.startsWith('!chat') && !msg.content.startsWith('!img') && !isReply && !isMention && !isActive) return;

    // IMAGE
    if (msg.content.startsWith('!img')) {
      const prompt = msg.content.replace('!img','').trim();
      if (!prompt) return msg.reply("⚠️ Provide a prompt");
      try {
        const resp = await openai.images.generate({ model: 'gpt-image-1', prompt, size:'512x512' });
        const b64 = resp.data[0].b64_json;
        const buffer = Buffer.from(b64,'base64');
        return msg.reply({ files: [{ attachment: buffer, name:'image.png' }] });
      } catch {
        return msg.reply("⚠️ Failed to generate image.");
      }
    }

    let prompt = msg.content.startsWith('!chat') ? msg.content.replace('!chat','').trim() : msg.content.replace(`<@${client.user.id}>`,'').trim();

    try {
      const reply = await generateReply(msg.author.id, prompt, msg);
      pushMemory(userMemory, msg.author.id, 'user', prompt);
      pushMemory(userMemory, msg.author.id, 'assistant', reply);
      msg.reply(reply);
    } catch {
      msg.reply("⚠️ Error generating response.");
    }
  });
  
  try { await client.login(token); }
  catch (err) { process.send?.({ type:'error', error: err.message }); process.exit(1); }
});
