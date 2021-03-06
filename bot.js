const Discord = require('discord.js');
const emoji = require('node-emoji');
const moment = require('moment');
const database = require('./database');
const config = require('./config.json');
const changelog = require('./changelog.json');

const timestamp = () => moment(new Date).format('HH:mm:ss');
const token = process.env.KINGDOMRP_TOKEN;
const bot = new Discord.Client();

bot.on('ready', () => {
  console.log(`${bot.user.username} launched at [${timestamp()}]!`);
  database.init(bot.channels);
  bot.user.setGame(`v${changelog[0].version} | ${config.trigger}help`);
});

bot.on('guildCreate', guild => {
  database.addAllUsers(bot.channels);
});

bot.on('guildMemberAdd', member => {
  database.addUser(member.user.id, member.user.username);
});

bot.setInterval(() => {
  bot.guilds.map(guild => {
    guild.members.map(member => {
      if (!member.user.bot) {
        database.getGold(member.user.id, (err, row) => {
          database.updateGold(member.user.id, row.gold + 1);
        });
      }
    });
  });
}, 600000);

bot.on('message', msg => {

  // #### PUBLIC COMMANDS ####

  // Help command
   if (msg.content === `${config.trigger}help`) {
    msg.reply('I\'m here to help! Here are my commands:\n\n' +
    '`$help` : Show all available commands.\n\n' +
    '`$balance @user` : Show the current balance of the mentionned user.\n\n' +
    '`$give @user [amount]` : Give the amount specified to the mentionned user.\n\n' +
    '`$admin/$admins` : Show the current admins on this server.\n\n' +
    '`$changelog` : Show latest changelog.');
  }

    // Show admins command
  else if (msg.content === `${config.trigger}admin` || msg.content === `${config.trigger}admins`) {
    database.getAdmins((err, row) => {
      let response = 'Here are the admins on this server:\n\n';
      row.map(admin => {
        response += `${admin.username}\n`;
      });
      msg.reply(response);
    });
  }

  // Changelog command
   if (msg.content === `${config.trigger}changelog`) {
    msg.reply(changelog[0].content);
  }

  // Give gold command
  else if (msg.content.startsWith(`${config.trigger}give`)) {

    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {

      if (msg.mentions.users.first().id !== msg.author.id) {

        let match = /\s\d+/.exec(msg.content); // regex: contains a number with whitespace before
        if (match !== null) {

          database.getGold(msg.author.id, (err, row) => {
            if (row.gold >= parseInt(match[0])) {
              database.updateGold(msg.author.id, row.gold - parseInt(match[0]));
              database.getGold(msg.mentions.users.first().id, (err, row) => {
                database.updateGold(msg.mentions.users.first().id, row.gold + parseInt(match[0]));
                msg.reply(`You transferred ${parseInt(match[0])} ${emoji.get('dollar')} to ${msg.mentions.users.first().username} from your account.`);
              });
            }

            else {
              msg.reply(`You don\'t have enough ${emoji.get('dollar')} for this transaction.`);
            }
          });
        }
      }

      else {
        msg.reply('This is not how things work, unfortunately...');
      }
    }
  }

  // Show gold command
  else if (msg.content.startsWith(`${config.trigger}balance`)) {
    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {
      database.getGold(msg.mentions.users.first().id, (err, row) => {
        msg.reply(`${msg.mentions.users.first().username} has ${row.gold} ${emoji.get('dollar')} in his account.`);
      });
    }
    else {
      database.getGold(msg.author.id, (err, row) => {
        msg.reply(`You currently have ${row.gold} ${emoji.get('dollar')} in your account.`);
      });
    }
  }

  // Rank gold command
  else if (msg.content === `${config.trigger}rank money`) {
    database.rankGold((err, row) => {
      let response = `Here is the ${emoji.get('dollar')} ranking:\n\n`;
      row.map(user => {
        response += `${user.username} : ${user.gold} ${emoji.get('dollar')}\n`;
      });
      msg.reply(response);
    });
  }

  // #### ADMIN COMMANDS ####

  // Super-user give: magically give gold to any player
  else if (msg.content.startsWith(`${config.trigger}sugive`)) {
    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {
      let match = /\s\d+/.exec(msg.content); // regex: contains a number with whitespace before
      if (match !== null) {
        database.getPromotion(msg.author.id, (err, row) => {
          if (row.admin === 1 || row.suadmin === 1) {
            database.getGold(msg.mentions.users.first().id, (err, row) => {
              database.updateGold(msg.mentions.users.first().id, row.gold + parseInt(match[0]));
              msg.reply(`You magically transferred ${parseInt(match[0])} ${emoji.get('dollar')} to ${msg.mentions.users.first().username}.`);
            });
          }
        });
      }
    }
  }

  // Reset user: set gold to 0 (eventually reset inventory as well)
  else if (msg.content.startsWith(`${config.trigger}reset`)) {
    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {
      database.getPromotion(msg.author.id, (err, row) => {
        if (row.admin === 1 || row.suadmin === 1) {
          database.updateGold(msg.mentions.users.first().id, 0);
          msg.reply(`You reset ${msg.mentions.users.first().username}. His balance is at 0 ${emoji.get('dollar')}.`);
        }
      });
    }
  }

  // #### SUPER-ADMIN COMMANDS ####

  // Promote user: Add as admin
  else if (msg.content.startsWith(`${config.trigger}promote`)) {
    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {
      database.getPromotion(msg.author.id, (err, row) => {
        if (row.suadmin === 1) {
          database.getPromotion(msg.mentions.users.first().id, (err, row) => {
            if (row.admin === 0) {
              database.promoteUser(msg.mentions.users.first().id, 1);
              msg.reply(`You promoted ${msg.mentions.users.first().username} as admin.`)
            }
            else {
              msg.reply(`${msg.mentions.users.first().username} is already an admin.`)
            }
          });
        }
      });
    }
  }

  // Demote user: Remove from admins
  else if (msg.content.startsWith(`${config.trigger}demote`)) {
    if (msg.mentions.users.first() !== undefined && !msg.mentions.users.first().bot) {
      database.getPromotion(msg.author.id, (err, row) => {
        if (row.suadmin === 1) {
          database.getPromotion(msg.mentions.users.first().id, (err, row) => {
            if (row.admin === 1) {
              database.promoteUser(msg.mentions.users.first().id, 0);
              msg.reply(`You demoted ${msg.mentions.users.first().username}.`)
            }
            else {
              msg.reply(`${msg.mentions.users.first().username} is not an admin.`)
            }
          });
        }
      });
    }
  }
});

bot.login(token);
