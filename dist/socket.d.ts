/// <reference types="socket.io-client" />
export declare type Events = 'connect' | 'disconnect' | 'error' | 'sync_room_state' | 'update_presence' | 'authenticated' | 'reconnect_attempt';
declare const Sockets: {
    newSocket(url: string, opts?: SocketIOClient.ConnectOpts | undefined): SocketIOClient.Socket;
    on(socket: SocketIOClient.Socket, event: Events, fn: (...args: any[]) => void): void;
    off(socket: SocketIOClient.Socket, event: Events, callback?: ((...args: any[]) => void) | undefined): void;
    emit(socket: SocketIOClient.Socket, event: "sync_room_state" | "update_presence" | "authenticate", ...args: any[]): void;
    disconnect(socket: SocketIOClient.Socket): void;
};
export default Sockets;
