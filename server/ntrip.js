// NTRIP Manager
const events = require('events')
const { common } = require('node-mavlink')
const net = require('net')
const tls = require('tls')

// Debug logger - enabled via NTRIP_DEBUG=1 environment variable
// or ntripClient.setDebug(true) at runtime
const _ntripDebugLog = (...args) => {
  const ts = new Date().toISOString()
  console.log(`[NTRIP DEBUG ${ts}]`, ...args)
}

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return fallback
  }
  return parsed
}

const parseBool = (value, fallback = false) => {
  if (value === undefined) {
    return fallback
  }
  return String(value).toLowerCase() === 'true'
}

const NTRIP_PRESETS = {
  custom: {
    id: 'custom',
    name: 'Custom',
    defaultGgaInterval: 60
  },
  docomo: {
    id: 'docomo',
    name: 'NTT docomo',
    defaultGgaInterval: 1,
    fixedHost: process.env.NTRIP_DOCOMO_HOST || 'd-gnss.jp',
    fixedPort: parsePort(process.env.NTRIP_DOCOMO_PORT, 2101),
    fixedUseTls: parseBool(process.env.NTRIP_DOCOMO_USETLS, false)
  },
  ichimill: {
    id: 'ichimill',
    name: 'SoftBank ichimill',
    defaultGgaInterval: 1,
    fixedHost: process.env.NTRIP_ICHIMILL_HOST || 'ntrip.ales-corp.co.jp',
    fixedPort: parsePort(process.env.NTRIP_ICHIMILL_PORT, 2101),
    fixedUseTls: parseBool(process.env.NTRIP_ICHIMILL_USETLS, false)
  }
}

const getPreset = (presetId) => {
  return NTRIP_PRESETS[presetId] || NTRIP_PRESETS.custom
}

const getPresetOptions = () => {
  return Object.keys(NTRIP_PRESETS).map((id) => {
    const preset = NTRIP_PRESETS[id]
    return {
      id: preset.id,
      name: preset.name,
      defaultGgaInterval: preset.defaultGgaInterval,
      fixedHost: preset.fixedHost || '',
      fixedPort: preset.fixedPort,
      fixedUseTls: preset.fixedUseTls || false,
      hostLocked: Boolean(preset.fixedHost),
      portLocked: Boolean(preset.fixedHost),
      useTlsLocked: Boolean(preset.fixedHost)
    }
  })
}

const pad = (n, width, z) => {
  n = n + ''
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
}

/**
 * Get checksum from raw data
 *
 * @param {string} data - raw data
 * @return {string} checksum en hex
 */
const getChecksum = (data) => {
  let checksum
  data = data.toString()
  const idx1 = data.indexOf('$G')
  const idx2 = data.indexOf('*')
  checksum = data
    .slice(idx1 + 1, idx2)
    .split('')
    .reduce((y, x) => y ^ x.charCodeAt(0), 0)
  return checksum
}

const toHexString = (checksum) => {
  const buf = Buffer.allocUnsafe(1)
  buf.fill(checksum)
  return buf.toString('hex')
}

const encodeTime = (time) => {
  const date = new Date(time)

  const hours = pad(date.getUTCHours(), 2, 0)
  const minutes = pad(date.getUTCMinutes(), 2, 0)
  const secs = pad(date.getUTCSeconds(), 2, 0)
  const msecs = pad(date.getUTCMilliseconds(), 3, 0)
  return `${hours}${minutes}${secs}.${msecs}`
}

/**
 * Decimal latitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const latToDmm = (data) => {
  const tmp = data.toString().split('.')
  const deg = pad(Math.abs(tmp[0]), 2, '0')
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6)
  const fixedArr = fixed.toString().split('.')
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1]
  const sign = data < 0 ? 'S' : 'N'
  return `${deg}${mim},${sign}`
}

/**
 * Decimal longitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const lngToDmm = (data) => {
  const tmp = data.toString().split('.')
  const deg = pad(Math.abs(tmp[0]), 3, '0')
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6)
  const fixedArr = fixed.toString().split('.')
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1]
  const sign = data < 0 ? 'W' : 'E'
  return `${deg}${mim},${sign}`
}

/**
 * encode data to GGA
 * @param {*} data
 */
