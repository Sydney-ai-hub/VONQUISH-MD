
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const readline = require("readline");

const OWNER = "+254759386439";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("💜 VONQUISH MD IS ONLINE!");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code === DisconnectReason.loggedOut) {
        console.log("WhatsApp session logged out.");
      } else {
        console.log("Connection closed. Restart the bot to reconnect.");
      }
    }
  });

  if (!state.creds.registered) {
    const number = await ask(
      "Enter your WhatsApp number with country code (without +): "
    );

    if (!/^\d{10,15}$/.test(number.trim())) {
      console.log("Invalid number. Please restart and try again.");
      process.exit(1);
    }

    const pairingCode = await sock.requestPairingCode(number.trim());

    console.log("\n💜 VONQUISH MD PAIRING CODE:");
    console.log(pairingCode);
    console.log("Enter this code in WhatsApp Linked Devices.");
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;

      if (!from || from === "status@broadcast") continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";

      const command = text.trim().toLowerCase();

      let reply = "";

      if (command === ".menu") {
        reply = `💜 VONQUISH MD MENU

.alive - Bot status
.ping - Check speed
.owner - Owner contact
.help - Help

🔥 VONQUISH MD`;
      } else if (command === ".alive") {
        reply = "💜 VONQUISH MD IS ALIVE!";
      } else if (command === ".ping") {
        reply = "🏓 PONG! VONQUISH MD is responding.";
      } else if (command === ".owner") {
        reply = `👑 VONQUISH MD OWNER\nWhatsApp: ${OWNER}`;
      } else if (command === ".help") {
        reply = "Type .menu to see available commands.";
      } else if (["hi", "hello", "hey"].includes(command)) {
        reply = "Hey! 👋 Welcome to VONQUISH MD. Type .menu.";
      }

      if (reply) {
        await sock.sendMessage(from, { text: reply });
      }
    }
  });
}

startBot().catch(console.error);
