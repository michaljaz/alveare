const colors = require('colors') // eslint-disable-line no-unused-vars
const moment = require('moment')
const { logo, welcomeText } = require('../other/text')
const NetcatServer = require('netcat/server')
const HiveInterface = require('./hive')

const welcomeMsg = `${logo}\n${welcomeText}`.yellow

function start ({ BEE_HOST, BEE_PORT, QUEEN_HOST, QUEEN_PORT }) {
  console.log(logo.yellow, `\nAlveare started on port ${QUEEN_PORT}, waiting for bees on port ${BEE_PORT}`.cyan)

  // BEE HIVE
  const hive = new NetcatServer()
  hive.k().address(BEE_HOST).port(BEE_PORT).listen().on('connection', (bee) => {
    bee.once('data',(chunk)=>{
      bee.username=chunk.toString().substring(0,chunk.toString().length-1)
    })
    bee.write('whoami\n')
  })

  // QUEEN BEE
  const queenLoft = new NetcatServer()
  queenLoft.k().address(QUEEN_HOST).port(QUEEN_PORT).listen().on('connection', (queenBee) => { // admin socket
    const now = moment().format('MMM Do YYYY, HH:mm:ss')
    console.log(`[${now}] A queen bee just entered the Hive`.yellow)
    const cli = new HiveInterface({ welcomeMsg, hive, socket: queenBee })
    cli.start()
  }).on('clientClose', (queenBee) => {
    const now = moment().format('MMM Do YYYY, HH:mm:ss')
    console.log(`[${now}] A queen bee`, 'quit'.red)
  })
}

module.exports = {
  start
}
