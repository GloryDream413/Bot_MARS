import { createRequire } from 'module'
import axios from 'axios'
const require = createRequire(import.meta.url)
const TelegramBot = require('node-telegram-bot-api')
const dotenv = require('dotenv')

const userMessageTime = new Map()
const SEPARATE_STRING = "!@#$%^&*"
dotenv.config()
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })
let lastMessageTime = 0
async function createPrediction(text) {
  const response = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version:
        '9936c2001faa2194a261c01381f90e65261879985476014a0a37a334593a05eb',
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

async function getPredictionStatus(id) {
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

bot.onText(/\/image (.+)/, async (msg, match) => {
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

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Mars', callback_data: `btnMars${SEPARATE_STRING}${match[1]}` }
        ],
        [
          { text: 'Moon', callback_data: `btnMoon${SEPARATE_STRING}${match[1]}`}
        ]
      ]
    }
  };

  // Send a message with inline keyboard
  bot.sendMessage(chatId, 'Pick a Planet to be used for your image generation:', options);

})

// Handle callback queries from inline keyboard buttons
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const queryData = query.data.split(SEPARATE_STRING)
  const buttonPressed = queryData[0];
  const username = query.from.username
  const matchStr = queryData[1]

  let nFlag = 0;

  // Handle different button presses
  switch (buttonPressed) {
    case 'btnMars':
      nFlag = 1;
      bot.sendMessage(chatId, "To generate a great Image for Mars @" + username + " 👀🔥")
      break;
    case 'btnMoon':
      nFlag = 2;
      bot.sendMessage(chatId, "To generate a great Image for Moon @" + username + " 👀🔥")
      break;
  }
  // Answer the callback query to remove the "Loading" status
  bot.answerCallbackQuery(query.id);
  //"Generating Image for @" + username
  //"I hope to discuss in telegram with you. My telegram id is GloryDream413."
  // const image = await generateImage(match[1]);
  let userQuery = '';
  if (nFlag == 1) {
    userQuery = matchStr + ', on the Mars planet, colorful 4k';
  }
  else if (nFlag == 2) {
    userQuery = matchStr + ', on the Moon planet, colorful 4k';
  }


  const prediction = await createPrediction(userQuery);
  let response = null
  let nCount = 0;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    await sleep(1000);
    nCount++;
    if (nCount >= 60) {
      break;
    }
    response = await getPredictionStatus(prediction.id)
    if (response.err || response.output) {
      break
    }
  }
  if (response.output) {
    bot.sendPhoto(chatId, response.output[response.output.length - 1], {
      caption: 'Generation for @' + username + ': ' + matchStr + '\nShare this image on twitter and use $EVERMARS',
      reply_to_message_id: query.message.message_id
    })
    console.log('Generation for @' + username)
  } else {
    bot.sendMessage(chatId, 'Sorry. could you again please.');
  }
});

if (bot.isPolling()) {
  await bot.stopPolling();
}
await bot.startPolling();