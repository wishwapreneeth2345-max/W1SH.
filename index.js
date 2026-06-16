const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const readline = require('readline')
const sharp = require('sharp')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['W1SH Bot', 'Chrome', '1.0.0'],
        logger: require('pino')({ level: 'silent' })
    })

    if (!sock.authState.creds.registered) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const phoneNumber = await askQuestion('\nBot එක link කරන WhatsApp number එක +94 format එකෙන් දාපන්: ')
        const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''))
        console.log('\n🔑 Pairing Code:', code?.match(/.{1,4}/g)?.join('-'))
        console.log('WhatsApp > Settings > Linked Devices > Link with Phone Number > මේ code එක දාපන්\n')
        rl.close()
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut
            console.log('Reconnecting...')
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ W1SH Bot Online!')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const sender = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

        if (text.toLowerCase() === 'menu' || text === '.menu') {
            await sock.sendMessage(sender, {
                text: `🌟 W1SH BOT MENU 🌟\n\n📸 sticker - Photo එකට "sticker" දාපන්\n📟 ping - Bot alive ද\nPowered by W1SH ✨`
            })
        }

        if (text.toLowerCase() === 'ping') {
            await sock.sendMessage(sender, { text: '✅ W1SH Bot is alive & kicking!' })
        }

        if (msg.message?.imageMessage && text.toLowerCase() === 'sticker') {
            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {})
                const stickerBuffer = await sharp(buffer).resize(512, 512, { fit: 'contain' }).webp().toBuffer()
                await sock.sendMessage(sender, {
                    sticker: stickerBuffer,
                    packname: 'W1SH Bot',
                    author: 'Wish'
                })
            } catch (e) {
                await sock.sendMessage(sender, { text: 'Error මචං, ආයෙ try කරපන්' })
            }
        }
    })
}

startBot()
