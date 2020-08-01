import { Room, Session } from './types';
export interface PresenceMeta {
    roomId: string;
    guest?: {
        reference: string;
    };
    connectionId?: string;
    namespace: string;
    ttl: number;
    createdAt: number;
}
interface PresenceOptions {
    ttl?: number;
}
export default class PresenceClient {
    _socketURL: string;
    _authorizationUrl: string;
    _roomReference: string;
    _roomId?: string;
    private _socket?;
    private _authorized?;
    constructor(parameters: {
        authUrl: string;
        roomReference: string;
    });
    init({ room, session }: {
        room?: Room;
        session?: Session;
    }): void;
    setPresence<P>(key: string, value: P, options?: PresenceOptions): Promise<void>;
    onSetPresence<P>(callback: (meta: PresenceMeta, value: P) => void): void;
}
export {};
