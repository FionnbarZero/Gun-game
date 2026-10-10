import { defineRoom, defineServer } from 'colyseus';
import { MatchRoom } from './rooms/MatchRoom.js';

const server = defineServer({
  rooms: {
    private_match: defineRoom(MatchRoom),
  },
  express: (app) => {
    app.get('/api/health', (_request, response) => response.json({ ok:true, service:'resonance-multiplayer' }));
  },
});

export default server;
export { server };
