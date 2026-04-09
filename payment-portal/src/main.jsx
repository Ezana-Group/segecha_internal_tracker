import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installClientErrorReporter } from './utils/clientErrorReporter';

installClientErrorReporter('payment');

createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
);
