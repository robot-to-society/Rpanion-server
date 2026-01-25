const assert = require('assert')
const settings = require('settings-store')
const Ntrip = require('./ntrip')

describe('NTRIP Functions', function () {
  it('#ntripinit()', function () {
    settings.clear()
    const ntripClient = new Ntrip(settings)

    // check initial status
    assert.equal(ntripClient.options.active, false)
  })

  it('#ntriptryconnect()', function () {
    // Getting starting client with bad details
    settings.clear()
    const ntripClient = new Ntrip(settings)

    // ntripClient.setSettings ("auscors.ga.gov.au", 2101, "MNT", "name", "pwd", true)

    // check initial status
    assert.equal(ntripClient.conStatusStr(), 'Not active')

    // ntripClient.client.xyz = [5000, 5000, 0]
    // ntripClient.status = 3

    // assert.equal(ntripClient.conStatusStr(), 'No RTCM server connection')

    ntripClient.setSettings('auscors.ga.gov.au', 2101, 'MNT', 'name', 'pwd', false, false)

    assert.equal(ntripClient.conStatusStr(), 'Not active')
  })

  it('#ntripGGA()', function () {
    settings.clear()
    const ntripClient = new Ntrip(settings)

    let msg = ntripClient.generateGGAMessage([-54.3, 152.345])
    let msgparts = msg.split(',')
    // remove index 1 (time)
    msgparts.splice(1, 1)
    // remove checksum using splice, since it's dependent on the time field
    msgparts.splice(-1, 1)

    assert.deepEqual(msgparts, ['$GPGGA', '5418.000000', 'S', '15220.700000', 'E', '1', '00', '0.000', '0', 'M', '0', 'M', '1.000'])

  })

  it('#ntripGGAInterval()', function () {
    // Test default GGA interval is 60 seconds
    settings.clear()
    const ntripClient = new Ntrip(settings)
    assert.equal(ntripClient.options.ggaInterval, 60)
  })

  it('#ntripGGAIntervalCustom()', function () {
    // Test custom GGA interval persistence
    settings.clear()
    const ntripClient = new Ntrip(settings)
    ntripClient.setSettings('host', 2101, 'mount', 'user', 'pass', false, false, 30)
    assert.equal(ntripClient.options.ggaInterval, 30)

    // Verify it was saved to settings
    assert.equal(settings.value('ntrip.ggaInterval'), 30)
  })

  it('#ntripGGAIntervalBoundaries()', function () {
    // Test minimum boundary (1 second)
    settings.clear()
    const ntripClient = new Ntrip(settings)
    ntripClient.setSettings('host', 2101, 'mount', 'user', 'pass', false, false, 1)
    assert.equal(ntripClient.options.ggaInterval, 1)

    // Test maximum boundary (60 seconds)
    ntripClient.setSettings('host', 2101, 'mount', 'user', 'pass', false, false, 60)
    assert.equal(ntripClient.options.ggaInterval, 60)
  })

  it('#ntripGGAIntervalBackwardCompatibility()', function () {
    // Test backward compatibility when ggaInterval is missing from settings
    settings.clear()
    // Don't set ggaInterval in settings - it should default to 60
    const ntripClient = new Ntrip(settings)
    assert.equal(ntripClient.options.ggaInterval, 60)
  })
})
