const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

let pairingInProgress = false;
let lastRequest = 0;
let socket = null;

app.post("/api/pair", async (req, res) => {
  if (pairingInProgress) {
    return res.status(409).json({
      error: "A pairing request is already running."
    });
  }

  const phone = String(req.body.phone || "").replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({
      error: "Enter a valid number with country code."
    });
  }

  if (Date.now() - lastRequest < 60000) {
    return res.status(429).json({
      error: "Please wait one minute before trying again."
    });
  }

  pairingInProgress = true;
  lastRequest = Date.now();

  try {
    const sessionPath = path.join(
      __dirname,
      "sessions",
      "local-test"
    );

    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(sessionPath);

    if (state.creds.registered) {
      return res.status(409).json({
        error: "A WhatsApp account is already linked to this test server."
      });
    }

    socket = makeWASocket({ auth: state });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", ({ connection }) => {
      if (connection === "open") {
        console.log("💜 VONQUISH MD connected!");
      }

      if (connection === "close") {
        console.log("WhatsApp connection closed.");
        socket = null;
      }
    });

    const code = await socket.requestPairingCode(phone);

    res.json({
      success: true,
      pairingCode: code,
      instructions:
        "Open WhatsApp > Linked Devices > Link a Device > Link with phone number instead."
    });

  } catch (error) {
    console.error("Pairing error:", error.message);

    res.status(500).json({
      error: "Could not generate a pairing code. Please try again."
    });

  } finally {
    pairingInProgress = false;
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "VONQUISH MD is running"
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `💜 VONQUISH MD website: http://localhost:${PORT}`
  );
});