/// <reference types="socket.io-client" />
export declare function authorizeSocket(socket: SocketIOClient.Socket, token: string, roomId: string): Promise<boolean | undefined>;