const encodeGGA = (data) => {
  const result = ['$' + data.type]
  result.push(encodeTime(data.datetime))

  result.push(latToDmm(data.loc[0]))
  result.push(lngToDmm(data.loc[1]))
  result.push(data.gpsQuality)
  result.push(pad(data.satellites, 2, 0))
  result.push(data.hdop.toFixed(3))
  result.push(data.altitude)
  result.push(data.altitudeUnit || 'M')
  result.push(data.geoidalSeparation)
  result.push(data.geoidalSeparationUnit || 'M')

  // Keep trailing fields for GGA structure even when empty.
  // SoftBank ichimill validated output is:
  // ...,alt,M,0.0,M,,*CS
  if (data.ageGpsData !== undefined) {
    result.push(
      data.ageGpsData === '' || data.ageGpsData === null
        ? ''
        : (data.ageGpsData.toFixed ? data.ageGpsData.toFixed(3) : data.ageGpsData)
    )
  }

  if (data.refStationId !== undefined) {
    result.push(
      data.refStationId === '' || data.refStationId === null
        ? ''
        : pad(parseInt(data.refStationId), 4, 0)
    )
  }

  const resultMsg = result.join(',') + '*'
  return resultMsg + toHexString(getChecksum(resultMsg)).toUpperCase()
}

class NtripClientWrapper extends events.EventEmitter {
  constructor(options, debugLog, initialGpsState = null) {
    super()
    this.options = options
    this.client = null
    this.ggaInterval = null
    this.loc = [0, 0]
    this.alt = 0
    this.satellites = 0
    this.hdop = 0
    this.fixType = 0
    this.status = 'Offline'
    this.initialGgaSent = false
    this.handshakeComplete = false
    this._debug = debugLog || (() => {})

    if (initialGpsState) {
      this.applyGpsState(initialGpsState)
    }
  }

  applyGpsState(gpsState) {
    if (!gpsState) {
      return
    }
    if (Array.isArray(gpsState.loc) && gpsState.loc.length === 2) {
      this.loc = gpsState.loc
    }
    if (typeof gpsState.alt === 'number') {
      this.alt = gpsState.alt
    }
    if (typeof gpsState.satellites === 'number') {
      this.satellites = gpsState.satellites
    }
    if (typeof gpsState.hdop === 'number') {
      this.hdop = gpsState.hdop
    }
    if (typeof gpsState.fixType === 'number') {
      this.fixType = gpsState.fixType
    }
    this._debug(`applyGpsState: loc=[${this.loc}] alt=${this.alt} sats=${this.satellites} hdop=${this.hdop} fixType=${this.fixType}`)
  }

  isValidGps() {
    const [lat, lon] = this.loc
    const hasPositionFix = (
      typeof lat === 'number' && typeof lon === 'number' &&
      !(lat === 0 && lon === 0) &&
      this.fixType >= 3
    )
    if (!hasPositionFix) {
      return false
    }

    // SoftBank ichimill accepted GGA with unknown satellites count.
    // Do not block GGA transmission when satellites is reported as 0.
    if (this.options.preset === 'ichimill') {
      return true
    }

    return this.satellites > 0
  }

  useGngga() {
    return this.options.preset === 'ichimill'
  }

  shouldSendNtripGgaHeader() {
    return this.options.preset !== 'ichimill'
  }

  startSendingGGA() {
    this._debug(`startSendingGGA: interval=${this.options.ggaInterval}s`)
    this.ggaInterval = setInterval(() => {
      this.sendGGAOnce()
    }, this.options.ggaInterval * 1000)
  }

