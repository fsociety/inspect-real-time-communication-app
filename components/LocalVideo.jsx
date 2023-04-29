import React,
{ 
  useRef, 
  useContext, 
  useEffect, 
  useState
} from 'react';
import { publishOwnFeed } from '../utils/janus-utils';
import { useRouter } from 'next/router'
import { toast } from 'react-toastify';
import Select from 'react-select';
import { ContextProvider } from '../context/Context';

export default function LocalVideo({videoDetail}) {
  const {query} = useRouter()
  const { contextData } = useContext(ContextProvider)
  const [webcam, setWebcam] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isPublished, setIsPublished] = useState(true);
  const localVideoRef = useRef(null);

  const bitrates = [
    { value: 0, label: 'No limit' },
    { value: 128, label: 'Cap to 128kbit' },
    { value: 256, label: 'Cap to 128kbit' },
    { value: 512, label: 'Cap to 512kbit' },
    { value: 1024, label: 'Cap to 1mbit' },
    { value: 1500, label: 'Cap to 1.5mbit' },
    { value: 2000, label: 'Cap to 2mbit' },
  ];

  const options = {
      doSimulcast: query.simulcast === "yes" || query.simulcast === "true",
      doDtx: query.acodec !== "" ? query.acodec : null,
      acodec: query.vcodec !== "" ? query.vcodec : null,
      vcodec: query.dtx === "yes" || query.dtx === "true"
  }

  useEffect(() => {
    if(videoDetail){
      Janus.attachMediaStream(localVideoRef.current, videoDetail.stream);
      let videoTracks = videoDetail.stream.getVideoTracks();
      if(!videoTracks || videoTracks.length === 0) {
        // No webcam
        setWebcam(false);
      } else {
        setWebcam(true);
      }
    }
  }, [videoDetail])

  function toggleMute() {
    var muted = contextData.sfuVideoRoom.isAudioMuted();
    Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
    if(muted)
      contextData.sfuVideoRoom.unmuteAudio();
    else
      contextData.sfuVideoRoom.muteAudio();

    muted = contextData.sfuVideoRoom.isAudioMuted();
    setIsMuted(muted);
  }

  function unpublishOwnFeed() {
      // Unpublish our stream
      var unpublish = { request: "unpublish" };
      contextData.sfuVideoRoom.send({ message: unpublish });
  }

  const handleChangeBitrate = ({value}) => {
    let bitrate = parseInt(value)*1000;
    if(bitrate === 0) {
        Janus.log("Not limiting bandwidth via REMB");
        toast.info("Not limiting bandwidth via REMB")
    } else {
        Janus.log("Capping bandwidth to " + bitrate + " via REMB");
        toast.info("Capping bandwidth to " + bitrate + " via REMB")
    }
    contextData.sfuVideoRoom.send({ message: { request: "configure", bitrate: bitrate }});
  }

  const togglePublish = (e) => {
    if(isPublished){
      unpublishOwnFeed();
      e.currentTarget.textContent = 'Publish';
    }else{
      publishOwnFeed(contextData.sfuVideoRoom);
      e.currentTarget.textContent = 'Unpublish';
    }
    setIsPublished(!isPublished);
  }
  
  return (
    <div className='gap-2 grid-item'>
      {videoDetail ? (
        <div className='relative group'>
            {webcam ? (
              <video 
              ref={localVideoRef}
              onLoadedMetadata={() => localVideoRef.current.play()}
              autoPlay
              playsInline
              muted
              className='object-contain max-w-full max-h-full'></video>
            ) : <span>No webcam available</span>}

            <div className='absolute bottom-0 left-0 right-0 flex justify-between gap-1 px-4 py-8 transition-all duration-500 opacity-0 bg-gradient-to-t from-black/80 group-hover:opacity-100'>
                <button 
                onClick={toggleMute}
                className="px-3 py-1 text-sm rounded-sm btn-1">
                  {isMuted ? 'unmute' : 'mute'}
                </button>
                <span 
                className='font-bold'
                id='publisher'>
                  {videoDetail.publisher}
                </span>
                {
                  videoDetail.message && <span className='message-box'>{videoDetail.message}</span>
                }
                <Select
                  defaultValue={0}
                  onChange={handleChangeBitrate}
                  options={bitrates}
                  className='text-slate-900'
                />
                <button 
                onClick={togglePublish}
                className="px-3 py-1 text-sm rounded-sm btn-1">Unpublish</button>
            </div>
        </div>
      ) : <>loading...</>}
    </div>
  )
}
