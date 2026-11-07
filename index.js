
require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const readline = require("readline");
const path = require("path");

const OWNER = "254759386439";
const SESSION_PATH = path.join(__dirname, "session");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = question =>
  new Promise(resolve => rl.question(question, resolve));

const startedAt = Date.now();
const antiLinkGroups = new Set();
const warnings = new Map();

let pairingRequested = false;
let reconnecting = false;

const jokes = [
  "Why did the computer go to the doctor? It had a virus! 😂",
  "Why was the phone wearing glasses? It lost its contacts! 🤣",
  "Why did the programmer quit? Because they didn't get arrays! 😂",
  "I told my computer I needed a break. It said no problem — it went to sleep. 😂"
];

const facts = [
  "Octopuses have three hearts.",
  "Honey can remain edible for thousands of years when properly stored.",
  "A group of flamingos is called a flamboyance.",
  "Bananas are berries, botanically speaking."
];

const quotes = [
  "Great things take time. Keep building. 💜",
  "Your future is created by what you do today.",
  "Dream big. Work hard. Stay consistent. 🔥",
  "Never stop learning. Never stop improving."
];

const riddles = [
  "What has keys but cannot open locks? A piano.",
  "What gets wetter as it dries? A towel.",
  "What has a face and two hands but no arms or legs? A clock."
];

const answers = [
  "Definitely! 🎱",
  "Maybe...",
  "Ask again later.",
  "Not likely.",
  "Absolutely yes!"
];

function normalizeNumber(input) {
  let number = String(input || "").replace(/\D/g, "");

  if (number.startsWith("0")) {
    number = "254" + number.slice(1);
  } else if (number.startsWith("7") || number.startsWith("1")) {
    number = "254" + number;
  }

  return /^254\d{9}$/.test(number) ? number : null;
}

function getText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  ).trim();
}

function getMentions(message) {
  return message?.extendedTextMessage?.contextInfo
    ?.mentionedJid || [];
}

function getUptime() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function menu() {
  return `╭━━━〔 💜 VONQUISH MD V4 〕━━━╮

👑 GENERAL
.menu
.help
.alive
.ping
.owner
.info
.uptime

🤖 AI
.ai <question>
.chat <question>
.translate <language> <text>
.define <word>
.summarize <text>

👥 GROUP MANAGEMENT
.groupinfo
.admins
.tagall
.hidetag
.kick @user
.add 254XXXXXXXXX
.promote @user
.demote @user
.mute
.unmute
.leave
.antilink on/off
.warn @user
.warnings @user

🎉 ENTERTAINMENT
.joke
.fact
.quote
.8ball <question>
.riddle
.meme

🛠️ UTILITIES
.time
.date
.calc 10+5
.weather <city>
.qr <text>
.poll <question> | option1 | option2

🎨 MEDIA
.sticker (reply to image)
.toimg (reply to sticker)
.tourl (reply to media)
.enhance (reply to image)
.tts <text>

╰━━━━━━━━━━━━━━━━━━━━━━━━╯
💜 POWERED BY VONQUISH MD`;
}

// A small safe calculator for basic arithmetic.
function calculate(expression) {
  const input = expression.replace(/\s/g, "");

  if (!input || !/^[0-9+\-*/().%]+$/.test(input)) {
    throw new Error("Invalid expression");
  }

  let position = 0;

  function parseExpression() {
    let value = parseTerm();

    while (input[position] === "+" || input[position] === "-") {
      const operator = input[position++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parseFactor();

    while (
      input[position] === "*" ||
      input[position] === "/" ||
      input[position] === "%"
    ) {
      const operator = input[position++];
      const right = parseFactor();

      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("Cannot divide by zero");
      }

      if (operator === "*") value *= right;
      if (operator === "/") value /= right;
      if (operator === "%") value %= right;
    }

    return value;
  }

  function parseFactor() {
    if (input[position] === "+") {
      position++;
      return parseFactor();
    }

    if (input[position] === "-") {
      position++;
      return -parseFactor();
    }

    if (input[position] === "(") {
      position++;
      const value = parseExpression();

      if (input[position] !== ")") {
        throw new Error("Missing closing bracket");
      }

      position++;
      return value;
    }

    const start = position;

    while (
      position < input.length &&
      /[0-9.]/.test(input[position])
    ) {
      position++;
    }

    if (start === position) {
      throw new Error("Invalid number");
    }

    const value = Number(input.slice(start, position));

    if (!Number.isFinite(value)) {
      throw new Error("Invalid number");
    }

    return value;
  }

  const result = parseExpression();

  if (position !== input.length || !Number.isFinite(result)) {
    throw new Error("Invalid calculation");
  }

  return result;
}

async function askAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    return "🤖 AI is not configured yet. Add your OPENAI_API_KEY to your private .env file first.";
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are VONQUISH MD, a helpful WhatsApp assistant. Keep answers clear and concise."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "AI service error");
  }

  return data.choices?.[0]?.message?.content ||
    "I couldn't generate a response.";
}

