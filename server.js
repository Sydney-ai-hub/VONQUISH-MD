
const readline = require("readline");
const path = require("path");

async function startBot() {
  const baileys = await import("@whiskeysockets/baileys");

  const makeWASocket = baileys.default;
  const { useMultiFileAuthState, DisconnectReason } = baileys;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "session")
  );

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const number = (await ask(
      "Enter your WhatsApp number with country code (digits only): "
    )).replace(/\D/g, "");

    if (!number || number.length < 10) {
      console.log("Invalid phone number. Restart and try again.");
      rl.close();
      return;
    }

    try {
      const code = await sock.requestPairingCode(number);
      console.log("\n================================");
      console.log("YOUR VONQUISH MD PAIRING CODE:");
      console.log(code);
      console.log("================================\n");
      console.log("Open WhatsApp > Linked Devices > Link a Device > Link with phone number.");
      console.log("Enter the pairing code shown above.");
    } catch (error) {
      console.log("Could not generate pairing code:", error.message);
    }
  } else {
    console.log("Saved WhatsApp session found. Reconnecting...");
  }

  rl.close();

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("💜 VONQUISH MD connected to WhatsApp!");
    }

    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;

      if (status === DisconnectReason.loggedOut) {
        console.log("WhatsApp logged out. Pair again to reconnect.");
      } else {
        console.log("Connection closed. Restart the bot to reconnect.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      if (!message.message || message.key.fromMe) continue;

      const jid = message.key.remoteJid;
      if (!jid || jid === "status@broadcast") continue;

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      const command = text.trim().toLowerCase();

      try {
        if (command === ".menu" || command === ".help") {
          await sock.sendMessage(jid, {
            text:
              "💜 VONQUISH MD MENU\n\n" +
              ".menu - Show commands\n" +
              ".alive - Check bot status\n" +
              ".ping - Check response\n" +
              ".owner - Owner information"
          });
        } else if (command === ".alive") {
          await sock.sendMessage(jid, {
            text: "💜 VONQUISH MD is alive and running!"
          });
        } else if (command === ".ping") {
          await sock.sendMessage(jid, {
            text: "🏓 Pong! VONQUISH MD is responding."
          });
        } else if (command === ".owner") {
          await sock.sendMessage(jid, {
            text: "💜 VONQUISH MD owner."
          });
        } else if (["hi", "hello", "hey"].includes(command)) {
          await sock.sendMessage(jid, {
            text: "Hey! 💜 VONQUISH MD is here. Type .menu to see commands."
          });
        }
      } catch (error) {
        console.log("Message error:", error.message);
      }
    }
  });
}

startBot().catch((error) => {
  console.error("Bot startup error:", error);
});
