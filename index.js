const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.MED_BOT_TOKEN)

users = {}

class User {
    constructor(id, timezone=0){
        this.id = id
        this.timezone = (timezone-new Date().getTimezoneOffset()/-60) % 12
        this.force = true
        this.meds = {}
    }
    switchForce(){
        this.force = !this.force
    }
    setTimezone(timezone){
        this.timezone = (timezone-new Date().getTimezoneOffset()/-60) % 12
    }
    addReminder(time){
        if(!this.meds.hasOwnProperty(time))
            this.meds[time] = 0
    }
    updateReminder(time){
        if(this.meds.hasOwnProperty(time))
            this.meds[time] = new Date().getTime()
    }
    forgetReminder(time){
        if(this.meds.hasOwnProperty(time))
            delete this.meds[time]
    }
    reminderList(){
        return Object.keys(this.meds).join(', ')
    }
}

function alertUsers(){
    const now = new Date()
    const hour = now.getHours()
    const min = now.getMinutes()
    Object.keys(users).forEach(user => {
        u = users[user]
        const diff = Math.sign(u.timezone)*Math.floor(Math.abs(u.timezone*60))
        let nmin = (min+diff) % 60
        if(nmin < 0)
            nmin = 60-nmin
        let nhour = (Math.sign(u.timezone)*Math.ceil(Math.abs((min+diff)/60))+hour) % 24
        nmin = '0'.repeat(2-nmin.toString().length)+nmin
        nhour = '0'.repeat(2-nhour.toString().length)+nhour
        Object.keys(u.meds).forEach(med => {
            if(!u.force){
                if(med == nhour+':'+nmin){
                    bot.telegram.sendMessage(user, 'Please take your meds!')
                    u.meds[med] = now.getTime()
                }
            }else{
                mins = med.split(':')[1]
                if(mins == nmin && (now.getTime() - u.meds[med]) >= 3600000)
                    bot.telegram.sendMessage(user, 'Please take your meds!\n\nSay /took '+med+' or I\'ll keep reminding you about it every hour.')
            }
        })
    });
}

function isTime(text){
    if(text.length != 5)
        return false
    time = text.split(':')
    if(time.length != 2)
        return false
    if(isNaN(time[0]) || isNaN(time[1]))
        return false
    if(parseInt(time[0]) >= 24 || parseInt(time[0]) < 0)
        return false
    if(parseInt(time[1]) >= 60 || parseInt(time[1]) < 0)
        return false
    return true
}

function registered(id, callback1, callback2=null){
    if(users.hasOwnProperty(id))
        callback1()
    else
        if(!callback2)
            bot.telegram.sendMessage(id, 'Please set your timezone first by using /tz <Your UTC offset>')
        else
            callback2()
}

function getArguments(text){
    regexResult = /\/(.*?) (.*)/s.exec(text)
    if(regexResult)
        return (regexResult[2]).split(' ')
    else
        return []
}

bot.use((ctx, next) => {
    ctx.args = getArguments(ctx.message.text)
    next()
})

bot.command('tz', ctx => {
    if(ctx.args.length !== 1)
        ctx.reply('Usage: /tz <Your UTC offset>\nExample: /tz -6')
    else{
        if(isNaN(ctx.args[0]))
            ctx.reply('Wrong offset')
        registered(ctx.message.from.id, () => {
            users[ctx.message.from.id].setTimezone(ctx.args[0])
        }, () => {
            users[ctx.message.from.id] = new User(ctx.message.from.id, parseInt(ctx.args[0]))
        })
        ctx.reply('Success!')
    }
})

bot.command('force', ctx => {
    registered(ctx.message.from.id, () => {
        users[ctx.message.from.id].switchForce()
        ctx.reply('Force set to '+users[ctx.message.from.id].force)
    })
})

bot.command('/remind', ctx => {
    if(ctx.args.length !== 1)
        ctx.reply('Usage: /remind <time>\nExample: /remind 14:04')
    else if(!isTime(ctx.args[0]))
        ctx.reply('Incorrect time format.\nTime format is hour:minute (military)')
    else
        registered(ctx.message.from.id, () => {
            users[ctx.message.from.id].addReminder(ctx.args[0])
            ctx.reply('OK!')
        })
})

bot.command('forget', ctx => {
    if(ctx.args.length !== 1)
        ctx.reply('Usage: /forget <time>\nExample: /forget 14:04')
    else if(!isTime(ctx.args[0]))
        ctx.reply('Incorrect time format.\nTime format is hour:minute (military)')
    else
        registered(ctx.message.from.id, () => {
            users[ctx.message.from.id].forgetReminder(ctx.args[0])
            ctx.reply('OK!')
        })
})

bot.command('list', ctx => {
    registered(ctx.message.from.id, () => {
        ctx.reply(users[ctx.message.from.id].reminderList())
    })
})

bot.command('took', ctx => {
    if(ctx.args.length !== 1)
        ctx.reply('Usage: /took <time>\nExample: /took 14:04')
    else if(!isTime(ctx.args[0]))
        ctx.reply('Incorrect time format.\nTime format is hour:minute (military)')
    else
        registered(ctx.message.from.id, () => {
            users[ctx.message.from.id].updateReminder(ctx.args[0])
            ctx.reply('OK!')
        })
})

setInterval(alertUsers, 60000)
bot.launch()