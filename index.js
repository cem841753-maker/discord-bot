const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is running 🟢"));
app.listen(process.env.PORT || 3000);

require("dotenv").config();
const fs = require("fs");
const Parser = require("rss-parser");
const parser = new Parser();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "▶️ Dev Shebani 💜",
        type: ActivityType.Playing
      }
    ]
  });

  startYouTubeChecker();
});

/* ================= DATA ================= */
function loadData() {
  if (!fs.existsSync("./channels.json")) fs.writeFileSync("./channels.json", "{}");
  return JSON.parse(fs.readFileSync("./channels.json"));
}

function saveData(data) {
  fs.writeFileSync("./channels.json", JSON.stringify(data, null, 2));
}

function ensureGuild(data, guildId) {
  if (!data[guildId]) {
    data[guildId] = {
      notifyChannel: null,
      youtubeChannels: [],
      lastVideos: {}
    };
  }
}

/* ================= COMMANDS ================= */
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const data = loadData();
  ensureGuild(data, message.guild.id);

  const embed = (text) =>
    new EmbedBuilder()
      .setColor("Red")
      .setDescription(text);

  if (command === "rchannel") {
    data[message.guild.id].notifyChannel = null;
    saveData(data);
    return message.reply({ embeds: [embed("❌ تم حذف روم الإشعارات")] });
  }

  if (command === "ytadd") {
    if (!args[0]) return message.reply({ embeds: [embed("❌ حط ID القناة")] });

    data[message.guild.id].youtubeChannels.push(args[0]);
    data[message.guild.id].lastVideos[args[0]] = "WAIT";
    saveData(data);

    return message.reply({ embeds: [embed("✅ تم إضافة القناة")] });
  }

  if (command === "ytremove") {
    if (!args[0])
      return message.reply({
        embeds: [embed("❌ يجب أن تضع ID القناة\nمثال:\n`!ytremove UCxxxx`")]
      });

    data[message.guild.id].youtubeChannels =
      data[message.guild.id].youtubeChannels.filter((c) => c !== args[0]);

    delete data[message.guild.id].lastVideos[args[0]];
    saveData(data);

    return message.reply({ embeds: [embed("❌ تم حذف القناة")] });
  }

  if (command === "ytlist") {
    const list = data[message.guild.id].youtubeChannels;
    if (!list.length)
      return message.reply({ embeds: [embed("🚫 لا توجد قنوات")] });

    return message.reply({
      embeds: [embed(list.map((c) => `https://youtube.com/channel/${c}`).join("\n"))]
    });
  }

  if (command === "ytclear") {
    data[message.guild.id].youtubeChannels = [];
    data[message.guild.id].lastVideos = {};
    saveData(data);
    return message.reply({ embeds: [embed("🧹 تم حذف كل القنوات")] });
  }

  if (command === "restart") {
    await message.reply({ embeds: [embed("♻️ جاري إعادة التشغيل...")] });
    process.exit(0);
  }
});

/* ================= YOUTUBE CHECKER ================= */
function startYouTubeChecker() {
  setInterval(async () => {
    const data = loadData();

    for (const guildId in data) {
      const g = data[guildId];
      if (!g.notifyChannel) continue;

      for (const channelId of g.youtubeChannels) {
        try {
          const feed = await parser.parseURL(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
          );

          const latest = feed.items[0];
          if (!latest) continue;

          if (g.lastVideos[channelId] === "WAIT") {
            g.lastVideos[channelId] = latest.id;
            saveData(data);
            continue;
          }

          if (g.lastVideos[channelId] === latest.id) continue;

          g.lastVideos[channelId] = latest.id;
          saveData(data);

          const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("New Video 🔥")
            .setDescription(latest.title)
            .setURL(latest.link)
            .setThumbnail(feed.image.url);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Subscribe")
              .setStyle(ButtonStyle.Link)
              .setURL(latest.link),
            new ButtonBuilder()
              .setLabel("Channel")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://youtube.com/channel/${channelId}`)
          );

          const ch = await client.channels.fetch(g.notifyChannel);
          ch.send({ embeds: [embed], components: [row] });
        } catch (e) {
          console.log("YT ERROR:", e.message);
        }
      }
    }
  }, 60000);
}

client.login(process.env.TOKEN);
