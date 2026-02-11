import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import NetworkChart from './NetworkChart';
import data from './json/graphml_data.json';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <div style={{ width: '100%', height: '100vh' }}>
      <NetworkChart data={data} />
    </div>
  </React.StrictMode>
);
