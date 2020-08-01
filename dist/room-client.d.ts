/// <reference types="automerge" />
import { PresenceMeta } from './presence-client';
import { Obj } from './types';
interface RoomClientParameters {
    authUrl: string;
    roomReference: string;
    headers?: Headers;
    defaultDoc?: Obj;
}
export default class RoomClient {
    private readonly _docClient;
    private readonly _presenceClient;
    private readonly _authorizationUrl;
    private readonly _roomReference;
    private readonly _headers?;
    constructor(parameters: RoomClientParameters);
    private set _socketURL(value);
    private _init;
    init(): Promise<Obj>;
    restore(): Promise<any>;
    onConnect(callback: () => void): void;
    onDisconnect(callback: () => void): void;
    disconnect(): void;
    setDoc<D extends Obj>(change: (prevDoc: D) => void): Promise<Readonly<D>>;
    onSetDoc<D extends Obj>(callback: (newDoc: D) => void): void;
    undo(): import("automerge").FreezeObject<Obj> | undefined;
    redo(): import("automerge").FreezeObject<Obj> | undefined;
    setPresence<P extends Obj>(key: string, value: P): void;
    onSetPresence<P extends Obj>(callback: (meta: PresenceMeta, value: P) => void): void;
}
export {};