  sendGGAOnce() {
    if (!this.handshakeComplete) {
      this._debug('sendGGAOnce: skipped (handshake not complete yet)')
      return false
    }
    if (!this.isValidGps()) {
      this._debug(`sendGGAOnce: skipped (GPS not valid: loc=[${this.loc}] fixType=${this.fixType} sats=${this.satellites})`)
      return false
    }
    if (this.client && this.client.writable) {
      const ggaMessage = this.generateGGAMessage()
      this._debug(`sendGGAOnce: ${ggaMessage.trim()}`)
      // NMEA over socket should be CRLF-terminated.
      // Keep generateGGAMessage() raw for Ntrip-GGA header usage.
      this.client.write(`${ggaMessage}\r\n`)
      return true
    } else {
      this._debug(`sendGGAOnce: skipped (client=${!!this.client}, writable=${this.client && this.client.writable})`)
      return false
    }
  }

  stopSendingGGA() {
    if (this.ggaInterval) {
      clearInterval(this.ggaInterval)
      this.ggaInterval = null
    }
  }

  sendInitialGGA() {
    if (!this.handshakeComplete) {
      this._debug('sendInitialGGA: skipped (handshake not complete yet)')
      return
    }
    if (this.isValidGps()) {
      this._debug('sendInitialGGA: GPS valid, sending initial GGA')
      this.initialGgaSent = this.sendGGAOnce()
    } else {
      this._debug('sendInitialGGA: GPS not valid yet, deferring until GPS lock')
    }
  }

  generateGGAMessage() {
    this._debug(`generateGGAMessage: loc=[${this.loc}] alt=${this.alt} sats=${this.satellites} hdop=${this.hdop}`)
    return encodeGGA({
      datetime: Date.now(),
      loc: this.loc,
      gpsQuality: 1,
      satellites: this.satellites,
      hdop: this.hdop,
      altitude: this.alt,
      altitudeUnit: 'M',
      geoidalSeparation: this.useGngga() ? 0.0 : 0,
      geoidalSeparationUnit: 'M',
      ageGpsData: this.useGngga() ? '' : 1,
      refStationId: this.useGngga() ? '' : 1,
      type: this.useGngga() ? 'GNGGA' : 'GPGGA'
    })
  }

  markHandshakeComplete() {
    this.handshakeComplete = true
    this.status = 'Online'
    this._debug('handshake complete')
    this.emit('connected')
    this.sendInitialGGA()
    this.startSendingGGA()
  }

