import { useEffect, useRef } from 'react';
import './VideoCall.css';

interface VideoCallProps {
  localStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteStreams: Record<string, MediaStream>;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  userName: string;
}

const VideoCall: React.FC<VideoCallProps> = ({
  localStream: _localStream,
  localVideoRef,
  remoteStreams,
  isScreenSharing,
  screenStream,
  userName
}) => {
  // Use refs for remote streams
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Attach streams to video elements programmatically
  useEffect(() => {
    // Handle remote streams
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const videoElement = remoteVideoRefs.current[userId];
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    });
    
    // Handle screen share
    if (screenVideoRef.current && isScreenSharing && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [remoteStreams, isScreenSharing, screenStream]);

  // Render video elements for all remote streams
  const renderRemoteVideos = () => {
    return Object.entries(remoteStreams).map(([userId, _stream]) => (
      <div key={userId} className="video-container remote-video-container">
        <video
          ref={el => { remoteVideoRefs.current[userId] = el; }}
          autoPlay
          playsInline
          className="video-element remote-video"
        />
        <div className="video-label">{userId}</div>
      </div>
    ));
  };

  return (
    <div className="video-call">
      <div className="video-grid">
        {/* Local video */}
        <div className="video-container local-video-container">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="video-element local-video"
          />
          <div className="video-label">Tú ({userName})</div>
        </div>

        {/* Screen sharing video */}
        {isScreenSharing && screenStream && (
          <div className="video-container screen-video-container">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="video-element screen-video"
            />
            <div className="video-label">Tu pantalla</div>
          </div>
        )}

        {/* Remote videos */}
        {renderRemoteVideos()}
      </div>
    </div>
  );
};

export default VideoCall; 