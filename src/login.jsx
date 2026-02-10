//import basePage from './basePage.js'
import { useState } from 'react'
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import React from 'react'

import './css/styles.css';

export default function loginPage() {
  const [username, setUserName] = useState()
  const [password, setPassword] = useState()
  const [errorMessage, setErrorMessage] = useState('');

  const handleCloseError = () => {
    // user has closed the error window
    setErrorMessage('')
  }

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json(); // Get the error response from the server

      console.log('Login:', data);

      // Check if login was successful
      if (!response.ok) {
        console.log('Login failed:', data);
        setErrorMessage(data.error)
      } else {
        // If login is successful, process the data (e.g., save token)
        localStorage.setItem('token', JSON.stringify(data));
        window.location.reload();
        
        // Clear any previous error message
        setErrorMessage('');
      }
    } catch (error) {
      // If an error occurred, set the error message
      setErrorMessage(error.message);
    }
  }

  return(
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <i className="bi bi-shield-lock-fill login-icon"></i>
          <h1 className="login-title">AUTHENTICATION REQUIRED</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group mb-4">
            <label className="form-label">
              <i className="bi bi-person-fill me-2"></i>
              username
            </label>
            <input
              type="text"
              name="username"
              className="form-control"
              placeholder="enter your username"
              onChange={e => setUserName(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label">
              <i className="bi bi-key-fill me-2"></i>
              password
            </label>
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="enter your password"
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="login-actions">
            <Button type="submit" variant="primary" className="w-100">
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Login
            </Button>
          </div>
        </form>
      </div>

      <Modal show={errorMessage !== ''} onHide={handleCloseError}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            Authentication Error
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="mb-0">{errorMessage}</p>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={handleCloseError}>
            <i className="bi bi-check-circle me-2"></i>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
