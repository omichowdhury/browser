import RoomClient from './room-client';
import { Obj } from './types';
export default class RoomServiceClient {
    private readonly _authorizationUrl;
    private readonly _headers?;
    private readonly _roomPool;
    constructor(parameters: {
        authUrl: string;
        headers?: Headers;
    });
    room<T extends Obj>(roomReference: string, defaultDoc?: T): RoomClient;
}
