/// <reference types="socket.io-client" />
import { Events } from './socket';
export default class ListenerManager {
    private _listeners;
    on(socket: SocketIOClient.Socket, event: Events, callback: (...args: any[]) => void): void;
    removeAllListeners(socket: SocketIOClient.Socket): void;
}
