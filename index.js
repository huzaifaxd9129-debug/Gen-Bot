require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActivityType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const PREFIX = process.env.PREFIX || "+";
const TOKEN = process.env.BOT_TOKEN;
const VERIFY_ROLE_ID = process.env.VERIFY_ROLE_ID;
const REQUIRED_STATUS = "discord.gg/aYNdYe8PCb";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
});
// ================= READY =================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setActivity("Made By Huztro", {
    type: ActivityType.Watching,
  });
});

// ================= WELCOME SYSTEM =================
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome!")
    .setDescription(`Welcome ${member} to **${member.guild.name}**`)
    .setColor("Green");

  channel.send({ embeds: [embed] });
});

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const stockFile = path.join(__dirname, "data/stock.json");

let stock = {};

try {
  if (fs.existsSync(stockFile)) {
    stock = JSON.parse(fs.readFileSync(stockFile, "utf8") || "{}");
  }
} catch (err) {
  console.log("Stock load error:", err);
  stock = {};
}

  // ================= STATUS =================
  if (cmd === "status") {
    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Status")
      .setColor("Green")
      .addFields(
        { name: "Ping", value: `${client.ws.ping}ms` },
        { name: "Status", value: "Online 🟢" },
        { name: "Prefix", value: PREFIX }
      );

    return message.reply({ embeds: [embed] });
  }

  // ================= CSTATUS VERIFY SYSTEM =================
if (cmd === "cstatus") {
  const member = await message.guild.members.fetch(message.author.id);

  const presence = member.presence;

  if (!presence || !presence.activities) {
    return message.reply("❌ Cannot detect status. Make sure presence intent is enabled.");
  }

  const activity = presence.activities.find(a => a.type === 4);
  const customStatus = activity?.state;

  if (!customStatus) {
    return message.reply("❌ No custom status found.");
  }

  if (customStatus.includes(REQUIRED_STATUS)) {
    const role = message.guild.roles.cache.get(VERIFY_ROLE_ID);
    if (!role) return message.reply("❌ Role not found.");

    await member.roles.add(role);
    return message.reply("✅ Verified successfully! Role given.");
  } else {
    return message.reply("❌ Required link not found in your status.");
  }
}

  // ================= STOCK =================
  if (cmd === "stock") {
    const embed = new EmbedBuilder()
      .setTitle("📦 Stock")
      .setColor("Blue")
      .setDescription(
        Object.keys(stock)
          .map(x => `**${x}**: ${stock[x].length}`)
          .join("\n") || "No stock"
      );

    return message.reply({ embeds: [embed] });
  }

  // ================= RESTOCK =================
  if (cmd === "restock") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Admin only");
    }

    const item = args[0];
    const data = args.slice(1).join(" ").split(",");

    if (!item || !data.length) {
      return message.reply("Usage: +restock item value1,value2");
    }

    if (!stock[item]) stock[item] = [];

    stock[item].push(...data);

    fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));

    return message.reply(`✅ Restocked **${item}**`);
  }

  // ================= GENERATOR =================
  if (cmd === "gen") {
    const item = args[0];
    if (!item) return message.reply("Usage: +gen item");

    if (!stock[item] || stock[item].length === 0) {
      return message.reply("❌ Out of stock");
    }

    const data = stock[item].shift();

    fs.writeFileSync(stockFile, JSON.stringify(stock, null, 2));

    return message.author.send(`🎁 ${item}: \`${data}\``)
      .then(() => message.reply("📩 Sent in DM"))
      .catch(() => message.reply("If you didnt recive it enable your DMs"));
  }

  // ================= MODERATION =================
  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;

    const user = message.mentions.members.first();
    if (!user) return message.reply("Mention user");

    await user.kick();
    return message.reply("Kicked user");
  }

  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;

    const user = message.mentions.members.first();
    if (!user) return message.reply("Mention user");

    await user.ban();
    return message.reply("Banned user");
  }

  if (cmd === "ping") {
    return message.reply(`🏓 ${client.ws.ping}ms`);
  }
});

client.login(process.env.BOT_TOKEN);
