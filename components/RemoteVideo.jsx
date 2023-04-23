import React,{useRef, useContext, useEffect, useState} from 'react'
import { ContextProvider } from '../context/Context';

export default function RemoteVideo({videoDetail,showBitrate}) {
  const { contextData } = useContext(ContextProvider)
  const [webcam, setWebcam] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [curres, setCurres] = useState({})
  const [bitrate, setBitrate] = useState(null)
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if(videoDetail){
      Janus.attachMediaStream(remoteVideoRef.current, videoDetail.stream);
      let videoTracks = videoDetail.stream.getVideoTracks();
      if(!videoTracks || videoTracks.length === 0) {
          // No remote video
          setWebcam(false)
      } else {
          setWebcam(true);
      }
      if(showBitrate){
        if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
                Janus.webRTCAdapter.browserDetails.browser === "safari") {
            setInterval(function() {
                // Display updated bitrate, if supported
                var bitrate = videoDetail.remoteFeed.getBitrate();
                setBitrate(bitrate);
                // Check if the resolution changed too
                if(remoteVideoRef.current && remoteVideoRef.current.videoWidth){
                  setCurres({
                    width: remoteVideoRef.current.videoWidth,
                    height: remoteVideoRef.current.videoHeight
                  })
                }
            }, 1000);
        }
      }
    }
  }, [videoDetail,showBitrate])

  const playHandler = () => {
    setCurres({
      width: remoteVideoRef.current.videoWidth,
      height: remoteVideoRef.current.videoHeight
    })
    /*
    if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
        // Firefox Stable has a bug: width and height are not immediately available after a playing
        setTimeout(function() {
          setCurres({
            width: remoteVideoRef.current.videoWidth,
            height: remoteVideoRef.current.videoHeight
          })
        }, 2000);
    }
    */
  }

  return (
    <div className='gap-2 grid-item'>
      {videoDetail ? (
        <div className='relative group'>
            {webcam ? (
              <video 
              ref={remoteVideoRef}
              onPlay={playHandler}
              onLoadedMetadata={() => remoteVideoRef.current.play()}
              autoPlay
              playsInline
              className='object-contain max-w-full max-h-full'
              ></video>
            ): <span>No remote video available</span>}
            
            <div className='absolute bottom-0 left-0 right-0 flex justify-between gap-1 px-4 py-8 transition-all duration-500 opacity-0 bg-gradient-to-t from-black/80 group-hover:opacity-100'>
                <button className="px-3 py-1 text-sm rounded-sm btn-1">Mute</button>
                <span>{curres.width}x{curres.height}</span>
                {showBitrate && (
                  <span>Bitrate: {bitrate}</span>
                )}
                <button className="px-3 py-1 text-sm rounded-sm btn-1">Unpublish</button>
            </div>
        </div>
      ) : <>loading...</>}
    </div>
  )
}