/**
 * A wrapper around idb-keyval to make the
 * "set" and "get" functions more explicit and
 * readable.
 */
interface IOffline {
    getDoc: (roomRef: string, docId: string) => Promise<string>;
    setDoc: (roomRef: string, docId: string, value: string) => Promise<any>;
    getOrCreateActor: () => Promise<string | null>;
}
declare const Offline: IOffline;
export default Offline;
