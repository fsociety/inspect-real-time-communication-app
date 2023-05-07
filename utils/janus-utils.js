const publishOwnFeed = (sfuVideoRoom, extraOptions = {}) => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const options = {
        useAudio: true,
        doSimulcast: params.get('simulcast') === 'yes' || params.get('simulcast') === 'true',
        acodec: params.get('acodec'),
        vcodec: params.get('vcodec'),
        doDtx: params.get('dtx') === 'yes' || params.get('dtx') === 'true',
        ...extraOptions
    };
    // Publish our stream
    if (sfuVideoRoom) {
        sfuVideoRoom.createOffer({
            // Add data:true here if you want to publish datachannels as well
            media: { audioRecv: false, videoRecv: false, audioSend: options.useAudio, videoSend: true }, // Publishers are sendonly
            // If you want to test simulcasting (Chrome and Firefox only), then
            // pass a ?simulcast=true when opening this demo page: it will turn
            // the following 'simulcast' property to pass to janus.js to true
            simulcast: options.doSimulcast,
            customizeSdp: function (jsep) {
                // If DTX is enabled, munge the SDP
                if (options.doDtx) {
                    jsep.sdp = jsep.sdp.replace('useinbandfec=1', 'useinbandfec=1;usedtx=1');
                }
            },
            success: function (jsep) {
                Janus.debug('Got publisher SDP!', jsep);
                var publish = { request: 'configure', audio: options.useAudio, video: true };
                // You can force a specific codec to use when publishing by using the
                // audiocodec and videocodec properties, for instance:
                // 		publish["audiocodec"] = "opus"
                // to force Opus as the audio codec to use, or:
                // 		publish["videocodec"] = "vp9"
                // to force VP9 as the videocodec to use. In both case, though, forcing
                // a codec will only work if: (1) the codec is actually in the SDP (and
                // so the browser supports it), and (2) the codec is in the list of
                // allowed codecs in a room. With respect to the point (2) above,
                // refer to the text in janus.plugin.videoroom.jcfg for more details.
                // We allow people to specify a codec via query string, for demo purposes
                if (options.acodec) publish['audiocodec'] = options.acodec;
                if (options.vcodec) publish['videocodec'] = options.vcodec;
                sfuVideoRoom.send({ message: publish, jsep: jsep });
            },
            error: function (error) {
                Janus.error('WebRTC error:', error);
                if (options.useAudio) {
                    publishOwnFeed(false);
                } else {
                    console.log('WebRTC error... ' + error.message);
                }
            }
        });
    }
};

const checkVideoRoomExist = (sfuVideoRoom, room) => {
    return new Promise((resolve, reject) => {
        let request = {
            request: 'exists',
            room: room
        };
        const successCallback = res => {
            if (res.videoroom === 'success') {
                resolve(res.exists);
            } else {
                reject();
            }
        };
        const errorCallback = err => {
            reject(err);
        };
        sfuVideoRoom.send({ message: request, success: successCallback, error: errorCallback });
    });
};

const createRoom = (sfuVideoRoom, room) => {
    let createRoomRequest = {
        request: 'create',
        room: room,
        description: 'example room',
        is_private: false
    };
    sfuVideoRoom.send({ message: createRoomRequest });
    console.log(room + ' room created');
};

const publisherJoin = (sfuVideoRoom, room) => {
    return new Promise((resolve, reject) => {
        const successCallback = () => {
            resolve(register);
            console.log('Successfully joined room, room: ' + room);
        };
        const errorCallback = err => {
            reject(err);
            console.log("Can't join the room, Room: " + room);
        };
        var username = 'user-' + Janus.randomString(12);
        var register = {
            request: 'join',
            room: room,
            ptype: 'publisher',
            display: username
        };
        sfuVideoRoom.send({ message: register, success: successCallback, error: errorCallback });
    });
};

