import { PeerServer } from 'peer';

export default function handler(req, res) {
    try {
        const peerServer = PeerServer({ port: 9000, path: '/' });
        
        return res.status(200).json({status: 'connected'})
    } catch (err) {
        return res.status(200);
    }
}
