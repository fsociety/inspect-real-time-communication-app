import React, { useEffect, useRef, useState, useContext } from 'react';
import { useRouter } from 'next/router';
import RemoteVideo from '../components/RemoteVideo';
import LocalVideo from '../components/LocalVideo';
import { ContextProvider } from '../context/Context';
import { ToastContainer, toast } from 'react-toastify';
import SfuVideoRoom from '../services/SfuVideoRoom';
import 'react-toastify/dist/ReactToastify.css';

export default function Room() {
    const { query, isReady } = useRouter();
    const [remoteFeeds, setRemoteFeeds] = useState([]);
    const { room } = query;
    const subscriber_mode = query['subscriber-mode'] === 'yes' || query['subscriber-mode'] === 'true';

    console.log('remotefeedss --', remoteFeeds);

    return (
        <>
            {isReady && (
                <SfuVideoRoom
                    room={Number(room)}
                    remoteFeeds={{
                        remoteFeeds,
                        setRemoteFeeds
                    }}
                    options={{
                        server,
                        iceServers,
                        subscriber_mode
                    }}
                />
            )}

            <div className='text-white video-grid' id='videos'>
                {!subscriber_mode && <LocalVideo />}

                {remoteFeeds && remoteFeeds.map((remoteFeed,index) => {
                    return <RemoteVideo key={index} remoteFeed={remoteFeed} showBitrate={true} />
                })}
            </div>
            <ToastContainer autoClose={3000} />
        </>
    );
}
