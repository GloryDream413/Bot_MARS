import { createRequire } from 'module'
import axios from 'axios'
const require = createRequire(import.meta.url)
const TelegramBot = require('node-telegram-bot-api')
const dotenv = require('dotenv')

const userMessageTime = new Map()

dotenv.config()
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })
let lastMessageTime = 0
async function createPrediction (text) {
  const response = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version:
        '09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65',
      input: { prompt: text }
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const prediction = response.data
  return prediction
} 

async function getPredictionStatus (id) {
  const response = await axios.get(
    'https://api.replicate.com/v1/predictions/' + id,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
      }
    }
  )

  const prediction = response.data
  console.log(response)
  return prediction
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const pending = async (sentMessage, chatId, username) => {
  let index = 59
  while (index > 0) {
    index--
    await sleep(1000)
    bot.editMessageText(
      '@' +
        username +
        " You're in cooldown mode please wait " +
        index +
        ' seconds.',
      {
        chat_id: chatId,
        message_id: sentMessage.message_id
      }
    )
  }
}

bot.onText(/\/imagine (.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const username = msg.from.username
  const now = Date.now()

  if (userMessageTime.has(chatId)) {
    lastMessageTime = userMessageTime.get(chatId)
    const timeDifference = now - lastMessageTime
    lastMessageTime = now

    if (timeDifference < 15 * 1000) {
      bot
        .sendMessage(
          chatId,
          '@' +
            username +
            " You're in cooldown mode please wait 14 seconds."
        )
        .then(sentMessage => {
          pending(sentMessage, chatId, username)
        })
      return
    }
  }

  // Update the last message time for this user
  userMessageTime.set(chatId, now)
  bot.sendMessage(
    chatId, "Generating Image for @" + username
  )
  //"Generating Image for @" + username
  //"I hope to discuss in telegram with you. My telegram id is GloryDream413."
  // const image = await generateImage(match[1]);
  const prediction = await createPrediction(match[1])
  let response = null
  let nCount = 0;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    await sleep(1000);
    nCount++;
    if(nCount >= 60)
    {
      break;
    }
    response = await getPredictionStatus(prediction.id)
    if (response.err || response.output) {
      break
    }
  }
  if (response.output) {
    bot.sendPhoto(chatId, response.output[response.output.length - 1], {
      caption: 'Generated for @' + username + ': ' + match[1],
      reply_to_message_id: msg.message_id
    })
    console.log('Generated for @' + username)
  } else {
    bot.sendMessage(chatId, 'Sorry. could you again please.');
  }
})

if(bot.isPolling()) {
  await bot.stopPolling();
}
await bot.startPolling();