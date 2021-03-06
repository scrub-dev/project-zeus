import * as Discord from 'discord.js'
import Classifier from './Utils/classifier.js'
import config from './Utils/config.js'
import MessageHandler from './Utils/messagehandler.js'
import 'dotenv/config'
import CommandHandler from './Utils/commandhandler.js'
import DatabaseAbstraction from './Utils/databaseabstraction.js'
import figlet from 'figlet'
import PermissionManager from './Utils/permissionamanger.js'
import ActionManager from './Utils/actionmanager.js'
import BypassManager from './Utils/bypassmanager.js'
import PresenceManager from './Utils/presencemanager.js'

MessageHandler.log('console', figlet.textSync(config.BOTNAME) + ` v${config.VERSION}`)
if (config.DEV_MODE) MessageHandler.log('console', '[ DEV ] Dev Mode Enabled')

const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
  ]
})

client.login(process.env.TOKEN)

const PREFIX = config.PREFIX

const dba = new DatabaseAbstraction()
const classifier = new Classifier(dba.getClassifierThreshold())
const cmdHandler = new CommandHandler()
const permManager = new PermissionManager(dba)
const actionManager = new ActionManager(dba)
const bypassManager = new BypassManager(dba)
const presenceManager = new PresenceManager(dba, client)
/**
 * Client Ready Event Listener
 */
client.on('ready', () => {
  cmdHandler.loadCommands()
  client.user.setPresence({ activities: [presenceManager.getRandom()] })
  MessageHandler.log('console', `[ BOT ] ${client.user.username}#${client.user.discriminator} is online!`)
  dba.logSystemMessage('STARTUP', 'Bot started')
  presenceManager.changeOnInterval(1000 * 60 * 15)
})

/**
 * Client messageCreate Event Listener
 * Triggers on every message sent.
 * Depending on if the message contains the prefix the bot will either handle the command or run the message through its classifier
 */
client.on('messageCreate', async message => {
  if (!config.ALLOWED_CHANNELS.includes(message.channel.id)) return

  if (message.author.bot) return

  dba.incrementCount('messages_checked')

  if (message.content.startsWith(PREFIX)) {
    // Command Handler
    const args = message.content.slice(PREFIX.length).trim().split(/ +/)
    const cmd = args[0]

    const params = {
      client: client,
      message: message,
      args: args,
      dba: dba,
      pm: permManager,
      ch: cmdHandler,
      am: actionManager,
      bm: bypassManager,
      classifier: classifier
    }
    cmdHandler.getCommand(cmd)?.execute(params)
    dba.incrementCount('messages_command')
    dba.logSystemMessage('COMMAND', `${message.author.username}#${message.author.discriminator} ran ${cmd} with ${args.slice(1, args.length)}`)
  } else {
    if (bypassManager.checkBypasses(message)) return

    const res = await classifier.classifyMessage(message.content)
    if (!res.flagged) return

    dba.incrementCount('messages_flagged')
    dba.logUserMessage(message.content, message.author.id, message.createdAt.toISOString())
    const params = {
      client: client,
      message: message,
      dba: dba,
      pm: permManager,
      ch: cmdHandler,
      am: actionManager,
      res: res
    }
    actionManager.respond(params)
  }
})
