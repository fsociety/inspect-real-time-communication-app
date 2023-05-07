import React, { useState, useEffect, useContext } from "react";
import { ContextProvider } from "../context/Context";
import adapter from "webrtc-adapter";
import { toast } from "react-toastify";
import { checkVideoRoomExist, createRoom, publisherJoin, publishOwnFeed, newRemoteFeed } from "../utils/janus-utils";

export default function SfuVideoRoom({ room, remoteFeeds: rf, options }) {
    const { remoteFeeds, setRemoteFeeds } = rf;
    const [event, setEvent] = useState({});
    const [loading, setLoading] = useState(true);
    const { contextData, setContextData } = useContext(ContextProvider);
    const opaqueId = "videoroom-" + Janus.randomString(12);
    let JanusIns;

    useEffect(() => {
        if(JanusIns) return;
        window.adapter = adapter;
        let videoRoom;
        
        Janus.init({
            debug: "all",
            callback: function () {
                // Make sure the browser supports WebRTC
                if (!Janus.isWebrtcSupported()) {
                    toast.error("No WebRTC support... ");
                    return;
                }
                // Create session
                Janus.log("Janus Initialized!");
                JanusIns = new Janus({
                    server: options.server,
                    iceServers: options.iceServers,
                    success: function () {
                        Janus.log("New Janus instance created!");
                        setLoading(false);
                        JanusIns.attach({
                            plugin: "janus.plugin.videoroom",
                            opaqueId: opaqueId,
                            success: async function (pluginHandle) {
                                videoRoom = pluginHandle;
                                setContextData(prevData => {
                                    return {
                                        ...prevData,
                                        sfuVideoRoom: videoRoom,
                                    };
                                });
                                Janus.log(
                                    "Plugin attached! (" +
                                        pluginHandle.getPlugin() +
                                        ", id=" +
                                        pluginHandle.getId() +
                                        ")"
                                );
                                Janus.log("  -- This is a publisher/manager");
                                // checking if there is room. join if any, otherwise create it
                                // and add the publisher to the room
                                try {
                                    const exist = await checkVideoRoomExist(pluginHandle, room);
                                    if (exist === false) {
                                        createRoom(pluginHandle, room);
                                    } else {
                                        console.log("The room has already been created. joining the room...");
                                        toast.info("joining the room...");
                                    }
                                } catch (error) {
                                    console.log(error);
                                } finally {
                                    await publisherJoin(pluginHandle, room);
                                }
                            },
                            error: function (error) {
                                Janus.error("  -- Error attaching plugin...", error);
                                console.log("Error attaching plugin... " + error);
                                toast.error(error);
                            },
                            onmessage: async function (msg, jsep) {
                                Janus.debug(" ::: Got a message (publisher) :::", msg);
                                console.log(" ::: Got a message (publisher) :::", msg);
                                let { videoroom: event, id, private_id, room, publishers, leaving, unpublished, error, error_code, audio_codec, video_codec } = msg;
                                Janus.debug("Event: " + event);
                                if (event) {
                                    switch (event) {
                                        case "joined":
                                            // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                                            Janus.log("Successfully joined room " + room + " with ID " + id);
                                            toast.info("Successfully joined room " + room + " with ID " + id);
                                            if (!options.subscriber_mode) publishOwnFeed(videoRoom);
                                            // Any new feed to attach to?
                                            if (publishers && publishers.length > 0) {
                                                Janus.debug("joined - Got a list of available publishers/feeds:", publishers);
                                                console.log("joined - Got a list of available publishers/feeds", publishers);
                                                for (let f in publishers) {
                                                    let id = publishers[f]["id"];
                                                    let display = publishers[f]["display"];
                                                    let audio = publishers[f]["audio_codec"];
                                                    let video = publishers[f]["video_codec"];
                                                    Janus.debug(
                                                        "  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")"
                                                    );
                                                    let remoteFeed = await newRemoteFeed({
                                                        janus: JanusIns,
                                                        room: room,
                                                        id: id,
                                                        opaqueId: opaqueId,
                                                        private_id: private_id,
                                                        display: display,
                                                        audio: audio,
                                                        video: video,
                                                    });
                                                    if (!remoteFeeds.includes(remoteFeed)) {
                                                        setRemoteFeeds(prevRemotes => [...prevRemotes, remoteFeed]);
                                                    }
                                                }
                                            }
                                            break;
                                        case "destroyed":
                                            // The room has been destroyed
                                            Janus.warn("The room has been destroyed!");
                                            console.log("The room has been destroyed");
                                            break;
                                        case "event":
                                            if (publishers && publishers.length > 0) {
                                                Janus.debug("Event - Got a list of available publishers/feeds:", publishers);
                                                console.log("Event - Got a list of available publishers/feeds:", publishers);
                                                for (let f in publishers) {
                                                    let id = publishers[f]["id"];
                                                    let display = publishers[f]["display"];
                                                    let audio = publishers[f]["audio_codec"];
                                                    let video = publishers[f]["video_codec"];
                                                    Janus.debug(
                                                        "  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")"
                                                    );
                                                    let remoteFeed = await newRemoteFeed({
                                                        janus: JanusIns,
                                                        room: room,
                                                        id: id,
                                                        opaqueId: opaqueId,
                                                        private_id: private_id,
                                                        display: display,
                                                        audio: audio,
                                                        video: video,
                                                    });
                                                    if (!remoteFeeds.includes(remoteFeed)) {
                                                        setRemoteFeeds(prevRemotes => [...prevRemotes, remoteFeed]);
                                                    }
                                                }
                                            } else if (leaving) {
                                                Janus.log("Publisher left: " + leaving);
                                                setEvent({
                                                    type: 'leaving',
                                                    rfid: leaving
                                                })
                                            }else if(unpublished){
                                                Janus.log("Publisher left: " + unpublished);
                                                if(unpublished === 'ok') {
                                                    // That's us
                                                    videoRoom.hangup();
                                                    return;
                                                }
                                                setEvent({
                                                    type: 'unpublished',
                                                    rfid: unpublished
                                                })
                                            }else if(error){
                                                if(error_code === 426) {
                                                    // This is a "no such room" error: give a more meaningful description
                                                    console.log("This is a no such room");
                                                } else {
                                                    console.log(error);
                                                }
                                            }
                                            break;
                                        default:
                                            console.log("unhanled event!");
                                            break;
                                    }
                                }
                                if (jsep) {
                                    Janus.debug("Handling SDP as well...", jsep);
                                    videoRoom.handleRemoteJsep({ jsep: jsep });
                                    // Check if any of the media we wanted to publish has
                                    // been rejected (e.g., wrong or unsupported codec)
                                    let audio = audio_codec;
                                    let mystream = videoRoom.webrtcStuff.myStream;
                                    if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                                        // Audio has been rejected
                                        toast.warn("Our audio stream has been rejected, viewers won't hear us");
                                    }
                                    let video = video_codec;
                                    if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                                        // Video has been rejected
                                        toast.warn("Our video stream has been rejected, viewers won't see us");
                                        // Hide the webcam video
                                        setContextData(prevData => {
                                            return {
                                                ...prevData,
                                                sfuVideoRoom: {
                                                    ...videoRoom,
                                                    message: "Video rejected, no webcam"
                                                },
                                            };
                                        });
                                    }
                                }
                            }
                        });
                    },
                    error: function (error) {
                        Janus.error(error);
                        console.log(error);
                    },
                    destroyed: function () {
                        window.location.reload();
                    }
                });
            },
        });
    }, []);

    useEffect(() => {
        let remoteFeed;
        switch (event.type) {
        case 'leaving':
            remoteFeed = remoteFeeds.find(r => r.rfid === Number(event.rfid));
            if(remoteFeed) {
                Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                setRemoteFeeds(remoteFeeds.filter(rf => rf !== remoteFeed));
                remoteFeed.detach();
            }
            break;
        case 'unpublished':
            remoteFeed = remoteFeeds.find(r => r.rfid === Number(event.rfid));
            if(remoteFeed) {
                Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                setRemoteFeeds(remoteFeeds.filter(rf => rf !== remoteFeed));
                remoteFeed.detach();
            }
            break;
        
        default:
            break;
        }
    }, [event])

    return loading && <>Loading...</>;
}