  connect() {
    const { host, port, username, password, mountpoint, useTls } = this.options
    this._debug(`connect: host=${host} port=${port} mount=${mountpoint} tls=${useTls}`)
    const auth = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    const headers = {
      'Ntrip-Version': 'Ntrip/2.0',
      'User-Agent': 'NTRIP rpanion-server',
      'Authorization': `Basic ${auth}`,
      'Host': `${host}:${port}`
    }

    if (this.isValidGps() && this.shouldSendNtripGgaHeader()) {
      const ggaSentence = this.generateGGAMessage()
      headers['Ntrip-GGA'] = ggaSentence.trim()
      this._debug(`connect: adding Ntrip-GGA header: ${headers['Ntrip-GGA']}`)
    } else if (this.isValidGps()) {
      this._debug('connect: GPS valid, but omitting Ntrip-GGA header for ichimill preset')
    } else {
      this._debug('connect: GPS not valid, omitting Ntrip-GGA header')
    }

    const requestOptions = {
      host,
      port
    }

    const connectCallback = (client) => {
      let httpHeaderReceived = false
      let responseBuffer = Buffer.alloc(0)
      let chunkedEncoding = false
      let chunkBuffer = Buffer.alloc(0)

      client.on('end', () => {
        this._debug('socket end received')
        this.emit('close')
        this.stopSendingGGA()
      })

      let customHeader = ''
      for (const key in headers) {
        customHeader += `${key}: ${headers[key]}\r\n`
      }
      const data = `GET /${mountpoint} HTTP/1.1\r\n${customHeader}\r\n`
      this._debug(`sending HTTP request:\n${data.replace(/\r\n/g, '\\r\\n\n')}`)
      client.write(data)

      const MAX_HEADER_BUFFER = 64 * 1024

      let rtcmByteCount = 0
      let rtcmPacketCount = 0

      client.on('data', (data) => {
        if (!httpHeaderReceived) {
          responseBuffer = Buffer.concat([responseBuffer, data])
          this._debug(`rx (pre-header): ${data.length} bytes, buffer=${responseBuffer.length} bytes`)

          if (responseBuffer.length > MAX_HEADER_BUFFER) {
            this._debug(`responseBuffer exceeded ${MAX_HEADER_BUFFER} bytes, destroying connection`)
            this.emit('error', 'HTTP header too large')
            this.status = 'Header too large'
            client.destroy()
            return
          }

          const responseStr = responseBuffer.toString()

          if (responseStr.startsWith('ICY 200 OK')) {
            const icyHeaderEnd = responseStr.indexOf('\r\n\r\n')
            const icyLineEnd = responseStr.indexOf('\r\n')

            if (icyHeaderEnd !== -1) {
              this._debug(`ICY 200 OK: found \\r\\n\\r\\n at ${icyHeaderEnd}, connected (NTRIPv1)`)
              httpHeaderReceived = true
              this.markHandshakeComplete()
              const rtcmData = responseBuffer.slice(icyHeaderEnd + 4)
              if (rtcmData.length > 0) this.emit('data', rtcmData)
              responseBuffer = Buffer.alloc(0)
            } else if (icyLineEnd !== -1 && responseBuffer.length === icyLineEnd + 2) {
              this._debug('ICY 200 OK: line-only response, connected (NTRIPv1)')
              httpHeaderReceived = true
              this.markHandshakeComplete()
              responseBuffer = Buffer.alloc(0)
            } else if (icyLineEnd !== -1) {
              this._debug(`ICY 200 OK: found \\r\\n at ${icyLineEnd}, waiting for possible extra header terminator/data`)
            } else {
              this._debug(`ICY 200 OK: waiting for \\r\\n (buffer=${responseBuffer.length} bytes)`)
            }
            return
          }

          const headerEndIndex = responseStr.indexOf('\r\n\r\n')

          if (headerEndIndex !== -1) {
            const headerPart = responseStr.substring(0, headerEndIndex)
            const headerLines = headerPart.split('\r\n')

            const statusLine = headerLines[0]
            this._debug(`HTTP response: ${statusLine}`)
            this._debug(`HTTP headers:\n${headerLines.slice(1).join('\n')}`)

            if (headerLines.some(line => line.toUpperCase().includes('SOURCETABLE'))) {
              this._debug('SOURCETABLE detected: invalid mountpoint')
              this.emit('error', 'SOURCETABLE received: invalid mountpoint')
              this.stopSendingGGA()
              this.status = 'Mount point not found'
              client.destroy()
              return
            }

            if (statusLine.includes('401 Unauthorized')) {
              this._debug('401 Unauthorized: check credentials')
              this.emit('error', '401 Unauthorized')
              this.stopSendingGGA()
              this.status = 'Incorrect credentials'
              client.destroy()
              return
            } else if (statusLine.includes('404 Not Found')) {
              this._debug('404 Not Found: check mountpoint')
              this.emit('error', '404 Not Found')
              this.stopSendingGGA()
              this.status = 'Mount point not found'
              client.destroy()
              return
            } else if (!statusLine.includes('200 OK') && !statusLine.includes('200')) {
              this._debug(`unexpected HTTP status: ${statusLine}`)
              this.emit('error', `Unexpected HTTP response: ${statusLine}`)
              this.stopSendingGGA()
              this.status = `HTTP error: ${statusLine}`
              client.destroy()
              return
            }

            for (const line of headerLines) {
              if (line.toLowerCase().includes('transfer-encoding') && line.toLowerCase().includes('chunked')) {
                chunkedEncoding = true
                this._debug('transfer-encoding: chunked detected')
                break
              }
            }

            httpHeaderReceived = true
            this._debug(`connected to NTRIP caster (chunked=${chunkedEncoding})`)
            this.markHandshakeComplete()

            const bodyStartIndex = headerEndIndex + 4
            const rtcmData = responseBuffer.slice(bodyStartIndex)

            if (rtcmData.length > 0) {
              this._debug(`initial RTCM data: ${rtcmData.length} bytes`)
              if (chunkedEncoding) {
                chunkBuffer = Buffer.concat([chunkBuffer, rtcmData])
                this.processChunkedData()
              } else {
                this.emit('data', rtcmData)
              }
            }

            responseBuffer = Buffer.alloc(0)
          } else {
            this._debug(`waiting for HTTP header end (buffer=${responseBuffer.length} bytes)`)
          }
        } else {
          rtcmByteCount += data.length
          rtcmPacketCount++
          this._debug(`RTCM rx: packet #${rtcmPacketCount} ${data.length} bytes (total=${rtcmByteCount} bytes)`)
          if (chunkedEncoding) {
            chunkBuffer = Buffer.concat([chunkBuffer, data])
            this.processChunkedData()
          } else {
            this.emit('data', data)
          }
        }
      })

      this.processChunkedData = () => {
        while (chunkBuffer.length > 0) {
          const chunkStr = chunkBuffer.toString()
          const crlfIndex = chunkStr.indexOf('\r\n')

          if (crlfIndex === -1) {
            break
          }

          const chunkSizeStr = chunkStr.substring(0, crlfIndex)
          const chunkSize = parseInt(chunkSizeStr, 16)

          if (isNaN(chunkSize)) {
            chunkBuffer = chunkBuffer.slice(crlfIndex + 2)
            continue
          }

          if (chunkSize === 0) {
            chunkBuffer = Buffer.alloc(0)
            break
          }

          const chunkDataStart = crlfIndex + 2
          const chunkDataEnd = chunkDataStart + chunkSize

          if (chunkBuffer.length < chunkDataEnd + 2) {
            break
          }

          const chunkData = chunkBuffer.slice(chunkDataStart, chunkDataEnd)
          this.emit('data', chunkData)

          chunkBuffer = chunkBuffer.slice(chunkDataEnd + 2)
        }
      }
    }

    if (useTls) {
      this._debug('connecting via TLS')
      this.client = tls.connect({
        host: requestOptions.host,
        port: requestOptions.port,
        servername: host,
        rejectUnauthorized: false
      }, () => connectCallback(this.client))
    } else {
      this._debug('connecting via TCP')
      this.client = net.connect(requestOptions, () => connectCallback(this.client))
    }

    this.client.on('connect', () => {
      this._debug('socket connect event received')
    })

    this.client.on('error', (err) => {
      this._debug(`socket error: ${err && err.message ? err.message : err}`)
      this.emit('error', err.message)
      this.status = err.message
      this.stopSendingGGA()
    })

    this.client.on('close', () => {
      this._debug('client close event received')
      this.emit('close')
      this.stopSendingGGA()
    })
  }

