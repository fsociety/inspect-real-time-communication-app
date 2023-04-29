import React,{ useEffect, useRef, useState, useContext } from 'react'
import { useRouter } from 'next/router'
import SocketIOClient from "socket.io-client";
import adapter from 'webrtc-adapter';
import { publishOwnFeed } from '../utils/janus-utils';
import RemoteVideo from '../components/RemoteVideo';
import LocalVideo from '../components/LocalVideo';
import { ContextProvider } from '../context/Context';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Room() {
    const {query, isReady} = useRouter()
    const { contextData, setContextData } = useContext(ContextProvider)
    const [localVideoDetail, setLocalVideoDetail] = useState(null)
    const [remoteVideos, setRemoteVideos] = useState({})
    const { room } = query;
    var subscriber_mode = (query["subscriber-mode"] === "yes" || query["subscriber-mode"] === "true");
    var sfutest = null;
    var janus = null;

    useEffect(() => {
        if(!isReady) return;
        socketInitializer();
        onJanusLoaded();
    }, [isReady])

    const socketInitializer = () => {

        const socket = SocketIOClient.connect('/', {
            path: `${process.env.NEXT_PUBLIC_SOCKET_URL}`,
        });

        socket.on("connect", () => {
            console.log("SOCKET CONNECTED!", socket.id);
        });

        socket.on('user-disconnected', userId => {
        })
        
    }

    const onJanusLoaded = () => {
        window.adapter = adapter;
        var opaqueId = "videoroomtest-"+Janus.randomString(12);
        var myroom = 1234;	// Demo room
        myroom = parseInt(room);
        var myusername = null;
        var myid = null;
        var mystream = null;
        // We use this other ID just to map our subscriptions to us
        var mypvtid = null;

        var feeds = [];

        Janus.init({debug: "all", callback: function() {
            // Make sure the browser supports WebRTC
            if(!Janus.isWebrtcSupported()) {
                console.log("No WebRTC support... ");
                return;
            }
            // Create session
            janus = new Janus(
                {
                    server: server,
                    iceServers: iceServers,
                    // Should the Janus API require authentication, you can specify either the API secret or user token here too
                    //		token: "mytoken",
                    //	or
                    //		apisecret: "serversecret",
                    success: function() {
                        // Attach to VideoRoom plugin
                        janus.attach(
                            {
                                plugin: "janus.plugin.videoroom",
                                opaqueId: opaqueId,
                                success: async function(pluginHandle) {
                                    sfutest = pluginHandle;
                                    setContextData({
                                        ...contextData,
                                        sfuVideoRoom: sfutest
                                    });
                                    Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
                                    Janus.log("  -- This is a publisher/manager");
                                    // Prepare the username registration
                                    checkVideoRoomExist().then((exist) => {
                                        if(exist === false){
                                            createRoom();
                                        }else{
                                            console.log("The room has already been created. joining the room...");
                                            toast.info("joining the room...");
                                        }
                                    }).catch(err => {
                                        console.log(err);
                                    }).finally(() => {
                                        registerUsername();
                                    });
                                },
                                error: function(error) {
                                    Janus.error("  -- Error attaching plugin...", error);
                                    console.log("Error attaching plugin... " + error);
                                    toast.error(error);
                                },
                                consentDialog: function(on) {
                                    Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                                    if(on) {
                                        navigator.mozGetUserMedia
                                    }
                                },
                                iceState: function(state) {
                                    Janus.log("ICE state changed to " + state);
                                },
                                mediaState: function(medium, on) {
                                    Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                                    toast.info("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                                },
                                webrtcState: function(on) {
                                    Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                                    toast.info("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                                    if(!on)
                                        return;
                                },
                                onmessage: function(msg, jsep) {
                                    Janus.debug(" ::: Got a message (publisher) :::", msg);
                                    var event = msg["videoroom"];
                                    Janus.debug("Event: " + event);
                                    if(event) {
                                        if(event === "joined") {
                                            // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                                            myid = msg["id"];
                                            mypvtid = msg["private_id"];
                                            Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                                            toast.info("Successfully joined room " + msg["room"] + " with ID " + myid);
                                            if(!subscriber_mode) {
                                                publishOwnFeed(sfutest);
                                            }
                                            // Any new feed to attach to?
                                            if(msg["publishers"]) {
                                                var list = msg["publishers"];
                                                Janus.debug("Got a list of available publishers/feeds:", list);
                                                for(var f in list) {
                                                    var id = list[f]["id"];
                                                    var display = list[f]["display"];
                                                    var audio = list[f]["audio_codec"];
                                                    var video = list[f]["video_codec"];
                                                    Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                                                    newRemoteFeed(id, display, audio, video);
                                                }
                                            }
                                        } else if(event === "destroyed") {
                                            // The room has been destroyed
                                            Janus.warn("The room has been destroyed!");
                                            console.log("The room has been destroyed")
                                        } else if(event === "event") {
                                            // Any new feed to attach to?
                                            if(msg["publishers"]) {
                                                var list = msg["publishers"];
                                                Janus.debug("Got a list of available publishers/feeds:", list);
                                                for(var f in list) {
                                                    var id = list[f]["id"];
                                                    var display = list[f]["display"];
                                                    var audio = list[f]["audio_codec"];
                                                    var video = list[f]["video_codec"];
                                                    Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                                                    newRemoteFeed(id, display, audio, video);
                                                }
                                            } else if(msg["leaving"]) {
                                                // One of the publishers has gone away?
                                                var leaving = msg["leaving"];
                                                Janus.log("Publisher left: " + leaving);
                                                var remoteFeed = null;
                                                for(var i=1; i<6; i++) {
                                                    if(feeds[i] && feeds[i].rfid == leaving) {
                                                        remoteFeed = feeds[i];
                                                        break;
                                                    }
                                                }
                                                if(remoteFeed != null) {
                                                    Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                                                    let updatedFeeds = remoteVideos;
                                                    delete updatedFeeds[remoteFeed.rfindex];
                                                    setRemoteVideos(updatedFeeds);
                                                    feeds[remoteFeed.rfindex] = null;
                                                    remoteFeed.detach();
                                                }
                                            } else if(msg["unpublished"]) {
                                                // One of the publishers has unpublished?
                                                var unpublished = msg["unpublished"];
                                                Janus.log("Publisher left: " + unpublished);
                                                if(unpublished === 'ok') {
                                                    // That's us
                                                    sfutest.hangup();
                                                    return;
                                                }
                                                var remoteFeed = null;
                                                for(var i=1; i<6; i++) {
                                                    if(feeds[i] && feeds[i].rfid == unpublished) {
                                                        remoteFeed = feeds[i];
                                                        break;
                                                    }
                                                }
                                                if(remoteFeed != null) {
                                                    Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                                                    let updatedFeeds = remoteVideos;
                                                    delete updatedFeeds[remoteFeed.rfindex];
                                                    setRemoteVideos(updatedFeeds);
                                                    feeds[remoteFeed.rfindex] = null;
                                                    remoteFeed.detach();
                                                }
                                            } else if(msg["error"]) {
                                                if(msg["error_code"] === 426) {
                                                    // This is a "no such room" error: give a more meaningful description
                                                    console.log("This is a no such room");
                                                } else {
                                                    console.log(msg["error"]);
                                                }
                                            }
                                        }
                                    }
                                    if(jsep) {
                                        Janus.debug("Handling SDP as well...", jsep);
                                        sfutest.handleRemoteJsep({ jsep: jsep });
                                        // Check if any of the media we wanted to publish has
                                        // been rejected (e.g., wrong or unsupported codec)
                                        var audio = msg["audio_codec"];
                                        if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                                            // Audio has been rejected
                                            toast.warn("Our audio stream has been rejected, viewers won't hear us");
                                        }
                                        var video = msg["video_codec"];
                                        if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                                            // Video has been rejected
                                            toast.warn("Our video stream has been rejected, viewers won't see us");
                                            // Hide the webcam video
                                            setLocalVideoDetail({
                                                ...localVideoDetail,
                                                message: "Video rejected, no webcam"
                                            })
                                        }
                                    }
                                },
                                onlocalstream: function(stream) {
                                    Janus.debug(" ::: Got a local stream :::", stream);
                                    mystream = stream;
                                    const streamInfo = {};
                                    streamInfo.publisher = myusername;
                                    streamInfo.stream = stream;
                                    if(sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
                                            sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
                                                console.log("local video Publishing...")
                                    }
                                    setLocalVideoDetail(streamInfo);
                                },
                                onremotestream: function(stream) {
                                    // The publisher stream is sendonly, we don't expect anything here
                                },
                                oncleanup: function() {
                                    Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
                                    mystream = null;
                                }
                            });
                    },
                    error: function(error) {
                        Janus.error(error);
                        console.log(error);
                    },
                    destroyed: function() {
                        window.location.reload();
                    }
                });
        }});

        function registerUsername() {
            var username = 'user-'+Janus.randomString(12);
            var register = {
                request: "join",
                room: myroom,
                ptype: "publisher",
                display: username
            };
            myusername = username;
            sfutest.send({ message: register });
            console.log(myroom + " room - joined");
        }

        function createRoom() {
            let createRoomRequest = {
                request: "create",
                room: myroom,
                description: "example room",
                is_private:false,
            };
            myroom = parseInt(room);
            sfutest.send({ message: createRoomRequest });
            console.log(room + " room created");
        }

        const checkVideoRoomExist = () => {
            return new Promise((resolve,reject) => {
                let request = {
                    request: "exists",
                    room: myroom
                };
                const successCallback = (res) => {
                    if(res.videoroom === "success"){
                        resolve(res.exists);
                    }else{
                        reject();
                    }
                }
                const errorCallback = (err) => {
                    reject(err);
                }
                sfutest.send({ message: request, success: successCallback, error: errorCallback});
            });
        }

        function newRemoteFeed(id, display, audio, video) {
            // A new feed has been published, create a new plugin handle and attach to it as a subscriber
            var remoteFeed = null;
            janus.attach(
                {
                    plugin: "janus.plugin.videoroom",
                    opaqueId: opaqueId,
                    success: function(pluginHandle) {
                        remoteFeed = pluginHandle;
                        remoteFeed.simulcastStarted = false;
                        Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                        Janus.log("  -- This is a subscriber");
                        // We wait for the plugin to send us an offer
                        var subscribe = {
                            request: "join",
                            room: myroom,
                            ptype: "subscriber",
                            feed: id,
                            private_id: mypvtid
                        };
                        // In case you don't want to receive audio, video or data, even if the
                        // publisher is sending them, set the 'offer_audio', 'offer_video' or
                        // 'offer_data' properties to false (they're true by default), e.g.:
                        // 		subscribe["offer_video"] = false;
                        // For example, if the publisher is VP8 and this is Safari, let's avoid video
                        if(Janus.webRTCAdapter.browserDetails.browser === "safari" &&
                                (video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
                            if(video)
                                video = video.toUpperCase()
                            console.warn("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
                            subscribe["offer_video"] = false;
                        }
                        remoteFeed.videoCodec = video;
                        remoteFeed.send({ message: subscribe });
                    },
                    error: function(error) {
                        Janus.error("  -- Error attaching plugin...", error);
                        console.log("Error attaching plugin... " + error);
                    },
                    onmessage: function(msg, jsep) {
                        Janus.debug(" ::: Got a message (subscriber) :::", msg);
                        var event = msg["videoroom"];
                        Janus.debug("Event: " + event);
                        if(msg["error"]) {
                            console.log(msg["error"]);
                        } else if(event) {
                            if(event === "attached") {
                                // Subscriber created and attached
                                for(var i=1;i<6;i++) {
                                    if(!feeds[i]) {
                                        feeds[i] = remoteFeed;
                                        remoteFeed.rfindex = i;
                                        break;
                                    }
                                }
                                remoteFeed.rfid = msg["id"];
                                remoteFeed.rfdisplay = msg["display"];
                                Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
                            } else if(event === "event") {
                                // Check if we got a simulcast-related event from this publisher
                                var substream = msg["substream"];
                                var temporal = msg["temporal"];
                                if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                                    if(!remoteFeed.simulcastStarted) {
                                        remoteFeed.simulcastStarted = true;
                                        // Add some new buttons
                                        addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
                                    }
                                    // We just received notice that there's been a switch, update the buttons
                                    updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
                                }
                            } else {
                                // What has just happened?
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
                                        var body = { request: "start", room: myroom };
                                        remoteFeed.send({ message: body, jsep: jsep });
                                    },
                                    error: function(error) {
                                        Janus.error("WebRTC error:", error);
                                        console.log("WebRTC error... " + error.message);
                                    }
                                });
                        }
                    },
                    iceState: function(state) {
                        Janus.log("ICE state of this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") changed to " + state);
                    },
                    webrtcState: function(on) {
                        Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
                    },
                    onlocalstream: function(stream) {
                        // The subscriber stream is recvonly, we don't expect anything here
                    },
                    onremotestream: function(stream) {
                        Janus.debug("Remote feed #" + remoteFeed.rfindex + ", stream:", stream);
                        console.info("Remote feed #" + remoteFeed.rfindex + ", stream:", stream);
                        if(remoteVideos[remoteFeed.rfindex] === undefined){
                            let remoteStreamInfo = {
                                rfindex: remoteFeed.rfindex,
                                rfdisplay: remoteFeed.rfdisplay,
                                stream: stream,
                                remoteFeed: remoteFeed
                            };
                            setRemoteVideos(prevRemotes => {
                                return {
                                    ...prevRemotes,
                                    [remoteFeed.rfindex]: remoteStreamInfo
                                }
                            });
                        }
                    },
                    oncleanup: function() {
                        Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                        remoteFeed.simulcastStarted = false;
                    }
                });
        }
    }

    return (
        <>
        <div className='text-white video-grid' id="videos">

        {!subscriber_mode && (
            <LocalVideo videoDetail={localVideoDetail} />
        )}

        {Object.values(remoteVideos).map((remoteDetail,index) => {
            return <RemoteVideo key={index} videoDetail={remoteDetail} showBitrate={true} />
        })}

        </div>
        <ToastContainer autoClose={3000} />
        </>
    )
}
