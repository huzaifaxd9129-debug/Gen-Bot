require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

const TOKEN = process.env.BOT_TOKEN;
const PREFIX = process.env.PREFIX || "?";
const GEN_CHANNEL_ID = process.env.GEN_CHANNEL_ID || "1500622495236231388";
const COOLDOWN_SECONDS = 60 * 5;

if (!TOKEN) {
  console.error("❌ BOT_TOKEN not found in .env — add BOT_TOKEN=your_token");
  process.exit(1);
}

const stockPath = path.join(__dirname, "stock.json");
let stock = {};
try {
  if (fs.existsSync(stockPath)) {
    stock = JSON.parse(fs.readFileSync(stockPath, "utf8"));
  } else {
    stock = { mcfa: [], crunchyroll: [], netflix: [] };
    fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2));
  }
} catch (err) {
  console.error("❌ Failed to load stock.json:", err);
  stock = { mcfa: [], crunchyroll: [], netflix: [] };
  fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2));
}

function saveStock() {
  try {
    fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2));
  } catch (err) {
    console.error("❌ Failed to save stock.json:", err);
  }
}

for (const k of Object.keys(stock)) {
  stock[k] = Array.isArray(stock[k]) ? stock[k].map(s => (s || "").toString().trim()).filter(Boolean) : [];
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const cooldowns = new Map();

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity(`Generating Mcfa In BlackFlame's HomeTown | ${PREFIX}help`);
});

async function safeReply(message, payload) {
  try {
    if (message.deletable) {
    }
    return await message.reply(payload);
  } catch (err) {
    console.warn("⚠️ safeReply failed:", err.code ?? err.message);
    return null;
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "help" || cmd === "h") {
    const embed = new EmbedBuilder()
      .setTitle("🎁 MCFA Gen Bot Commands")
      .setColor("Purple")
      .setDescription(
        `**${PREFIX}gen <type>** → Generate (only in gen channel)\n` +
          `**${PREFIX}list** → Show types\n` +
          `**${PREFIX}addstock <type> <email:pass>** → Admin only\n` +
          `**${PREFIX}stock** → View stock counts (admin)`
      )
      .setFooter({ text: "Made With ❤️ By Huztro });
    return safeReply(message, { embeds: [embed] });
  }

  if (cmd === "list") {
    const keys = Object.keys(stock);
    if (keys.length === 0) return safeReply(message, "❌ No stock found.");
    const list = keys.map((k) => `• **${k}** (${stock[k].length} left)`).join("\n");
    const embed = new EmbedBuilder().setTitle("📦 Available Stock").setColor("Blue").setDescription(list).setFooter({ text: "Made with ❤️ by @BlackFlameYT" });
    return safeReply(message, { embeds: [embed] });
  }

  if (cmd === "gen") {
    if (message.channel.id !== GEN_CHANNEL_ID) {
      return safeReply(message, `❌ You can only use this command in <#${GEN_CHANNEL_ID}>`);
    }

    const type = args[0];
    if (!type) return safeReply(message, `Usage: \`${PREFIX}gen <type>\``);

    const now = Date.now();
    const last = cooldowns.get(message.author.id) || 0;
    const elapsed = Math.floor((now - last) / 1000);
    if (elapsed < COOLDOWN_SECONDS) {
      return safeReply(message, `⏳ Wait ${COOLDOWN_SECONDS - elapsed}s before using again.`);
    }

    if (!stock[type] || stock[type].length === 0) {
      return safeReply(message, `⚠️ No stock available for **${type}** right now.`);
    }

    const code = stock[type].shift();
    if (!code || code.length === 0) {
      saveStock();
      return safeReply(message, `⚠️ Could not fetch a valid account. Try again or contact admin.`);
    }
    saveStock();

    try {
      await message.author.send(`🎁 Your **${type.toUpperCase()}** account:\n\`${code}\`\nEnjoy responsibly!\n\n❤️ Made by @Huztro`);
      cooldowns.set(message.author.id, now);

      const embed = new EmbedBuilder().setTitle("✅ Account Sent!").setDescription(`Check your DMs for your **${type.toUpperCase()}** account!`).setColor("Green").setFooter({ text: "Made with ❤️ by @BlackFlameYT" });

      await safeReply(message, { embeds: [embed] });

      console.log(`[LOG] ${message.author.tag} generated ${type}: ${code}`);
    } catch (err) {
      stock[type].unshift(code);
      saveStock();
      console.warn("⚠️ DM failed:", err.code ?? err.message);
      return safeReply(message, "❌ I couldn't DM you! Please enable DMs from server members.");
    }
  }

  if (cmd === "addstock") {
    if (!message.inGuild()) return safeReply(message, "❌ This command only works in a server.");
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return safeReply(message, "❌ Only admins can add stock.");

    const type = args[0];
    const code = args.slice(1).join(" ").trim();
    if (!type || !code) return safeReply(message, `Usage: \`${PREFIX}addstock <type> <email:pass>\``);

    if (!code.includes(":")) return safeReply(message, "❌ Invalid format. Use `email:password`.");

    if (!stock[type]) stock[type] = [];
    stock[type].push(code);
    saveStock();
    return safeReply(message, `✅ Added new account to **${type}**.`);
  }

  if (cmd === "stock") {
    if (!message.inGuild()) return safeReply(message, "❌ This command only works in a server.");
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return safeReply(message, "❌ Only admins can view stock.");

    const info = Object.entries(stock).map(([k, v]) => `${k}: ${v.length}`).join("\n");
    const embed = new EmbedBuilder().setTitle("📦 Current Stock").setColor("Gold").setDescription(info || "No stock available.").setFooter({ text: "Made with ❤️ by @BlackFlameYT" });

    try {
      await safeReply(message, { embeds: [embed] });
    } catch (err) {
      console.warn("⚠️ Could not send stock message:", err.code ?? err.message);
    }
  }
});

client.login(TOKEN).catch(err => {
  console.error("❌ Failed to login. Check BOT_TOKEN in .env:", err.message);
  process.exit(1);
});