async function getWeather(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather service unavailable");
  }

  const data = await response.json();
  const current = data.current_condition?.[0];

  if (!current) {
    throw new Error("Weather information unavailable");
  }

  return `🌦️ WEATHER: ${city}

🌡️ Temperature: ${current.temp_C}°C
🤔 Feels like: ${current.FeelsLikeC}°C
☁️ Condition: ${current.weatherDesc?.[0]?.value || "Unknown"}
💧 Humidity: ${current.humidity}%
💨 Wind: ${current.windspeedKmph} km/h`;
}

async function translateText(language, text) {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=en|${encodeURIComponent(language)}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.responseStatus !== 200) {
    throw new Error("Translation failed");
  }

  return data.responseData.translatedText;
}

async function defineWord(word) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );

  if (!response.ok) {
    throw new Error("Word not found");
  }

  const data = await response.json();
  const meaning = data[0]?.meanings?.[0];

  return `📖 ${word.toUpperCase()}

${meaning?.partOfSpeech || ""}
${meaning?.definitions?.[0]?.definition || "No definition found."}`;
}

function makeMenuMessage() {
  return menu();
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState(SESSION_PATH);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async update => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("💜 VONQUISH MD V4 IS ONLINE!");
      pairingRequested = false;
      reconnecting = false;
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code === DisconnectReason.loggedOut) {
        console.log("❌ WhatsApp logged out. Pair the account again.");
        return;
      }

      if (!reconnecting) {
        reconnecting = true;
        console.log("⚠️ Connection lost. Retrying in 5 seconds.");

        setTimeout(() => {
          startBot().catch(console.error);
        }, 5000);
      }
    }

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        const input = await ask(
          "\nEnter your Kenyan WhatsApp number: "
        );

        const number = normalizeNumber(input);

        if (!number) {
          console.log("❌ Invalid number. Example: 254759123456");
          pairingRequested = false;
          return;
        }

        const code = await sock.requestPairingCode(number);

        console.log("\n💜 YOUR PAIRING CODE:");
        console.log(code);
        console.log(
          "\nWhatsApp > Linked Devices > Link a Device > Link with phone number."
        );
        console.log("Never share your pairing code with anyone.");
      } catch (error) {
        pairingRequested = false;
        console.log("❌ Pairing failed:", error.message);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;

      if (!from || from === "status@broadcast") continue;

      const text = getText(msg.message);
      if (!text) continue;

      const parts = text.trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      const mentions = getMentions(msg.message);

      const isGroup = from.endsWith("@g.us");
      const sender = msg.key.participant || from;
      const isOwner = sender.split("@")[0].split(":")[0] === OWNER;

      const reply = async message =>
        sock.sendMessage(from, { text: String(message) }, { quoted: msg });

      const getMetadata = async () => {
        if (!isGroup) return null;
        return sock.groupMetadata(from);
      };

      const isAdmin = async () => {
        const metadata = await getMetadata();
        if (!metadata) return false;

        const person = metadata.participants.find(
          p => p.id === sender
        );

        return person?.admin === "admin" ||
          person?.admin === "superadmin";
      };

      const botIsAdmin = async () => {
        const metadata = await getMetadata();
        if (!metadata) return false;

        const botId = sock.user.id.split(":")[0];

        const bot = metadata.participants.find(
          p => p.id.split(":")[0] === botId
        );

        return bot?.admin === "admin" ||
          bot?.admin === "superadmin";
      };

      const requireGroup = async () => {
        if (!isGroup) {
          await reply("❌ This command only works in groups.");
          return false;
        }
        return true;
      };

      const requireAdmin = async () => {
        if (!(await requireGroup())) return false;

        if (!(await isAdmin())) {
          await reply("❌ Only group admins can use this command.");
          return false;
        }

        return true;
      };

      const requireBotAdmin = async () => {
        if (!(await botIsAdmin())) {
          await reply("❌ Make VONQUISH MD a group admin first.");
          return false;
        }

        return true;
      };

      try {
        // ANTI-LINK
        if (
          isGroup &&
          antiLinkGroups.has(from) &&
          /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text)
        ) {
          if (await isAdmin()) continue;

          if (await botIsAdmin()) {
            await sock.sendMessage(from, { delete: msg.key });
            await reply("⚠️ Group links are not allowed.");
          }

          continue;
        }

        switch (command) {
          // GENERAL
          case ".menu":
          case ".help":
            await reply(makeMenuMessage());
            break;

          case ".alive":
            await reply("💜 VONQUISH MD V4 IS ALIVE!\nStatus: Online");
            break;

          case ".ping":
            await reply("🏓 PONG! VONQUISH MD is responding.");
            break;

          case ".owner":
            await reply(`👑 BOT OWNER\nhttps://wa.me/${OWNER}`);
            break;

          case ".info":
            await reply("💜 VONQUISH MD V4\nBuilt with Node.js and Baileys.");
            break;

          case ".uptime":
            await reply(`⏱️ Uptime: ${getUptime()}`);
            break;

          // AI
          case ".ai":
          case ".chat":
            if (!args.length) {
              await reply(`Usage: ${command} ask me something`);
              break;
            }
            await reply("🤖 Thinking...");
            await reply(await askAI(args.join(" ")));
            break;

          case ".summarize":
            if (!args.length) {
              await reply("Usage: .summarize paste your text");
              break;
            }
            await reply(await askAI(
              `Summarize this text clearly and briefly:\n${args.join(" ")}`
            ));
            break;

          case ".translate": {
            if (args.length < 2) {
              await reply("Usage: .translate sw your text here");
              break;
            }

            const language = args.shift();
            const translated = await translateText(language, args.join(" "));
            await reply(`🌍 Translation:\n${translated}`);
            break;
          }

          case ".define":
            if (!args[0]) {
              await reply("Usage: .define computer");
              break;
            }
            await reply(await defineWord(args[0]));
            break;

          // GROUP INFORMATION
          case ".groupinfo": {
            if (!(await requireGroup())) break;

            const metadata = await getMetadata();
            const admins = metadata.participants.filter(p => p.admin).length;

            await reply(
              `👥 GROUP INFORMATION\n\n` +
              `Name: ${metadata.subject}\n` +
              `Members: ${metadata.participants.length}\n` +
              `Admins: ${admins}\n` +
              `Description: ${metadata.desc || "No description"}`
            );
            break;
          }

          case ".admins": {
            if (!(await requireGroup())) break;

            const metadata = await getMetadata();
            const admins = metadata.participants.filter(p => p.admin);

            await sock.sendMessage(from, {
              text: "👑 GROUP ADMINS\n\n" +
                admins.map((p, i) => `${i + 1}. @${p.id.split("@")[0]}`).join("\n"),
              mentions: admins.map(p => p.id)
            }, { quoted: msg });
            break;
          }

          case ".tagall":
          case ".hidetag": {
            if (!(await requireAdmin())) break;

            const metadata = await getMetadata();
            const members = metadata.participants.map(p => p.id);

            await sock.sendMessage(from, {
              text: args.join(" ") || "📢 Attention everyone!",
              mentions: members
            }, { quoted: msg });
            break;
          }

          // MEMBER MANAGEMENT
          case ".kick":
          case ".promote":
          case ".demote": {
            if (!(await requireAdmin())) break;
            if (!(await requireBotAdmin())) break;

            if (!mentions.length) {
              await reply(`Tag the member you want to ${command.slice(1)}.`);
              break;
            }

            const action = command === ".kick"
              ? "remove"
              : command.slice(1);

            await sock.groupParticipantsUpdate(from, mentions, action);
            await reply(`✅ ${command.slice(1)} request completed.`);
            break;
          }

          case ".add": {
            if (!(await requireAdmin())) break;
            if (!(await requireBotAdmin())) break;

            const number = normalizeNumber(args[0]);

            if (!number) {
              await reply("Usage: .add 2547XXXXXXXX");
              break;
            }

            await sock.groupParticipantsUpdate(
              from,
              [`${number}@s.whatsapp.net`],
              "add"
            );

            await reply("✅ Add request sent. WhatsApp may require an invitation.");
            break;
          }

          case ".mute":
          case ".unmute": {
            if (!(await requireAdmin())) break;
            if (!(await requireBotAdmin())) break;

            const setting = command === ".mute"
              ? "announcement"
              : "not_announcement";

            await sock.groupSettingUpdate(from, setting);

            await reply(
              command === ".mute"
                ? "🔇 Group muted. Only admins can send messages."
                : "🔊 Group unmuted. Members can send messages."
            );
            break;
          }

          case ".leave": {
            if (!isGroup) {
              await reply("This command only works in groups.");
              break;
            }

            if (!isOwner) {
              await reply("❌ Only the bot owner can use this command.");
              break;
            }

            await reply("👋 VONQUISH MD is leaving this group.");
            await sock.groupLeave(from);
            break;
          }

          // ANTI-LINK
          case ".antilink": {
            if (!(await requireAdmin())) break;

            if (args[0] === "on") {
              antiLinkGroups.add(from);
              await reply("🔒 Anti-link enabled for this session.");
            } else if (args[0] === "off") {
              antiLinkGroups.delete(from);
              await reply("🔓 Anti-link disabled.");
            } else {
              await reply("Usage: .antilink on or .antilink off");
            }
            break;
          }

          // WARNINGS
          case ".warn": {
            if (!(await requireAdmin())) break;

            if (!mentions.length) {
              await reply("Tag the member you want to warn.");
              break;
            }

            const id = `${from}:${mentions[0]}`;
            const count = (warnings.get(id) || 0) + 1;
            warnings.set(id, count);

            await reply(`⚠️ Member warned. Total warnings: ${count}`);
            break;
          }

          case ".warnings": {
            if (!(await requireGroup())) break;

            if (!mentions.length) {
              await reply("Tag a member to check their warnings.");
              break;
            }

            const count = warnings.get(`${from}:${mentions[0]}`) || 0;
            await reply(`⚠️ Warnings: ${count}`);
            break;
          }

          // ENTERTAINMENT
          case ".joke":
            await reply(pick(jokes));
            break;

          case ".fact":
            await reply(pick(facts));
            break;

          case ".quote":
            await reply(pick(quotes));
            break;

          case ".riddle":
            await reply(pick(riddles));
            break;

          case ".8ball":
            await reply("🎱 " + pick(answers));
            break;

          case ".meme":
            await reply("😂 Meme time! Why do programmers prefer dark mode? Because light attracts bugs!");
            break;

          // UTILITIES
          case ".time":
            await reply(`🕒 ${new Date().toLocaleTimeString()}`);
            break;

          case ".date":
            await reply(`📅 ${new Date().toLocaleDateString()}`);
            break;

          case ".calc":
            try {
              await reply(`🧮 Result: ${calculate(args.join(""))}`);
            } catch {
              await reply("❌ Invalid calculation. Example: .calc (10+5)*2");
            }
            break;

          case ".weather":
            if (!args.length) {
              await reply("Usage: .weather Nairobi");
              break;
            }
            await reply(await getWeather(args.join(" ")));
            break;

          case ".qr": {
            if (!args.length) {
              await reply("Usage: .qr your text or link");
              break;
            }

            const qrUrl =
              "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
              encodeURIComponent(args.join(" "));

            await sock.sendMessage(from, {
              image: { url: qrUrl },
              caption: "💜 Your VONQUISH MD QR code"
            }, { quoted: msg });
            break;
          }

          case ".poll": {
            const pollParts = args.join(" ").split("|").map(s => s.trim());

            if (pollParts.length < 3 || !pollParts[0]) {
              await reply("Usage: .poll Favourite colour? | Blue | Red");
              break;
            }

            const question = pollParts[0];
            const options = pollParts.slice(1).filter(Boolean);

            if (options.length < 2 || options.length > 12) {
              await reply("A poll needs between 2 and 12 options.");
              break;
            }

            await sock.sendMessage(from, {
              poll: {
                name: question,
                values: options,
                selectableCount: 1
              }
            });
            break;
          }

          // MEDIA COMMANDS - integrations to be added next
          case ".sticker":
          case ".toimg":
          case ".tourl":
          case ".enhance":
          case ".tts":
            await reply(
              `🎨 ${command} is planned for the next media upgrade. ` +
              "It needs additional media processing or upload services."
            );
            break;

          default:
            break;
        }
      } catch (error) {
        console.log("Command error:", error.message);
        await reply("❌ Something went wrong. Please try again.");
      }
    }
  });
}

console.log("╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
console.log("┃      💜 VONQUISH MD      ┃");
console.log("┃        VERSION 4.0       ┃");
console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯");

startBot().catch(error => {
  console.error("Bot startup error:", error);
  process.exitCode = 1;
});