  disconnect() {
    if (this.client) {
      this.stopSendingGGA()
      this.client.end()
      this.client = null
    }
  }
}

class ntrip {
  constructor (settings) {
    this.options = {
      preset: 'custom',
      host: '',
      port: 2101,
      mountpoint: '',
      username: '',
      password: '',
      interval: 2000,
      active: false,
      useTls: false,
      ggaInterval: 60
    }

    // status. 0=not active, 1=waiting for FC, 2=waiting for GPS lock, 3=waiting for NTRIP server, 4=getting packets
    // -1=ntrip error
    this.status = 0

    // time of last RTCM packet. Used for detecting loss of connection
    this.timeofLastPacket = 0

    this.eventEmitter = new events.EventEmitter()
    this.seq = 0
    this.reconnectTimer = null
    this.packetTimeoutTimer = null
    this.reconnectAttempt = 0
    this.nextReconnectAt = null
    this.reconnectBaseDelayMs = 1000
    this.reconnectMaxDelayMs = 60000

    this._debugEnabled = process.env.NTRIP_DEBUG === '1'
    this._debug = (...args) => {
      if (this._debugEnabled) _ntripDebugLog(...args)
    }

    this.settings = settings
    this.options.host = this.settings.value('ntrip.host', '')
    this.options.port = this.settings.value('ntrip.port', 2101)
    this.options.mountpoint = this.settings.value('ntrip.mountpoint', '')
    this.options.username = this.settings.value('ntrip.username', '')
    this.options.password = this.settings.value('ntrip.password', '')
    this.options.active = this.settings.value('ntrip.active', false)
    this.options.useTls = this.settings.value('ntrip.useTls', false)
    this.options.ggaInterval = this.settings.value('ntrip.ggaInterval', 60)
    this.options.preset = this.settings.value('ntrip.preset', 'custom')

    this.applyPresetLocks()

    this.client = null
    this.latestGpsState = null
    this.startStopNTRIP()
  }

