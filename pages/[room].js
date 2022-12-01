import React,{ useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import SocketIOClient from "socket.io-client";

export default function Room() {
    const {query, isReady} = useRouter()
    const myVideo = useRef(null);
    const video = useRef(null);
    const { room } = query
    const peers = {};

    useEffect(() => socketInitializer(), [isReady])

    const socketInitializer = () => {
        if(!isReady) return;

        const socket = SocketIOClient.connect('/', {
            path: process.env.NEXT_PUBLIC_SOCKET_URL,
        });

        socket.on("connect", () => {
            console.log("SOCKET CONNECTED!", socket.id);
        });

        socket.on('user-disconnected', userId => {
            if(peers?.[userId]) peers[userId].close();
        })

        import('peerjs').then(({ default: Peer }) => {
            
            const myPeer = new Peer();

            myPeer.on('open', id => {
                socket.emit('joined-room', room, id)
            });
    
            navigator.mediaDevices.getUserMedia({
                video:true,
                audio:true
            }).then(stream => {
                myVideo.current.srcObject = stream;
    
                myPeer.on('call', call => {
                    call.answer(stream);
                    call.on('stream', userStream => {
                        video.current.srcObject = userStream;
                    })
                })
    
                socket.on('user-connected', (userId) => {
                    const call = myPeer.call(userId, stream);
                    call.on('stream',userStream => {
                        video.current.srcObject = userStream;
                    })
                    call.on('close',() => {
                        video.current.srcObject = null;
                    })
    
                    peers[userId] = call;
                })
            });
        });
    }

    return (
        <div className='grid w-full h-screen grid-cols-2'>
            
            <div className='w-full h-full'>
                <video 
                ref={myVideo}
                onLoadedMetadata={() => myVideo.current.play()}
                muted 
                className='object-cover w-full h-full'></video>
            </div>
            
            <div className='w-full h-full'>
            <video
            ref={video}
            onLoadedMetadata={() => video.current.play()}
            className='object-cover w-full h-full'></video>
            </div>
        </div>
    )
}
