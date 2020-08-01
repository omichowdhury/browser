/**
 * Fake sockets implemented as Node events
 * to test the client.
 */
/// <reference types="node" />
import Emitter from 'events';
export declare const injectFakeSocket: () => Emitter;
