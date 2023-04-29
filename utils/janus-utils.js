function publishOwnFeed(sfuVideoRoom, extraOptions = {}) {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const options = {
        useAudio:true,
        doSimulcast: params.get("simulcast") === "yes" || params.get("simulcast") === "true",
        acodec: params.get("acodec"),
        vcodec: params.get("vcodec"),
        doDtx: params.get("dtx") === "yes" || params.get("dtx") === "true",
        ...extraOptions
    }
    // Publish our stream
    sfuVideoRoom.createOffer(
        {
            // Add data:true here if you want to publish datachannels as well
            media: { audioRecv: false, videoRecv: false, audioSend: options.useAudio, videoSend: true },	// Publishers are sendonly
            // If you want to test simulcasting (Chrome and Firefox only), then
            // pass a ?simulcast=true when opening this demo page: it will turn
            // the following 'simulcast' property to pass to janus.js to true
            simulcast: options.doSimulcast,
            customizeSdp: function(jsep) {
                // If DTX is enabled, munge the SDP
                if(options.doDtx) {
                    jsep.sdp = jsep.sdp
                        .replace("useinbandfec=1", "useinbandfec=1;usedtx=1")
                }
            },
            success: function(jsep) {
                Janus.debug("Got publisher SDP!", jsep);
                var publish = { request: "configure", audio: options.useAudio, video: true };
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
                if(options.acodec)
                    publish["audiocodec"] = options.acodec;
                if(options.vcodec)
                    publish["videocodec"] = options.vcodec;
                    sfuVideoRoom.send({ message: publish, jsep: jsep });
            },
            error: function(error) {
                Janus.error("WebRTC error:", error);
                if(options.useAudio) {
                     publishOwnFeed(false);
                } else {
                    console.log("WebRTC error... " + error.message);
                    //$('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
                }
            }
        });
}

export {
    publishOwnFeed
}