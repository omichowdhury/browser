interface RoomValue {
    id: string;
    reference: string;
}
export default function authorize(authorizationUrl: string, roomReference: string, headers?: Headers): Promise<{
    room: RoomValue;
    session: {
        token: string;
    };
}>;
export {};
