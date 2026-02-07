// Colyseus client configuration
import { Client } from 'colyseus.js';

const COLYSEUS_SERVER_URL =
  import.meta.env.VITE_COLYSEUS_SERVER_URL || 'ws://localhost:2567';

export const client = new Client(COLYSEUS_SERVER_URL);
