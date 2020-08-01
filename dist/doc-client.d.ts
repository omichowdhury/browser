import Automerge from 'automerge';
import { Obj, Room, Session } from './types';
export default class DocClient<T extends Obj> {
    private readonly _peer;
    private readonly _roomReference;
    private _socket?;
    private _roomId?;
    private _doc?;
    private _actorId?;
    private _defaultDoc?;
    private _authorized?;
    private _listenerManager;
    _socketURL: string;
    private _onUpdateSocketCallback?;
    private _onConnectSocketCallback?;
    private _onDisconnectSocketCallback?;
    private _saveOffline;
    constructor(parameters: {
        roomReference: string;
        defaultDoc?: T;
    });
    private readActorIdThenCreateDoc;
    private createDoc;
    /**
     * Manually attempt to restore the state from offline storage.
     */
    restore(): Promise<any>;
    /**
     * Attempts to go online.
     */
    init({ room, session, }: {
        room?: Room;
        session?: Session;
    }): Promise<{
        doc?: T;
    }>;
    /**
     * Manually go offline
     */
    disconnect(): void;
    onSetDoc(callback: (state: Readonly<any>) => any): void;
    onConnect(callback: () => any): void;
    onDisconnect(callback: () => any): void;
    private syncOfflineCache;
    private _sendMsgToSocket;
    setDoc<D>(callback: (state: D) => void): Promise<D>;
    undo(): Automerge.FreezeObject<T> | undefined;
    redo(): Automerge.FreezeObject<T> | undefined;
}
