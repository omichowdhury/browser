'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Automerge = require('automerge');
var Automerge__default = _interopDefault(Automerge);
var immutable = require('immutable');
var invariant = _interopDefault(require('invariant'));
var lodash = require('lodash');
var manymerge = require('manymerge');
var safeJsonStringify = _interopDefault(require('safe-json-stringify'));
var idbKeyval = require('idb-keyval');
var uuid = _interopDefault(require('uuid/v4'));
var IO = _interopDefault(require('socket.io-client'));
var ky = _interopDefault(require('ky-universal'));

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

// A type of promise-like that resolves synchronously and supports only one observer

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously call a function and send errors to recovery continuation
function _catch(body, recover) {
	try {
		var result = body();
	} catch(e) {
		return recover(e);
	}
	if (result && result.then) {
		return result.then(void 0, recover);
	}
	return result;
}

var ROOM_SERICE_CLIENT_URL = 'https://aws.roomservice.dev';

var Offline = {
  getDoc: function (roomRef, docId) {
    try {
      return Promise.resolve(_catch(function () {
        return Promise.resolve(idbKeyval.get('rs:' + roomRef + '/' + docId));
      }, function (err) {
        console.warn("Something went wrong getting Room Service's state offline", err);
        return '';
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  },
  setDoc: function (roomRef, docId, value) {
    try {
      var _temp2 = _catch(function () {
        return Promise.resolve(idbKeyval.set('rs:' + roomRef + '/' + docId, value)).then(function () {});
      }, function (err) {
        console.warn("Something went wrong saving Room Service's state offline", err);
      });

      return Promise.resolve(_temp2 && _temp2.then ? _temp2.then(function () {}) : void 0);
    } catch (e) {
      return Promise.reject(e);
    }
  },
  getOrCreateActor: function () {
    try {
      !(typeof window !== 'undefined') ? "development" !== "production" ? invariant(false, "getOrCreateActor was used on the server side; this is a bug in the client, if you're seeing this, let us know.") : invariant(false) : void 0;
      return Promise.resolve(_catch(function () {
        return Promise.resolve(idbKeyval.get('rs:actor')).then(function (actor) {
          if (actor) {
            return actor;
          }

          var id = uuid();
          idbKeyval.set('rs:actor', id);
          return id;
        });
      }, function () {
        console.warn('Cant use offline mode in this environment, skipping.');
        return null;
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  }
};

/**
 * This is just a wrapper around Socket.io that's easier
 * to test.
 */

var Sockets = {
  newSocket: function newSocket(url, opts) {
    return IO(url, opts);
  },
  on: function on(socket, event, fn) {
    !(!!socket && !!event) ?  invariant(false, 'Requires socket defined')  : void 0;
    socket.on(event, fn);
  },
  off: function off(socket, event, callback) {
    socket.off(event, callback);
  },
  emit: function emit(socket, event) {
    !(!!socket && !!event) ?  invariant(false, 'Requires socket defined')  : void 0;

    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }

    socket.emit.apply(socket, [event].concat(args));
  },
  disconnect: function disconnect(socket) {
    socket.disconnect();
  }
};

var ListenerManager = /*#__PURE__*/function () {
  function ListenerManager() {
    this._listeners = [];
  }

  var _proto = ListenerManager.prototype;

  _proto.on = function on(socket, event, callback) {
    this._listeners.push({
      event: event,
      callback: callback
    });

    Sockets.on(socket, event, callback);
  };

  _proto.removeAllListeners = function removeAllListeners(socket) {
    this._listeners.forEach(function (listener) {
      Sockets.off(socket, listener.event, listener.callback);
    });

    this._listeners = [];
  };

  return ListenerManager;
}();

var authorizeSocket = function authorizeSocket(socket, token, roomId) {
  try {
    return Promise.resolve(new Promise(function (resolve) {
      !socket ? "development" !== "production" ? invariant(false, 'Requires socket to be defined') : invariant(false) : void 0;
      var listenerManager = new ListenerManager();
      var timeout = setTimeout(function () {
        resolve(false);
        listenerManager.removeAllListeners(socket);
      }, 15000);
      Sockets.emit(socket, 'authenticate', {
        meta: {
          roomId: roomId
        },
        payload: token
      });
      listenerManager.on(socket, 'authenticated', function () {
        clearTimeout(timeout);
        resolve(true);
        listenerManager.removeAllListeners(socket);
      });
      listenerManager.on(socket, 'disconnect', function () {
        resolve();
        clearTimeout(timeout);
        listenerManager.removeAllListeners(socket);
      });
    }));
  } catch (e) {
    return Promise.reject(e);
  }
};

var DOC_NAMESPACE = '/v1/doc';

function asRoomStr(room) {
  return safeJsonStringify(room);
}

var DocClient = /*#__PURE__*/function () {
  function DocClient(parameters) {
    var _this2 = this;

    var _this = this;

    // The manymerge client will call this function when it picks up changes.
    //
    // WARNING: This function is an arrow function specifically because
    // it needs to access this._socket. If you use a regular function,
    // it won't work.
    this._sendMsgToSocket = function (automergeMsg) {
      try {
        // we're offline, so don't do anything
        if (!_this._socket) {
          return Promise.resolve();
        }

        return Promise.resolve(_this._authorized).then(function (isAuthorized) {
          // isAuthorized is undefined if the socket disconnects before we get an answer
          if (!_this._socket || isAuthorized === undefined) {
            return;
          }

          if (isAuthorized === false) {
            console.error('Room Service is unable to authorize');
            return;
          }

          !_this._roomId ? "development" !== "production" ? invariant(false, "Expected a _roomId to exist when publishing. This is a sign of a broken client, if you're seeing this, please contact us.") : invariant(false) : void 0;
          var room = {
            meta: {
              roomId: _this._roomId
            },
            payload: {
              msg: automergeMsg
            }
          };
          Sockets.emit(_this._socket, 'sync_room_state', asRoomStr(room));
        });
      } catch (e) {
        return Promise.reject(e);
      }
    };

    this._roomReference = parameters.roomReference;
    this._defaultDoc = parameters.defaultDoc;
    this._peer = new manymerge.Peer(this._sendMsgToSocket);
    this._socketURL = ROOM_SERICE_CLIENT_URL;
    this._listenerManager = new ListenerManager(); // We define this here so we can debounce the save function
    // Otherwise we'll get quite the performance hit

    var saveOffline = function saveOffline(docId, doc) {
      Offline.setDoc(_this2._roomReference, docId, Automerge.save(doc));
    };

    this._saveOffline = lodash.debounce(saveOffline, 120);
  }

  var _proto = DocClient.prototype;

  _proto.readActorIdThenCreateDoc = function readActorIdThenCreateDoc(state) {
    try {
      var _this4 = this;

      return Promise.resolve(Offline.getOrCreateActor()).then(function (actorId) {
        _this4._actorId = actorId;
        return _this4.createDoc(actorId, state);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.createDoc = function createDoc(actorId, state) {
    if (this._doc) {
      return this._doc;
    }

    var params = actorId ? {
      actorId: actorId
    } : undefined;
    var defaultDoc = Automerge__default.from(state || {}, params); // Automerge technically supports sending multiple docs
    // over the wire at the same time, but for simplicity's sake
    // we just use one doc at for the moment.
    //
    // In the future, we may support multiple documents per room.

    this._doc = defaultDoc;

    this._peer.notify(this._doc);

    return this._doc;
  }
  /**
   * Manually attempt to restore the state from offline storage.
   */
  ;

  _proto.restore = function restore() {
    try {
      var _temp3 = function _temp3() {
        return _this6.syncOfflineCache();
      };

      var _this6 = this;

      // We can't restore on the server, or in environments
      // where indexedb is not defined
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return Promise.resolve({});
      }

      var _temp4 = function () {
        if (!_this6._doc) {
          return Promise.resolve(_this6.readActorIdThenCreateDoc(_this6._defaultDoc)).then(function () {});
        }
      }();

      return Promise.resolve(_temp4 && _temp4.then ? _temp4.then(_temp3) : _temp3(_temp4));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Attempts to go online.
   */
  ;

  _proto.init = function init(_ref) {
    var room = _ref.room,
        session = _ref.session;

    try {
      var _temp11 = function _temp11() {
        var _exit = false;

        function _temp8(_result) {
          if (_exit) return _result;
          _this8._roomId = room.id;
          _this8._socket = Sockets.newSocket(_this8._socketURL + DOC_NAMESPACE, {
            transports: ['websocket']
          });

          _this8._listenerManager.on(_this8._socket, 'reconnect_attempt', function () {
            !_this8._socket ? "development" !== "production" ? invariant(false) : invariant(false) : void 0;
            _this8._socket.io.opts.transports = ['websocket'];
          });
          /**
           * Errors
           */


          _this8._listenerManager.on(_this8._socket, 'error', function (data) {
            try {
              var _JSON$parse = JSON.parse(data),
                  message = _JSON$parse.message;

              console.error("Error from Socket: " + message);
            } catch (err) {
              console.error("Unparsable error from socket: " + data);
            }
          }); // Immediately attempt to authorize via traditional auth


          _this8._authorized = authorizeSocket(_this8._socket, session.token, room.id); // Required connect handler

          _this8._listenerManager.on(_this8._socket, 'connect', function () {
            _this8._peer.notify(_this8._doc);

            _this8.syncOfflineCache();
          }); // Required disconnect handler


          _this8._listenerManager.on(_this8._socket, 'disconnect', function (reason) {
            if (reason === 'io server disconnect') {
              console.warn('The RoomService client was forcibly disconnected from the server, likely due to invalid auth.');
            }
          });
          /**
           * We don't require these to be defined before hand since they're
           * optional
           */


          if (_this8._onUpdateSocketCallback) {
            _this8._listenerManager.on(_this8._socket, 'sync_room_state', _this8._onUpdateSocketCallback);
          }

          if (_this8._onConnectSocketCallback) {
            _this8._listenerManager.on(_this8._socket, 'connect', _this8._onConnectSocketCallback);
          }

          if (_this8._onDisconnectSocketCallback) {
            _this8._listenerManager.on(_this8._socket, 'disconnect', _this8._onDisconnectSocketCallback);
          } // Load the document of the room.


          return Promise.resolve(fetch(_this8._socketURL + ("/client/v1/rooms/" + room.id + "/documents/default"), {
            headers: {
              authorization: 'Bearer ' + session.token
            }
          })).then(function (result) {
            if (result.status !== 200) {
              throw new Error("Unexpectedly did not find document for room " + room.reference);
            }

            return Promise.resolve(result.text()).then(function (roomStateStr) {
              function _temp6() {
                return {
                  doc: state
                };
              }

              // Merge RoomService's online cache with what we have locally
              var state;

              var _temp5 = _catch(function () {
                // NOTE: we purposefully don't define an actor id,
                // since it's not assumed this state is defined by our actor.
                state = Automerge__default.load(roomStateStr);
                return Promise.resolve(_this8.syncOfflineCache()).then(function (local) {
                  state = Automerge.merge(local, state);
                  _this8._doc = state;

                  _this8._peer.notify(_this8._doc);
                });
              }, function (err) {
                console.error(err);
                state = {};
              });

              return _temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5);
            });
          });
        }

        var _temp7 = function () {
          if (!room || !session) {
            return Promise.resolve(_this8.syncOfflineCache()).then(function () {
              _exit = true;
              return {
                doc: _this8._doc
              };
            });
          }
        }();

        // we're offline, so we should just continue with our fun little world
        return _temp7 && _temp7.then ? _temp7.then(_temp8) : _temp8(_temp7);
      };

      var _this8 = this;

      if (typeof window === 'undefined') {
        return Promise.resolve({
          doc: undefined
        });
      }

      var _temp12 = function () {
        if (!_this8._doc) {
          return Promise.resolve(_this8.readActorIdThenCreateDoc(_this8._defaultDoc)).then(function () {});
        }
      }();

      return Promise.resolve(_temp12 && _temp12.then ? _temp12.then(_temp11) : _temp11(_temp12));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /**
   * Manually go offline
   */
  ;

  _proto.disconnect = function disconnect() {
    if (typeof window === 'undefined') {
      console.warn('Attempting to call disconnect on the server, this is a no-op.');
      return;
    }

    if (this._socket) {
      Sockets.disconnect(this._socket); // Remove listeners after disconnect so that
      // disconnect listener gets called

      this._listenerManager.removeAllListeners(this._socket);
    }

    this._onUpdateSocketCallback = undefined;
    this._onConnectSocketCallback = undefined;
    this._onDisconnectSocketCallback = undefined;
    this._socket = undefined;
  };

  _proto.onSetDoc = function onSetDoc(callback) {
    var _this9 = this;

    if (typeof window === 'undefined') {
      console.warn('Attempting to call onSetDoc on the server, this is a no-op.');
      return;
    }

    !!this._onUpdateSocketCallback ?  invariant(false, "It looks like you've called onSetDoc multiple times. Since this can cause quite severe performance issues if used incorrectly, we're not currently supporting this behavior. If you've got a use-case we haven't thought of, file a github issue and we may change this.")  : void 0;

    var socketCallback = function socketCallback(data) {
      try {
        var _temp15 = function _temp15() {
          // convert the payload clock to a map
          payload.msg.clock = immutable.Map(payload.msg.clock);

          try {
            var newDoc = _this9._peer.applyMessage(payload.msg, _this9._doc); // if we don't have any new changes, we don't need to do anything.


            if (!newDoc) {
              return;
            }

            _this9._doc = newDoc;

            _this9._saveOffline('default', _this9._doc); // From a user's perspective, the document should only update
            // if we've actually made changes (since only we care about the
            // clock position of everyone else).


            if (payload.msg.changes) {
              callback(_this9._doc);
            }
          } catch (err) {
            // Ignore Automerge double-apply errors
            if (err.message && err.message.includes('Inconsistent reuse of sequence number')) {
              return;
            }

            console.error(err);
          }
        };

        var _JSON$parse2 = JSON.parse(data),
            meta = _JSON$parse2.meta,
            payload = _JSON$parse2.payload;

        if (!_this9._roomId) {
          throw new Error("Expected a _roomId to be defined before we invoked the the onSetDoc callback. This is a sign of a broken client, please contact us if you're seeing this.");
        } // This socket event will fire for ALL rooms, so we need to check
        // if this callback refers to this particular room.


        if (meta.roomId !== _this9._roomId) {
          return Promise.resolve();
        }

        if (!payload.msg) {
          throw new Error("The room's state object does not include an 'msg' attribute, which could signal a corrupted room. If you're seeing this in production, that's quite bad and represents a fixable bug within the SDK itself. Please let us know and we'll fix it immediately!");
        } // This is effectively impossible tbh, but we like to be cautious


        var _temp16 = function () {
          if (!_this9._doc) {
            return Promise.resolve(_this9.readActorIdThenCreateDoc(_this9._defaultDoc)).then(function () {});
          }
        }();

        return Promise.resolve(_temp16 && _temp16.then ? _temp16.then(_temp15) : _temp15(_temp16));
      } catch (e) {
        return Promise.reject(e);
      }
    }; // If we're offline, just wait till we're back online to assign this callback


    if (!this._socket) {
      this._onUpdateSocketCallback = socketCallback;
      return;
    }

    this._listenerManager.on(this._socket, 'sync_room_state', socketCallback);
  };

  _proto.onConnect = function onConnect(callback) {
    if (typeof window === 'undefined') {
      console.warn('Attempting to call onConnect on the server, this is a no-op.');
      return;
    } // If we're offline, cue this up for later.


    if (!this._socket) {
      this._onConnectSocketCallback = callback;
      return;
    }

    this._listenerManager.on(this._socket, 'connect', callback);
  };

  _proto.onDisconnect = function onDisconnect(callback) {
    if (typeof window === 'undefined') {
      console.warn('Attempting to call onDisconnect on the server, this is a no-op.');
      return;
    } // If we're offline, cue this up for later.


    if (!this._socket) {
      this._onDisconnectSocketCallback = callback;
      return;
    }

    this._listenerManager.on(this._socket, 'disconnect', callback);
  };

  _proto.syncOfflineCache = function syncOfflineCache() {
    try {
      var _this11 = this;

      return Promise.resolve(Offline.getDoc(_this11._roomReference, 'default')).then(function (data) {
        return data ? Promise.resolve(Offline.getOrCreateActor()).then(function (actorId) {
          if (!actorId) {
            console.error("Unexpectedly didn't find offline support in an environment like a browser where we should have offline support.");
          } // We explictly do not add


          var offlineDoc = Automerge.load(data, {
            actorId: actorId
          });
          _this11._doc = offlineDoc;

          _this11._peer.notify(_this11._doc);

          return offlineDoc;
        }) : _this11._doc;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.setDoc = function setDoc(callback) {
    try {
      var _temp19 = function _temp19() {
        if (typeof callback !== 'function') {
          throw new Error("room.publishDoc expects a function.");
        }

        var newDoc = Automerge__default.change(_this13._doc, callback);

        if (!newDoc) {
          !!!_this13._actorId ? "development" !== "production" ? invariant(false, "The client is trying to regenerate a deleted document, but isn't able to access the cached actor id. This is probably a bug in the client, if you see this, we're incredibly sorry! Please let us know. In the meantime, you may be able work around this by ensuring 'await room.restore()' has finished before calling 'publishState'.") : invariant(false) : void 0; // this happens if someone deletes the doc, so we should just reinit it.

          newDoc = _this13.createDoc(_this13._actorId, _this13._defaultDoc);
        }

        _this13._doc = newDoc;

        _this13._saveOffline('default', newDoc);

        _this13._peer.notify(newDoc);

        return newDoc;
      };

      var _this13 = this;

      if (typeof window === 'undefined') {
        console.warn('Attempting to call setDoc on the server, this is a no-op.');
        return Promise.resolve({});
      }

      var _temp20 = function () {
        if (!_this13._doc) {
          return Promise.resolve(_this13.readActorIdThenCreateDoc(_this13._defaultDoc)).then(function (_this12$readActorIdTh) {
            _this13._doc = _this12$readActorIdTh;
          });
        }
      }();

      return Promise.resolve(_temp20 && _temp20.then ? _temp20.then(_temp19) : _temp19(_temp20));
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.undo = function undo() {
    if (this._doc && Automerge__default.canUndo(this._doc)) {
      var newDoc = Automerge__default.undo(this._doc);
      this._doc = newDoc;

      this._saveOffline('default', newDoc);

      this._peer.notify(newDoc);

      return newDoc;
    } else {
      return this._doc;
    }
  };

  _proto.redo = function redo() {
    if (this._doc && Automerge__default.canRedo(this._doc)) {
      var newDoc = Automerge__default.redo(this._doc);
      this._doc = newDoc;

      this._saveOffline('default', newDoc);

      this._peer.notify(newDoc);

      return newDoc;
    } else {
      return this._doc;
    }
  };

  return DocClient;
}();

var PRESENCE_NAMESPACE = '/v1/presence';

function isParsable(val) {
  return typeof val === 'object' && val !== null;
}

var rateLimittedEmit = /*#__PURE__*/lodash.throttle(function (socket, event) {
  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  return Sockets.emit.apply(Sockets, [socket, event].concat(args));
}, 40, {
  leading: true
});

var PresenceClient = /*#__PURE__*/function () {
  function PresenceClient(parameters) {
    this._socketURL = ROOM_SERICE_CLIENT_URL;
    this._authorizationUrl = parameters.authUrl;
    this._roomReference = parameters.roomReference;
  }

  var _proto = PresenceClient.prototype;

  _proto.init = function init(_ref) {
    var _this = this;

    var room = _ref.room,
        session = _ref.session;

    if (!room || !session) {
      console.warn('Room Service is offline.');
      return;
    }

    this._roomId = room.id;
    this._socket = Sockets.newSocket(this._socketURL + PRESENCE_NAMESPACE, {
      transports: ['websocket']
    });
    Sockets.on(this._socket, 'reconnect_attempt', function () {
      !_this._socket ?  invariant(false)  : void 0;
      _this._socket.io.opts.transports = ['websocket'];
    }); // Immediately attempt to authorize via traditional auth

    this._authorized = authorizeSocket(this._socket, session.token, room.id);
  };

  _proto.setPresence = function setPresence(key, value, options) {
    try {
      var _temp3 = function _temp3() {
        var ttl = (options === null || options === void 0 ? void 0 : options.ttl) || 1000 * 2;

        if (!value) {
          console.error("The function call 'setPresence(\"" + key + "\", value)' passed in an undefined, null, or falsey 'value'.");
          return;
        }

        if (!isParsable(value)) {
          console.error("Expected the function call 'setPresence(\"" + key + "\", value)' to use a stringifiable object for variable 'value', instead got '" + value + "'.");
          return;
        }

        var packet = {
          meta: {
            roomId: _this3._roomId,
            createdAt: new Date().getTime(),
            namespace: key,
            ttl: ttl
          },
          payload: value
        };
        rateLimittedEmit(_this3._socket, 'update_presence', packet);
      };

      var _this3 = this;

      // Offline do nothing
      if (!_this3._socket) {
        return Promise.resolve();
      }

      !_this3._roomId ? "development" !== "production" ? invariant(false, "setPresence is missing a roomId, this is likely a bug with the client. If you're seeing this, please contact us.") : invariant(false) : void 0; // Ensure we're authorized before doing anything

      var _temp4 = function () {
        if (_this3._authorized) {
          return Promise.resolve(_this3._authorized).then(function () {});
        }
      }();

      return Promise.resolve(_temp4 && _temp4.then ? _temp4.then(_temp3) : _temp3(_temp4));
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.onSetPresence = function onSetPresence(callback) {
    var _this4 = this;

    // Offline do nothing
    if (!this._socket) {
      console.warn('offline');
      return;
    }

    Sockets.on(this._socket, 'update_presence', function (data) {
      try {
        var _JSON$parse = JSON.parse(data),
            meta = _JSON$parse.meta,
            payload = _JSON$parse.payload;

        if (!_this4._roomId) {
          throw new Error("Expected a _roomId to be defined before we invoked the the onSetPresence callback. This is a sign of a broken client, please contact us if you're seeing this.");
        }

        if (!meta.connectionId) {
          console.error("Unexpectedly got a packet without a connection id. We're skipping this for now, but this could be a sign of a service outage or a broken client.");
        } // Don't include self


        if (meta.connectionId === _this4._socket.id) {
          return Promise.resolve();
        } // This socket event will fire for ALL rooms that we belong
        // to,


        if (meta.roomId !== _this4._roomId) {
          return Promise.resolve();
        }

        callback(meta, payload);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    });
  };

  return PresenceClient;
}();

var authorize = function authorize(authorizationUrl, roomReference, headers) {
  try {
    // Generates and then records a session token
    return Promise.resolve(ky.post(authorizationUrl, {
      json: {
        room: {
          reference: roomReference
        }
      },
      headers: headers || undefined,
      // This only works on sites that have setup DNS,
      // or the debugger on roomservice.dev/app, which
      // uses this SDK.
      credentials: authorizationUrl.includes('https://aws.roomservice.dev') && authorizationUrl.includes('debugger-auth-endpoint') ? 'include' : undefined,
      throwHttpErrors: false
    })).then(function (result) {
      // This is just user error, so it's probably fine to throw here.
      !(result.status !== 405) ? "development" !== "production" ? invariant(false, 'Your authorization endpoint does not appear to accept a POST request.') : invariant(false) : void 0;

      if (result.status < 200 || result.status >= 400) {
        throw new Error("Your Auth endpoint at '" + authorizationUrl + "' is not functioning properly, returned status of " + result.status + ".");
      }

      return Promise.resolve(result.json()).then(function (res) {
        var room = res.room,
            session = res.session;
        return {
          room: room,
          session: session
        };
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

var RoomClient = /*#__PURE__*/function () {
  function RoomClient(parameters) {
    var _this = this;

    this._init = lodash.throttle(function () {
      try {
        var _temp3 = function _temp3() {
          // We're on the server, so we shouldn't init, because we don't need
          // to connect to the clients.
          if (typeof window === 'undefined') {
            // This would signal that the server side can't access the auth endpoint
            if (!room) {
              throw new Error("Room Service can't access the auth endpoint on the server. More details: https://err.sh/getroomservice/browser/server-side-no-network");
            }

            return {
              doc: undefined
            };
          } // Presence client


          _this._presenceClient.init({
            room: room,
            session: session
          }); // Doc client


          return Promise.resolve(_this._docClient.init({
            room: room,
            session: session
          })).then(function (_ref) {
            var doc = _ref.doc;
            return {
              doc: doc
            };
          });
        };

        var room;
        var session;

        var _temp4 = _catch(function () {
          return Promise.resolve(authorize(_this._authorizationUrl, _this._roomReference, _this._headers)).then(function (params) {
            room = params.room;
            session = params.session;
          });
        }, function (err) {
          console.error("Room Service can't access the auth endpoint. More details: https://err.sh/getroomservice/browser/cant-access-auth-endpoint");
          console.warn(err);
        });

        return Promise.resolve(_temp4 && _temp4.then ? _temp4.then(_temp3) : _temp3(_temp4));
      } catch (e) {
        return Promise.reject(e);
      }
    }, 100, {
      leading: true
    });
    this._docClient = new DocClient(parameters);
    this._presenceClient = new PresenceClient(parameters);
    this._authorizationUrl = parameters.authUrl;
    this._roomReference = parameters.roomReference;
    this._headers = parameters.headers;
  } // @ts-ignore used for testing locally


  var _proto = RoomClient.prototype;

  // Start the client, sync from cache, and connect.
  // This function is throttled at 100ms, since it's only
  // supposed to be called once, but
  _proto.init = function init() {
    try {
      var _this3 = this;

      return Promise.resolve(_this3._init());
    } catch (e) {
      return Promise.reject(e);
    }
  } // Manually restore from cache
  ;

  _proto.restore = function restore() {
    try {
      var _this5 = this;

      return Promise.resolve(_this5._docClient.restore());
    } catch (e) {
      return Promise.reject(e);
    }
  } // Connection
  ;

  _proto.onConnect = function onConnect(callback) {
    this._docClient.onConnect(callback);
  };

  _proto.onDisconnect = function onDisconnect(callback) {
    this._docClient.onDisconnect(callback);
  };

  _proto.disconnect = function disconnect() {
    this._docClient.disconnect();
  } // Documents
  ;

  _proto.setDoc = function setDoc(change) {
    try {
      var _this7 = this;

      return Promise.resolve(_this7._docClient.setDoc(change));
    } catch (e) {
      return Promise.reject(e);
    }
  };

  _proto.onSetDoc = function onSetDoc(callback) {
    this._docClient.onSetDoc(callback);
  };

  _proto.undo = function undo() {
    return this._docClient.undo();
  };

  _proto.redo = function redo() {
    return this._docClient.redo();
  } // Presence
  ;

  _proto.setPresence = function setPresence(key, value) {
    this._presenceClient.setPresence(key, value);
  };

  _proto.onSetPresence = function onSetPresence(callback) {
    this._presenceClient.onSetPresence(callback);
  };

  _createClass(RoomClient, [{
    key: "_socketURL",
    set: function set(url) {
      this._docClient._socketURL = url;
      this._presenceClient._socketURL = url;
    }
  }]);

  return RoomClient;
}();

var RoomServiceClient = /*#__PURE__*/function () {
  function RoomServiceClient(parameters) {
    this._roomPool = {};
    this._authorizationUrl = parameters.authUrl;
    this._headers = parameters.headers;
  }

  var _proto = RoomServiceClient.prototype;

  _proto.room = function room(roomReference, defaultDoc) {
    if (this._roomPool[roomReference]) {
      return this._roomPool[roomReference];
    }

    var room = new RoomClient({
      authUrl: this._authorizationUrl,
      roomReference: roomReference,
      defaultDoc: defaultDoc,
      headers: this._headers
    });
    this._roomPool[roomReference] = room;
    return room;
  };

  return RoomServiceClient;
}();

exports.default = RoomServiceClient;
//# sourceMappingURL=browser.cjs.development.js.map
