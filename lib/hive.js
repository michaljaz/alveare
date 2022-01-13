const readline = require('readline')
const colors = require('colors') // eslint-disable-line no-unused-vars
const moment = require('moment')
const { welcomeText } = require('../other/text')
const { getIndexedBeesList, getBeeByIndex } = require('./utilities')

const _commands = {
  '.help': 'display this message',
  '.int': 'enable interactive shell',
  '.list': 'list connected bees',
  '.bind <n>': 'bind to a bee and connect to his established socket',
  '.unbind': 'detach the connection from the selected worker bee',
  '.uptime': 'show hive uptime',
  '.credit': 'display info on the project',
  '.quit': 'close your connection',
  '.exit': 'tear down the whole beehive'
}

function defaultCompleter (line) {
  const completions = Object.keys(this.commands)
  const hits = completions.filter(function (c) {
    if (c.indexOf(line) === 0) {
      return c
    }
  })
  return [hits && hits.length ? hits : completions, line]
}

class HiveInterface {
  constructor ({ commands, welcomeMsg, completer, socket, hive, testing, marker } = {}) {
    this.commands = commands || _commands
    this.welcomeMsg = welcomeMsg || welcomeText
    this.completer = completer || defaultCompleter.bind(this)
    this.testing = !!testing
    if (!this.testing && !socket) throw Error('Socket is required!')
    if (!hive) throw Error('Please provide a Hive instance!')
    this.socket = socket
    this.hive = hive
    this.rl = this.testing ? readline.createInterface(process.stdin, process.stdout, this.completer) : readline.createInterface(this.socket, this.socket, this.completer)
    this.marker = marker || '> '
    this.rl.setPrompt(this.marker.grey, this.marker.length)
    this.socket.on('close', () => {
      // queen bee closed
      this.removeSendToListeners()
      this.sendTo = null
    })
  }

  getHelp () {
    const msg = []
    for (const i in this.commands) {
      msg.push(`${i}\t\t${this.commands[i]}`)
    }
    return msg.join('\n').grey
  }

  welcome () {
    this.response(this.welcomeMsg.yellow)
    this.rl.prompt()
  }

  response (out) {
    // HACK: process.stdout.write needs to be bound to the process.stdout object
    const write = this.testing ? process.stdout.write.bind(process.stdout) : this.socket.write
    write(`${out}\n`)
  }

  onData () {
    if (this._onData) return this._onData
    this._onData = function (chunk) {
      this.socket.write(chunk.toString()) // in data
    }
    this._onData = this._onData.bind(this)
    return this._onData
  }

  removeSendToListeners () {
    if (this.sendTo) {
      this.sendTo.removeListener('data', this.onData())
      this.sendTo.removeListener('close', this.onClose())
      this.sendTo.removeListener('end', this.onClose())
    }
  }

  onClose () {
    if (this._onClose) return this._onClose
    this._onClose = function () {
      if (!this.sendTo) return
      this.removeSendToListeners()
      this.rl.setPrompt(this.marker.grey, this.marker.length) // reset marker
      this.socket.write(`[connection closed with ${this.sendTo.id}]\n`.red)
      this.sendTo = null
    }
    this._onClose = this._onClose.bind(this)
    return this._onClose
  }

  exec (command) {
    if (command[0] === '.') {
      const now = moment().format('MMM Do YYYY, HH:mm:ss')
      switch (command.slice(1).split(' ')[0]) {
        case 'help':
          this.response(this.getHelp())
          break
        case 'int':
          if (this.sendTo) {
            this.sendTo.write(`env DISPLAY=:0 bash\n`)
          }
          break
        case 'list': {
          let bees = getIndexedBeesList(this.hive.getClients())
          bees = bees.length ? bees.join('\n').green : 'No bees connected'.grey
          this.response(bees)
          break
        }
        case 'bind': {
          const index = command.slice(1).split(' ')[1]
          if (!index) return this.response('Please provide a Bee ID'.red)
          const targetSocket = getBeeByIndex(this.hive.getClients(), index)
          if (!targetSocket) return this.response(`Cannot find bee with Index ${index}`.red)
          if (this.sendTo) return this.response('Please first .unbind the current connection'.red)
          this.response(`Binding to ${index} on ${targetSocket.remoteAddress}:${targetSocket.remotePort}`.yellow)
          // connecting sockets
          this.sendTo = targetSocket
          this.sendTo.on('data', this.onData())
          this.sendTo.on('close', this.onClose())
          console.log(`[${now}] Queen Bee bound to the bee: ${targetSocket.id}`.yellow)
          const newMarker = `${targetSocket.id} > `.grey
          this.rl.setPrompt(newMarker, newMarker.length)
          break
        }
        case 'unbind':
          if (this.sendTo) {
            this.removeSendToListeners()
            console.log(`[${now}] Queen Bee left bee: ${this.sendTo.id}`.yellow)
            this.sendTo = null
            this.rl.setPrompt(this.marker.grey, this.marker.length) // reset marker
          }
          break
        case 'uptime':
          this.response(moment.duration(process.uptime(), 'seconds').humanize().green)
          break
        case 'credit':
          this.response('Rocco Musolino (@roccomuso) - github.com/roccomuso/alveare'.green)
          break
        case 'quit':
        case 'q':
          this.response('Bye!'.green)
          if (!this.testing) this.socket.destroy() // NB. socket method
          break
        case 'exit':
          this.response('Tearing down the beehive...!'.red)
          process.exit(0)
          break // eslint-disable-line no-unreachable
      }
    } else {
      // only print if they typed something and if not bound to a bee
      if (command !== '' && !this.sendTo) {
        this.response(`"${command}" is not a valid command, sorry`.yellow)
      } else if (this.sendTo) {
        this.sendTo.write(`${command}\n`) // send command to the worker
      }
    }
    this.rl.prompt() // if bee queen socket still opened prompt for next cmd
  }

  start () {
    this.rl.on('line', (cmd) => {
      this.exec(cmd.trim())
    }).on('close', () => {
      // only gets triggered by ^C or ^D
      const now = moment().format('MMM Do YYYY, HH:mm:ss')
      console.log(`[${now}] A queen bee just quit`.red)
      // this.response('goodbye!'.green)
      // process.exit(0)
    })

    this.welcome()
  }
}

module.exports = HiveInterface
