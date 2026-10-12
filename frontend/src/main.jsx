import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { bootPlanTheme } from './theme/planThemes';
import './index.css';

bootPlanTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
