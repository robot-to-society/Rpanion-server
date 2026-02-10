import { Route, Routes, Link, useLocation, Navigate } from 'react-router-dom'
import React, { useState, useEffect } from 'react'

import About from './about.jsx'
import Home from './home.jsx'
import NetworkConfig from './networkconfig.jsx'
import VideoPage from './video.jsx'
import FCConfig from './flightcontroller-reactflow.jsx'
import LogBrowser from './logBrowser.jsx'
import NetworkClients from './networkClients.jsx'
import NTRIPPage from './ntripcontroller.jsx'
import AdhocConfig from './adhocwifi.jsx'
import CloudConfig from './cloud.jsx'
import VPN from './vpnconfig.jsx'
import Logout from './logout.jsx'
import UserManagement from './userManagement.jsx'
import PPPPage from './ppp.jsx'

function AppRouter () {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [currentTime, setCurrentTime] = useState('')
  const [socketStatus, setSocketStatus] = useState('connecting')
  const location = useLocation()

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const timeStr = now.toLocaleTimeString('ja-JP', { hour12: false })
      setCurrentTime(timeStr)
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // Socket.IO connection monitoring
  useEffect(() => {
    if (!isAuthenticated) return

    // Import socket.io-client
    import('socket.io-client').then((module) => {
      const io = module.default
      const tokenString = localStorage.getItem('token')
      const userToken = JSON.parse(tokenString)
      const token = userToken?.token

      const socket = io({
        extraHeaders: {
          authorization: `Bearer ${token}`
        }
      })

      socket.on('connect', () => {
        setSocketStatus('connected')
      })

      socket.on('disconnect', () => {
        setSocketStatus('disconnected')
      })

      socket.on('connect_error', () => {
        setSocketStatus('error')
      })

      socket.on('reconnecting', () => {
        setSocketStatus('connecting')
      })

      return () => {
        socket.disconnect()
      }
    })
  }, [isAuthenticated])

  useEffect(() => {
    // Check authentication on mount and when location changes
    const tokenString = localStorage.getItem('token')
    const userToken = JSON.parse(tokenString)
    const token = userToken?.token

    if (token) {
      fetch('/api/auth', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        if (!response.ok) {
          setIsAuthenticated(false)
        } else {
          setIsAuthenticated(true)
        }
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
    } else {
      setIsAuthenticated(false)
    }
  }, [location.pathname])

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return null
  }

  // If not authenticated and not on home page, redirect to home
  if (!isAuthenticated && location.pathname !== '/') {
    return <Navigate to="/" replace />
  }

  return (
    <>
      {/* Background overlays */}
      <div className="grid-overlay"></div>
      <div className="scanline"></div>

      {/* Header */}
      <header className="app-header">
        <div className="d-flex justify-content-between align-items-center">
          <h1 className="app-header-title">
            <i className="bi bi-rocket-takeoff me-2"></i>
            SPARK CONTROL STATION
          </h1>
          <div className="system-status">
            <div className={`status-indicator ${socketStatus === 'connected' ? 'connected' : socketStatus === 'connecting' ? 'warning' : 'error'}`}>
              {socketStatus === 'connected' ? 'CONNECTED' : socketStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </div>
            <div className="app-header-clock">{currentTime}</div>
          </div>
        </div>
      </header>

      <div id="wrapper" className="d-flex">
        <div id="sidebar-wrapper" className="bg-light border-right">
          <div id="sidebar-items" className="list-group list-group-flush">
            <Link className='list-group-item list-group-item-action bg-light' to="/">
              <i className="bi bi-house-door me-2"></i>Home
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/flightlogs">
              <i className="bi bi-file-earmark-text me-2"></i>Flight Logs
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/controller">
              <i className="bi bi-cpu me-2"></i>Flight Controller
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/ppp">
              <i className="bi bi-globe me-2"></i>PPP Config
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/ntrip">
              <i className="bi bi-broadcast me-2"></i>NTRIP Config
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/network">
              <i className="bi bi-wifi me-2"></i>Network Config
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/adhoc">
              <i className="bi bi-wifi-2 me-2"></i>Adhoc Wifi Config
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/apclients">
              <i className="bi bi-people me-2"></i>Access Point Clients
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/video">
              <i className="bi bi-camera-video me-2"></i>Video Streaming
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/cloud">
              <i className="bi bi-cloud-upload me-2"></i>Cloud Upload
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/vpn">
              <i className="bi bi-shield-lock me-2"></i>VPN Config
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/about">
              <i className="bi bi-info-circle me-2"></i>About
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/users">
              <i className="bi bi-person-gear me-2"></i>User Management
            </Link>
            <Link className='list-group-item list-group-item-action bg-light' to="/logoutconfirm">
              <i className="bi bi-box-arrow-right me-2"></i>Logout
            </Link>
          </div>
        </div>

        <div className="page-content-wrapper" style={{ width: '100%' }}>
          <div className="container-fluid">
            <Routes>
              <Route exact path="/" element={<Home />} />
              <Route exact path="/controller" element={<FCConfig />} />
              <Route exact path="/ppp" element={<PPPPage />} />
              <Route exact path="/network" element={<NetworkConfig />} />
              <Route exact path="/about" element={<About />} />
              <Route exact path="/video" element={<VideoPage />} />
              <Route exact path="/flightlogs" element={<LogBrowser />} />
              <Route exact path="/apclients" element={<NetworkClients />} />
              <Route exact path="/ntrip" element={<NTRIPPage />} />
              <Route exact path="/adhoc" element={<AdhocConfig />} />
              <Route exact path="/cloud" element={<CloudConfig />} />
              <Route exact path="/vpn" element={<VPN/>} />
              <Route exact path="/logoutconfirm" element={<Logout/>} />
              <Route exact path="/users" element={<UserManagement/>} />
              <Route path="*" element={<NoMatch />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  )
}

function NoMatch () {
  const location = useLocation();
  return (
    <div>
    <h1>404 - Page Not Found</h1>
    <p>The URL <code>{location.pathname}</code> does not exist.</p>
  </div>
  )
}

export default AppRouter