  setDebug(enabled) {
    this._debugEnabled = Boolean(enabled)
    this._debug = (...args) => {
      if (this._debugEnabled) _ntripDebugLog(...args)
    }
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.nextReconnectAt = null
  }

  stopClient() {
    if (this.client) {
      this._debug('stopClient: destroying client')
      this.client.stopSendingGGA()
      this.client.removeAllListeners()
      if (this.client.client) {
        this.client.client.removeAllListeners()
        this.client.client.destroy()
        this.client.client = null
      }
      this.client = null
    } else {
      this._debug('stopClient: no client to stop')
    }
  }

  shouldRetryForError(err) {
    const errText = String(err || '')
    if (errText.includes('401 Unauthorized')) return false
    if (errText.includes('404 Not Found')) return false
    if (errText.includes('SOURCETABLE')) return false
    return true
  }

  getReconnectDelayMs() {
    const exp = Math.min(this.reconnectAttempt, 16)
    const delay = Math.min(this.reconnectBaseDelayMs * (2 ** exp), this.reconnectMaxDelayMs)
    const jitter = Math.floor(Math.random() * 250)
    return delay + jitter
  }

  scheduleReconnect(err) {
    if (!this.options.active) {
      this._debug('scheduleReconnect: skipped (not active)')
      return
    }
    if (this.reconnectTimer) {
      this._debug('scheduleReconnect: skipped (timer already pending)')
      return
    }
    if (!this.shouldRetryForError(err)) {
      this._debug(`scheduleReconnect: not retrying for error: ${err}`)
      return
    }

    const delayMs = this.getReconnectDelayMs()
    this.reconnectAttempt = this.reconnectAttempt + 1
    this.nextReconnectAt = Date.now() + delayMs
    console.log(`NTRIP reconnect scheduled in ${delayMs}ms (attempt ${this.reconnectAttempt})`)
    this._debug(`scheduleReconnect: attempt=${this.reconnectAttempt} delay=${delayMs}ms error=${err}`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.nextReconnectAt = null
      if (!this.options.active) {
        this._debug('scheduleReconnect: timer fired but no longer active, aborting')
        return
      }
      this._debug('scheduleReconnect: timer fired, calling startStopNTRIP')
      this.startStopNTRIP()
    }, delayMs)
  }

  reconnectSuffix() {
    if (!this.reconnectTimer || this.nextReconnectAt === null) {
      return ''
    }
    const sec = Math.max(1, Math.ceil((this.nextReconnectAt - Date.now()) / 1000))
    return ` (retry in ${sec}s)`
  }

  applyPresetLocks() {
    const preset = getPreset(this.options.preset)

    if (preset.fixedHost) {
      this.options.host = preset.fixedHost
      this.options.port = preset.fixedPort
      this.options.useTls = preset.fixedUseTls
    }
  }

  getSettings(callback) {
    return callback(
      this.options.host,
      this.options.port,
      this.options.mountpoint,
      this.options.username,
      this.options.password,
      this.options.active,
      this.options.useTls,
      this.options.ggaInterval,
      this.options.preset,
      getPresetOptions()
    )
  }

  startStopNTRIP() {
    if (this.options.active) {
      this._debug(`startStopNTRIP: starting - host=${this.options.host} port=${this.options.port} mount=${this.options.mountpoint} tls=${this.options.useTls} ggaInterval=${this.options.ggaInterval}s`)
      this.clearReconnectTimer()
      this.stopClient()
      this.client = new NtripClientWrapper(this.options, this._debug, this.latestGpsState)
      this.seq = 0

      this.client.on('data', (data) => {
        if (this.options.active) {
          try {
            this.status = 4
            this.reconnectAttempt = 0
            this.clearReconnectTimer()
            this.timeofLastPacket = Date.now().valueOf()
            this._debug(`RTCM packet forwarded: seq=${this.seq} size=${data.length} bytes`)
            this.eventEmitter.emit('rtcmpacket', data, this.seq)
            this.seq = this.seq + 1
          } catch (e) {
            console.log('Bad ntrip data')
          }
        }
      })

      this.client.on('close', () => {
        console.log('NTRIP client close')
        this._debug('client close event received')
        if (this.options.active) {
          this.scheduleReconnect(this.client ? this.client.status : 'connection closed')
        }
      })

      this.client.on('error', (err) => {
        if (this.options.active) {
          console.log('NTRIP error ' + err)
          this._debug(`client error event: ${err}`)
          this.status = -1
          this.scheduleReconnect(err)
        }
      })

      this.client.on('connected', () => {
        this._debug(`client connected event: status=${this.status}`)
        this.reconnectAttempt = 0
        this.clearReconnectTimer()
      })

      this.client.connect()
      console.log('NTRIP started')
      this.status = 1

      if (!this.packetTimeoutTimer) {
        this._debug('starting packet timeout timer (5s interval, 15s threshold)')
        this.packetTimeoutTimer = setInterval(() => {
          if (this.status === 4 && this.timeofLastPacket > 0) {
            const elapsed = Date.now() - this.timeofLastPacket
            this._debug(`packet timeout check: elapsed=${elapsed}ms threshold=15000ms`)
            if (elapsed > 15000) {
              console.log('NTRIP packet timeout, reconnecting...')
              this._debug('packet timeout exceeded, stopping client and scheduling reconnect')
              this.stopClient()
              this.scheduleReconnect('packet timeout')
            }
          }
        }, 5000)
      }
    } else {
      this._debug('startStopNTRIP: stopping')
      this.clearReconnectTimer()
      this.reconnectAttempt = 0
      this.stopClient()

      if (this.packetTimeoutTimer) {
        clearInterval(this.packetTimeoutTimer)
        this.packetTimeoutTimer = null
        this._debug('packet timeout timer cleared')
      }

      this.status = 0
      console.log('NTRIP stopped')
    }
  }

  generateGGAMessage(loc, alt = 0, satellites = 0, hdop = 0) {
    if (this.client) {
      this.client.loc = loc
      this.client.alt = alt
      this.client.satellites = satellites
      this.client.hdop = hdop
      return this.client.generateGGAMessage()
    } else {
      const client = new NtripClientWrapper(this.options)
      client.loc = loc
      client.alt = alt
      client.satellites = satellites
      client.hdop = hdop
      return client.generateGGAMessage()
    }
  }

  setSettings(host, port, mount, username, password, active, useTls, ggaInterval = this.options.ggaInterval, preset = this.options.preset) {
    this.options.preset = NTRIP_PRESETS[preset] ? preset : 'custom'
    this.options.host = host
    this.options.port = port
    this.options.mountpoint = mount
    this.options.username = username
    this.options.password = password
    this.options.active = active
    this.options.useTls = useTls
    this.options.ggaInterval = ggaInterval

    this.applyPresetLocks()

    try {
      this.settings.setValue('ntrip.preset', this.options.preset)
      this.settings.setValue('ntrip.host', this.options.host)
      this.settings.setValue('ntrip.port', this.options.port)
      this.settings.setValue('ntrip.mountpoint', this.options.mountpoint)
      this.settings.setValue('ntrip.username', this.options.username)
      this.settings.setValue('ntrip.password', this.options.password)
      this.settings.setValue('ntrip.active', this.options.active)
      this.settings.setValue('ntrip.useTls', this.options.useTls)
      this.settings.setValue('ntrip.ggaInterval', this.options.ggaInterval)
      console.log('Saved NTRIP settings')
    } catch (e) {
      console.log(e)
    }

    this.startStopNTRIP()
  }

  onMavPacket(packet, data) {
    if (!this.options.active) {
      return
    }

    if (this.status === 1) {
      this._debug('onMavPacket: FC heartbeat received, status 1→2 (waiting for GPS lock)')
      this.status = 2
    }

    if (packet.header.msgid === common.GpsRawInt.MSG_ID) {
      this._debug(`onMavPacket: GPS_RAW_INT fixType=${data.fixType} lat=${data.lat} lon=${data.lon} alt=${data.alt} sats=${data.satellitesVisible} eph=${data.eph}`)
      if (data.fixType >= 3) {
        const gpsState = {
          loc: [data.lat / 1E7, data.lon / 1E7],
          alt: data.alt / 1E3,
          fixType: data.fixType,
          satellites: (data.satellitesVisible && data.satellitesVisible < 100) ? data.satellitesVisible : 0,
          hdop: (data.eph && data.eph !== 65535) ? data.eph / 100 : 0
        }

        this.latestGpsState = gpsState

        if (this.client) {
          this.client.applyGpsState(gpsState)
          this._debug(`onMavPacket: updated GPS loc=[${this.client.loc}] alt=${this.client.alt} sats=${this.client.satellites} hdop=${this.client.hdop}`)
        }

        if (this.status === 2) {
          this._debug('onMavPacket: GPS lock acquired, status 2→3')
          this.status = 3
        }

        if (this.client && this.client.handshakeComplete && !this.client.initialGgaSent) {
          this._debug('onMavPacket: sending initial GGA (first valid GPS after handshake)')
          this.client.initialGgaSent = this.client.sendGGAOnce()
        }
      } else {
        this._debug(`onMavPacket: GPS fix insufficient (fixType=${data.fixType} < 3), ignoring`)
      }
    }
  }

  conStatusStr() {
    const clientStatus = (this.client && this.client.status) || 'disconnected'
    if (this.status === 4) {
      if ((Date.now().valueOf()) - this.timeofLastPacket < 2000) {
        return 'Active - receiving RTCM packets'
      }
      return 'No RTCM server connection - ' + clientStatus + this.reconnectSuffix()
    } else if (this.status === 3) {
      return 'No RTCM server connection - ' + clientStatus + this.reconnectSuffix()
    } else if (this.status >= 2) {
      return 'Waiting for GPS lock'
    } else if (this.status === 1) {
      return 'Waiting for flight controller packets'
    } else if (this.status === 0) {
      return 'Not active'
    } else if (this.status === -1) {
      return 'Error - unable to connect to NTRIP server - ' + clientStatus + this.reconnectSuffix()
    }
    return 'Unknown status'
  }
}

module.exports = ntrip
