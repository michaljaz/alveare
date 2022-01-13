
module.exports = {

  getBeesList: (beesMap) => {
    const result = Object.keys(beesMap).map((id) => {
      const { remoteAddress, remotePort } = beesMap[id]
      return `${id} -> ${remoteAddress}:${remotePort}`
    })
    return result
  },

  getIndexedBeesList: (beesMap) => {
    const result = Object.keys(beesMap).map((id, index) => {
      const { remoteAddress, remotePort, username } = beesMap[id]
      return `${index}) ${username} -> ${remoteAddress}:${remotePort}`
    })
    return result
  },

  getBeeByIndex: (beesMap, index) => {
    return beesMap[Object.keys(beesMap)[index]]
  }

}
