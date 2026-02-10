const fs = require('fs')
const path = require('path')

class MAVLinkRouterConfigGenerator {
  constructor (settings) {
    this.settings = settings
    this.configPath = path.join(__dirname, '../config/mavlink-router-main.conf')
  }

  generateConfig () {
    const fcSettings = this.settings.value('flightcontroller.activeDevice', null)
    const outputs = this.settings.value('flightcontroller.outputs', [])
    const edgeFilters = this.settings.value('EdgeFilters', {})
    const enableTCP = this.settings.value('flightcontroller.enableTCP', false)
    const enableUDPB = this.settings.value('flightcontroller.enableUDPB', true)
    const UDPBPort = this.settings.value('flightcontroller.UDPBPort', 14550)

    let config = '[General]\n'
    config += 'TcpServerPort=' + (enableTCP ? '5760' : '0') + '\n'
    config += 'ReportStats=false\n'
    config += 'MavlinkDialect=auto\n\n'

    // UartEndpoint (Flight Controller)
    if (fcSettings && fcSettings.inputType === 'UART' && fcSettings.serial && fcSettings.baud) {
      config += '[UartEndpoint alpha]\n'
      config += `Device = ${fcSettings.serial}\n`
      config += `Baud = ${fcSettings.baud}\n\n`
    }

    // UdpEndpoint for input (if UDP input is selected)
    if (fcSettings && fcSettings.inputType === 'UDP' && fcSettings.udpInputPort) {
      config += '[UdpEndpoint input]\n'
      config += 'Mode = Server\n'
      config += `Port = ${fcSettings.udpInputPort}\n\n`
    }

    // Internal endpoints for mavManager (always needed)
    config += '[UdpEndpoint internal1]\n'
    config += 'Mode = Normal\n'
    config += 'Address = 127.0.0.1\n'
    config += 'Port = 14540\n\n'

    config += '[UdpEndpoint internal2]\n'
    config += 'Mode = Normal\n'
    config += 'Address = 127.0.0.1\n'
    config += 'Port = 14541\n\n'

    // UDP Broadcast endpoint
    if (enableUDPB) {
      config += '[UdpEndpoint broadcast]\n'
      config += 'Mode = Server\n'
      config += `Port = ${UDPBPort}\n\n`
    }

    // UdpEndpoint / TcpEndpoint (Outputs)
    outputs.forEach((output, index) => {
      const edgeId = `e-hub-output-${index}`
      const filter = edgeFilters[edgeId]
      const protocol = output.protocol || 'udp'
      const mode = output.mode || 'client'

      if (protocol === 'udp') {
        config += `[UdpEndpoint output${index}]\n`
        config += `Mode = ${mode === 'server' ? 'Server' : 'Normal'}\n`
        if (mode === 'client') {
          config += `Address = ${output.IP}\n`
        }
        config += `Port = ${output.port}\n`
      } else if (protocol === 'tcp') {
        config += `[TcpEndpoint output${index}]\n`
        config += `Mode = ${mode === 'server' ? 'Server' : 'Client'}\n`
        if (mode === 'client') {
          config += `Address = ${output.IP}\n`
        }
        config += `Port = ${output.port}\n`
      }

      // Apply filter if exists
      if (filter && filter.blockedMsgIds && filter.blockedMsgIds.length > 0) {
        config += `BlockMsgIdOut = ${filter.blockedMsgIds.join(',')}\n`
      }

      config += '\n'
    })

    return config
  }

  writeConfig () {
    try {
      const config = this.generateConfig()
      // Ensure the config directory exists
      const configDir = path.dirname(this.configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.writeFileSync(this.configPath, config, 'utf8')
      console.log(`Generated mavlink-router config: ${this.configPath}`)
      return this.configPath
    } catch (err) {
      console.error('Failed to write mavlink-router config:', err)
      throw err
    }
  }

  configExists () {
    return fs.existsSync(this.configPath)
  }
}

module.exports = MAVLinkRouterConfigGenerator
