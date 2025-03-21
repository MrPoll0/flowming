import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import VideoCall from './VideoCall/VideoCall';
import ChatPanel from './VideoCall/ChatPanel';
import './CollaborateTab.css';

// Configuration for ICE servers
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com'
    }
  ]
};

// Main component
const CollaborateTab = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [activeRoom, setActiveRoom] = useState<string>('');
  const [roomInput, setRoomInput] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userNameInput, setUserNameInput] = useState<string>('');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; timestamp: Date }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // References
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize socket connection
  useEffect(() => {
    // Replace with your signaling server URL
    const SIGNALING_SERVER = 'http://localhost:3001';
    
    socketRef.current = io(SIGNALING_SERVER);
    
    // Socket event handlers
    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnectionState('disconnected');
      cleanupPeerConnections();
    });
    
    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setError(`Connection error: ${error}`);
    });
    
    // Clean up on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopLocalStream();
      cleanupPeerConnections();
    };
  }, []);

  // Set up room event listeners
  useEffect(() => {
    if (!socketRef.current) return;
    
    // New user joined the room
    socketRef.current.on('user-joined', async ({ userId, userName: peerName }) => {
      console.log(`User joined: ${userId} (${peerName})`);
      
      // Create a new peer connection for this user
      const peerConnection = createPeerConnection(userId, peerName);
      
      // Add local tracks to the peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }
      
      // Create and send offer
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socketRef.current?.emit('offer', {
          target: userId,
          caller: socketRef.current.id,
          sdp: peerConnection.localDescription
        });
      } catch (err) {
        console.error('Error creating offer:', err);
        setError('Failed to establish connection with new user');
      }
    });
    
    // Received an offer from a peer
    socketRef.current.on('offer', async ({ caller, sdp, callerName }) => {
      console.log(`Received offer from: ${caller}`);
      
      const peerConnection = createPeerConnection(caller, callerName);
      
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        
        // Add local tracks to the peer connection
        if (localStream) {
          localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
          });
        }
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socketRef.current?.emit('answer', {
          target: caller,
          caller: socketRef.current.id,
          sdp: peerConnection.localDescription
        });
      } catch (err) {
        console.error('Error handling offer:', err);
        setError('Failed to accept connection from peer');
      }
    });
    
    // Received an answer to our offer
    socketRef.current.on('answer', async ({ caller, sdp }) => {
      console.log(`Received answer from: ${caller}`);
      const peerConnection = peerConnectionsRef.current[caller];
      
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('Error setting remote description from answer:', err);
        }
      }
    });
    
    // Received an ICE candidate from a peer
    socketRef.current.on('ice-candidate', async ({ candidate, from }) => {
      console.log(`Received ICE candidate from: ${from}`);
      const peerConnection = peerConnectionsRef.current[from];
      
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });
    
    // A user left the room
    socketRef.current.on('user-left', ({ userId }) => {
      console.log(`User left: ${userId}`);
      
      // Close and remove the peer connection
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      
      // Remove the remote stream
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    });
    
    // Received a chat message
    socketRef.current.on('chat-message', ({ senderName, message }: { sender: string, senderName: string, message: string }) => {
      setChatMessages(prev => [
        ...prev,
        { sender: senderName, text: message, timestamp: new Date() }
      ]);
    });
    
    // Room joined successfully
    socketRef.current.on('room-joined', ({ roomId, participants }: { roomId: string, participants: Array<{ id: string, name: string }> }) => {
      console.log(`Joined room: ${roomId} with participants:`, participants);
      setActiveRoom(roomId);
      setConnectionState('connected');
      
      // For each existing participant, create a peer connection
      participants.forEach(({ id, name }) => {
        if (id !== socketRef.current?.id) {
          createPeerConnection(id, name);
        }
      });
    });
    
    // Error messages from server
    socketRef.current.on('room-error', ({ message }) => {
      setError(message);
      setConnectionState('disconnected');
    });
    
    return () => {
      // Clean up event listeners
      if (socketRef.current) {
        socketRef.current.off('user-joined');
        socketRef.current.off('offer');
        socketRef.current.off('answer');
        socketRef.current.off('ice-candidate');
        socketRef.current.off('user-left');
        socketRef.current.off('chat-message');
        socketRef.current.off('room-joined');
        socketRef.current.off('room-error');
      }
    };
  }, [localStream]);

  // Create a peer connection for a specific user
  const createPeerConnection = (userId: string, peerName: string) => {
    console.log(`Creating peer connection for: ${userId} (${peerName})`);
    
    // Create a new RTCPeerConnection
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    
    // Store the connection
    peerConnectionsRef.current[userId] = peerConnection;
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to: ${userId}`);
        socketRef.current?.emit('ice-candidate', {
          target: userId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}: ${peerConnection.connectionState}`);
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${userId}: ${peerConnection.iceConnectionState}`);
      
      if (peerConnection.iceConnectionState === 'failed' || 
          peerConnection.iceConnectionState === 'disconnected') {
        // Try to restart ICE if the connection fails
        peerConnection.restartIce();
      }
    };
    
    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      console.log(`Received track from: ${userId}`);
      
      // Create a new remote stream for this user if we don't have one
      setRemoteStreams(prevStreams => {
        // If we already have a stream for this user, add the track to it
        if (prevStreams[userId]) {
          return prevStreams;
        }
        
        // Get the remote stream
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        
        // Return the updated remote streams
        return {
          ...prevStreams,
          [userId]: remoteStream
        };
      });
    };
    
    return peerConnection;
  };

  // Start local video and audio stream
  const startLocalStream = async () => {
    try {
      setError(null);
      console.log('Getting user media...');
      
      try {
        // First try to get both audio and video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        console.log('Got local stream with audio and video');
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        return stream;
      } catch (videoErr) {
        console.error('Error accessing video:', videoErr);
        
        // If video fails, try with audio only
        try {
          setError('Camera not available. Continuing with audio only.');
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          
          console.log('Got audio-only stream');
          setLocalStream(audioOnlyStream);
          setIsVideoEnabled(false);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = audioOnlyStream;
          }
          
          return audioOnlyStream;
        } catch (audioErr) {
          // Both video and audio failed
          throw new Error('Could not access camera or microphone');
        }
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(`Could not access camera or microphone. Please check permissions. ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  };

  // Stop local stream
  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  // Clean up peer connections
  const cleanupPeerConnections = () => {
    Object.values(peerConnectionsRef.current).forEach(connection => {
      connection.close();
    });
    peerConnectionsRef.current = {};
    setRemoteStreams({});
  };

  // Join a room
  const joinRoom = async () => {
    if (!socketRef.current) {
      setError('Connection to signaling server not established');
      return;
    }
    
    if (!roomInput) {
      setError('Please enter a room name');
      return;
    }
    
    if (!userNameInput) {
      setError('Please enter your name');
      return;
    }
    
    setError(null);
    setConnectionState('connecting');
    
    // Start local stream if not already started
    let stream = localStream;
    if (!stream) {
      stream = await startLocalStream();
      if (!stream) return;
    }
    
    // Join the room
    setUserName(userNameInput);
    socketRef.current.emit('join-room', {
      roomId: roomInput,
      userName: userNameInput
    });
  };

  // Leave the current room
  const leaveRoom = () => {
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('leave-room', { roomId: activeRoom });
      setActiveRoom('');
      setConnectionState('disconnected');
      cleanupPeerConnections();
      setChatMessages([]);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    if (!socketRef.current || !activeRoom) {
      setError('You must be in a room to share your screen');
      return;
    }
    
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStream) {
          screenStream.getTracks().forEach(track => {
            track.stop();
          });
          setScreenStream(null);
        }
        
        // Update all peer connections to remove screen tracks
        Object.values(peerConnectionsRef.current).forEach(pc => {
          pc.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'video' && screenStream?.getTracks().includes(sender.track)) {
              // Replace with camera video track
              const videoTrack = localStream?.getVideoTracks()[0];
              if (videoTrack) {
                sender.replaceTrack(videoTrack);
              }
            }
          });
        });
        
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        setScreenStream(stream);
        
        // When the user stops sharing via the browser UI
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          
          // Replace screen track with camera track in all peer connections
          Object.values(peerConnectionsRef.current).forEach(pc => {
            pc.getSenders().forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                const videoTrack = localStream?.getVideoTracks()[0];
                if (videoTrack) {
                  sender.replaceTrack(videoTrack);
                }
              }
            });
          });
        };
        
        // Replace camera video with screen share in all peer connections
        const screenVideoTrack = stream.getVideoTracks()[0];
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          pc.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(screenVideoTrack);
            }
          });
        });
        
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
      setError('Screen sharing failed. Please try again.');
    }
  };

  // Send a chat message
  const sendChatMessage = (message: string) => {
    if (!socketRef.current || !activeRoom || !message.trim()) return;
    
    socketRef.current.emit('send-message', {
      roomId: activeRoom,
      message: message.trim()
    });
    
    // Add message to local chat
    setChatMessages(prev => [
      ...prev,
      { sender: 'You', text: message.trim(), timestamp: new Date() }
    ]);
  };

  // Generate a random room ID
  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setRoomInput(randomId);
  };

  return (
    <div className="collaborate-tab">
      <h3>Colaborar con el diagrama</h3>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      {connectionState === 'disconnected' && (
        <div className="join-section">
          {!localStream && (
            <div className="media-status-message">
              <button className="start-camera-btn" onClick={startLocalStream}>
                Iniciar cámara y micrófono
              </button>
              <button className="audio-only-btn" onClick={async () => {
                try {
                  const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                  });
                  setLocalStream(audioStream);
                  setIsVideoEnabled(false);
                } catch (err) {
                  setError('No se pudo acceder al micrófono. Verifique los permisos.');
                }
              }}>
                Unirse solo con audio
              </button>
            </div>
          )}
          
          <div className="input-group">
            <label htmlFor="user-name">Nombre:</label>
            <input
              id="user-name"
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="Ingresa tu nombre"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="room-id">Sala:</label>
            <div className="room-input-container">
              <input
                id="room-id"
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="ID de sala"
              />
              <button 
                className="generate-room-btn"
                onClick={generateRandomRoom}
                title="Generar ID aleatorio"
              >
                🎲
              </button>
            </div>
          </div>
          
          <div className="action-buttons">
            <button className="primary-btn" onClick={joinRoom}>
              Iniciar / Unirse a la sala
            </button>
          </div>
        </div>
      )}
      
      {connectionState !== 'disconnected' && (
        <div className="video-call-container">
          <div className="room-info">
            <span>Sala: {activeRoom}</span>
            {connectionState === 'connecting' && <span className="connecting-status">Conectando...</span>}
          </div>
          
          <div className="video-chat-layout">
            <VideoCall
              localStream={localStream}
              localVideoRef={localVideoRef}
              remoteStreams={remoteStreams}
              isScreenSharing={isScreenSharing}
              screenStream={screenStream}
              userName={userName}
            />
            
            <ChatPanel
              messages={chatMessages}
              onSendMessage={sendChatMessage}
            />
          </div>
          
          <div className="call-controls">
            <button
              className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
              onClick={toggleAudio}
              title={isAudioEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
            >
              {isAudioEnabled ? '🎤' : '🔇'}
            </button>
            
            <button
              className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? 'Apagar cámara' : 'Encender cámara'}
            >
              {isVideoEnabled ? '📹' : '🚫'}
            </button>
            
            <button
              className={`control-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={toggleScreenSharing}
              title={isScreenSharing ? 'Dejar de compartir pantalla' : 'Compartir pantalla'}
            >
              {isScreenSharing ? '📺' : '🖥️'}
            </button>
            
            <button
              className="control-btn end-call"
              onClick={leaveRoom}
              title="Salir de la sala"
            >
              ❌
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborateTab;