const newRemoteFeed = ({ janus, room, id, opaqueId, private_id, display, audio, video }) => {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    let remoteFeed;
    return new Promise((resolve, reject) => {
        janus.attach({
            plugin: 'janus.plugin.videoroom',
            opaqueId: opaqueId,
            success: function (pluginHandle) {
                remoteFeed = pluginHandle;
                remoteFeed.simulcastStarted = false;
                Janus.log('Plugin attached! (' + remoteFeed.getPlugin() + ', id=' + remoteFeed.getId() + ')');
                Janus.log('  -- This is a subscriber');
                // We wait for the plugin to send us an offer
                var subscribe = {
                    request: 'join',
                    room: room,
                    ptype: 'subscriber',
                    feed: id,
                    private_id: private_id
                };
                // In case you don't want to receive audio, video or data, even if the
                // publisher is sending them, set the 'offer_audio', 'offer_video' or
                // 'offer_data' properties to false (they're true by default), e.g.:
                // 		subscribe["offer_video"] = false;
                // For example, if the publisher is VP8 and this is Safari, let's avoid video
                if (
                    Janus.webRTCAdapter.browserDetails.browser === 'safari' &&
                    (video === 'vp9' || (video === 'vp8' && !Janus.safariVp8))
                ) {
                    video = video.toUpperCase();
                    console.warn('Publisher is using ' + video + ", but Safari doesn't support it: disabling video");
                    subscribe.offer_video = false;
                }
                remoteFeed.videoCodec = video;

                const successCallback = () => {
                    Janus.log('subscriber successfully joined the room');
                };

                const errorCallback = error => {
                    Janus.log('Something went wrong while subscriber joining the room', error);
                    reject(error);
                };

                remoteFeed.send({ message: subscribe, success: successCallback, error: errorCallback });
            },
            error: function (error) {
                Janus.error('  -- Error attaching plugin...', error);
                console.log('Error attaching plugin... ' + error);
                reject(error);
            },
            onmessage: (msg, jsep) => {
                let { videoroom: event, id, room, error, display, substream, temporal } = msg;
                Janus.debug(" ::: Got a message (subscriber) :::", msg);
                console.log(" ::: Got a message (subscriber) :::", msg);
                Janus.debug("Event: " + event);
                if(error) {
                    console.log(error);
                } else if(event) {
                  switch (event) {
                    case "attached":
                      // Subscriber created and attached
                      remoteFeed.rfid = id;
                      remoteFeed.rfdisplay = display;
                      
                      Janus.log("Successfully attached to feed " + id + " (" + display + ") in room " + room);
                      resolve(remoteFeed);
                      break;
                    case "event":
                      // Check if we got a simulcast-related event from this publisher
                      if(substream || temporal) {
                        if(!remoteFeed.simulcastStarted) {
                            remoteFeed.simulcastStarted = true;
                            // Add some new buttons
                            //addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
                        }
                        // We just received notice that there's been a switch, update the buttons
                        //updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
                      }
                      break;
                    default:
                      // What has just happened?
                      break;
                  }
                }
                if(jsep) {
                    Janus.debug("Handling SDP as well...", jsep);
                    var stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
                    // Answer and attach
                    remoteFeed.createAnswer(
                        {
                            jsep: jsep,
                            // Add data:true here if you want to subscribe to datachannels as well
                            // (obviously only works if the publisher offered them in the first place)
                            media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                            customizeSdp: function(jsep) {
                                if(stereo && jsep.sdp.indexOf("stereo=1") == -1) {
                                    // Make sure that our offer contains stereo too
                                    jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
                                }
                            },
                            success: function(jsep) {
                                Janus.debug("Got SDP!", jsep);
                                var body = { request: "start", room: room };
                                remoteFeed.send({ message: body, jsep: jsep });
                            },
                            error: function(error) {
                                Janus.error("WebRTC error:", error);
                                console.log("WebRTC error... " + error.message);
                            }
                        });
                }
            },
            iceState: (state) => {
                Janus.log("ICE state of this WebRTC PeerConnection (feed #" + remoteFeed.rfid + ") changed to " + state);
            },
            webrtcState: (on) => {
                Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfid + ") is " + (on ? "up" : "down") + " now");
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                remoteFeed.simulcastStarted = false;
            }
        });
    });
};

export { publishOwnFeed, checkVideoRoomExist, createRoom, publisherJoin, newRemoteFeed };
