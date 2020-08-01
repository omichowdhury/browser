import nock from 'nock';
export declare const DUMMY_PATH = "/api/roomservice";
export declare const DUMMY_URL = "https://coolsite.com";
export declare const DUMMY_ROOM: {
    id: string;
    reference: string;
    state: string;
};
export declare const DUMMY_SESSION: {
    token: string;
};
export declare function mockAuthEndpoint(): nock.Scope;
