import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import TeacherLogin from './TeacherLogin'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TeacherLogin><App /></TeacherLogin>
  </React.StrictMode>
)
