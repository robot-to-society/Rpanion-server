import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import React from 'react'

import basePage from './basePage.jsx';

import './css/styles.css';

class NTRIPPage extends basePage {
  constructor(props, useSocketIO = true) {
    super(props, useSocketIO);
    this.state = {
      ...this.state,
      host: "",
      port: 0,
      mountpoint: "",
      username: "",
      password: "",
      active: false,
      showPW: false,
      useTLS: false,
      ggaInterval: 60,
      preset: "custom",
      presets: [{ id: "custom", name: "Custom", defaultGgaInterval: 60, hostLocked: false, portLocked: false, useTlsLocked: false }],
      NTRIPStatus: this.props.NTRIPStatus
    }

    //Socket.io client for reading in analog update values
    this.socket.on('NTRIPStatus', function (msg) {
      this.setState({ NTRIPStatus: msg });
    }.bind(this));
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount();
    }.bind(this));
  }

  componentDidMount() {
    fetch(`/api/ntripconfig`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); this.loadDone() });
  }

  changeHandler = event => {
    //form change handler
    const name = event.target.name;
    const value = event.target.value;

    this.setState({
      [name]: value
    });
  }

  getSelectedPreset = () => {
    return this.state.presets.find(preset => preset.id === this.state.preset);
  }

  isPresetLocked = (fieldName) => {
    const preset = this.getSelectedPreset();
    if (!preset) {
      return false;
    }
    return preset[fieldName] === true;
  }

  handlePresetChange = (event) => {
    const presetId = event.target.value;
    const preset = this.state.presets.find(item => item.id === presetId);
    if (!preset) {
      this.setState({ preset: presetId });
      return;
    }

    this.setState(prevState => {
      const nextState = {
        preset: presetId,
        ggaInterval: Number(preset.defaultGgaInterval)
      };

      if (preset.hostLocked) {
        nextState.host = preset.fixedHost;
        nextState.port = Number(preset.fixedPort);
        nextState.useTLS = Boolean(preset.fixedUseTls);
      } else {
        nextState.host = prevState.host;
        nextState.port = prevState.port;
        nextState.useTLS = prevState.useTLS;
      }

      return nextState;
    });
  }

  togglePasswordVisible = (event) => {
    this.setState({ showPW: event.target.checked });
  }

  toggleuseTLS = (event) => {
    this.setState({ useTLS: event.target.checked });
  }

  handleNTRIPSubmit = () => {
    //user clicked start/stop NTRIP
    fetch('/api/ntripmodify', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        host: JSON.stringify(this.state.host),
        port: JSON.stringify(Number(this.state.port)),
        mountpoint: JSON.stringify(this.state.mountpoint),
        username: JSON.stringify(this.state.username),
        password: JSON.stringify(this.state.password),
        preset: this.state.preset,
        useTLS: this.state.useTLS,
        ggaInterval: Number(this.state.ggaInterval),
        active: !this.state.active
      })
    }).then(response => response.json()).then(state => { this.setState(state) });
  }

  renderTitle() {
    return "NTRIP Configuration";
  }

  renderContent() {
    return (
      <div>
        <p><i>Stream NTRIP (GPS correction) data from a web service to the flight controller</i></p>
        <h2>Configuration</h2>
        <Form style={{ width: 500 }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Preset</label>
            <div className="col-sm-10">
              <select className="form-control" name="preset" disabled={this.state.active === true} onChange={this.handlePresetChange} value={this.state.preset}>
                {this.state.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Host</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="host" disabled={this.state.active === true || this.isPresetLocked('hostLocked')} onChange={this.changeHandler} value={this.state.host} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Port</label>
            <div className="col-sm-10">
              <input type="number" min="100" max="60000" step="1" className="form-control" name="port" disabled={this.state.active === true || this.isPresetLocked('portLocked')} onChange={this.changeHandler} value={this.state.port} />
              <input type="checkbox" name="useTLS" disabled={this.state.active === true || this.isPresetLocked('useTlsLocked')} onChange={this.toggleuseTLS} checked={this.state.useTLS} /><label>Use TLS</label>
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Mountpoint</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="mountpoint" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.mountpoint} />
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Username</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="username" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.username} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Password</label>
            <div className="col-sm-10">
              <input type={this.state.showPW === true ? "text" : "password"} className="form-control" name="password" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.password} />
              <input name="showpassword" type="checkbox" checked={this.state.showPW} onChange={this.togglePasswordVisible} /><label>Show Password</label>
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">GGA Interval (sec)</label>
            <div className="col-sm-10">
              <input type="number" min="1" max="60" step="1" className="form-control" name="ggaInterval" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.ggaInterval} />
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-10">
              <Button onClick={this.handleNTRIPSubmit} className="btn btn-primary">{this.state.active === true ? "Disable" : "Enable"}</Button>
            </div>
          </div>
        </Form>
        <h2>Status</h2>
        <p>{this.state.NTRIPStatus}</p>
      </div>
    );
  }
}


export default NTRIPPage;
