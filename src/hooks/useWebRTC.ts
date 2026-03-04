import { useCallback, useEffect, useRef, useState } from "react";
import { getTurnCredentials } from "../lib/tauri-compat";
import { useCallStore } from "../store/callStore";

interface TurnCredentials {
  urls: string;
  username: string;
  credential: string;
}

/** Map of peerId → remote MediaStream */
export type RemoteStreams = Map<string, MediaStream>;

export function useWebRTC() {
  const { audioDeviceId, setScreenSharing } = useCallStore();

  // Local audio stream (mic)
  const localStreamRef = useRef<MediaStream | null>(null);
  // Screen share stream
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Peer connections: peerId → RTCPeerConnection
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>(new Map());

  // Build RTCConfiguration with TURN credentials from Rust backend
  const buildConfig = useCallback(async (): Promise<RTCConfiguration> => {
    const creds = await getTurnCredentials();
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: creds.urls,
          username: creds.username,
          credential: creds.credential,
        },
      ],
    };
  }, []);

  // Acquire local mic stream
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;

    const constraints: MediaStreamConstraints = {
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      video: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Start with mic muted (PTT model — user enables track explicitly)
    stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    localStreamRef.current = stream;
    return stream;
  }, [audioDeviceId]);

  /** Create or retrieve a peer connection for `peerId` */
  const getOrCreatePc = useCallback(async (peerId: string, sendSignal: (msg: object) => void): Promise<RTCPeerConnection> => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId)!;

    const config = await buildConfig();
    const pc = new RTCPeerConnection(config);
    pcsRef.current.set(peerId, pc);

    // Add local tracks
    const stream = await getLocalStream();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Handle incoming remote tracks
    pc.ontrack = (evt) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(peerId, evt.streams[0]);
        return next;
      });
    };

    // Relay ICE candidates
    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        sendSignal({
          type: "ice_candidate",
          candidate: evt.candidate.candidate,
          sdp_mid: evt.candidate.sdpMid,
          sdp_m_line_index: evt.candidate.sdpMLineIndex,
          to: peerId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcsRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      }
    };

    return pc;
  }, [buildConfig, getLocalStream]);

  /** Called when a new peer joins — we are the offerer */
  const startCall = useCallback(async (peerId: string, sendSignal: (msg: object) => void) => {
    const pc = await getOrCreatePc(peerId, sendSignal);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: "offer", sdp: offer.sdp, to: peerId });
  }, [getOrCreatePc]);

  /** Handle an incoming offer — we are the answerer */
  const handleOffer = useCallback(async (sdp: string, from: string, sendSignal: (msg: object) => void) => {
    const pc = await getOrCreatePc(from, sendSignal);
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({ type: "answer", sdp: answer.sdp, to: from });
  }, [getOrCreatePc]);

  /** Handle an incoming answer */
  const handleAnswer = useCallback(async (sdp: string, from: string) => {
    const pc = pcsRef.current.get(from);
    if (pc) await pc.setRemoteDescription({ type: "answer", sdp });
  }, []);

  /** Handle an incoming ICE candidate */
  const handleIceCandidate = useCallback(async (
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
    from: string,
  ) => {
    const pc = pcsRef.current.get(from);
    if (pc) {
      await pc.addIceCandidate({ candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex: sdpMLineIndex ?? undefined });
    }
  }, []);

  /** Remove a peer connection when a peer leaves */
  const handlePeerLeft = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    pc?.close();
    pcsRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  /** Toggle audio track enabled state (used by PTT and complete mute) */
  const setMicEnabled = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }, []);

  /** Start screen sharing — replaces video track in all peer connections */
  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" } as MediaTrackConstraints,
      audio: false,
    });
    screenStreamRef.current = stream;
    const [screenTrack] = stream.getVideoTracks();

    // Add/replace track in all PCs
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        pc.addTrack(screenTrack, stream);
      }
    }

    setScreenSharing(true);

    // Auto-stop when user ends via browser UI
    screenTrack.onended = () => stopScreenShare();
  }, [setScreenSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Stop screen sharing */
  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Remove video track from all PCs
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(null);
    }

    setScreenSharing(false);
  }, [setScreenSharing]);

  /** Close all peer connections and release streams */
  const hangUp = useCallback(() => {
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setRemoteStreams(new Map());
    setScreenSharing(false);
  }, [setScreenSharing]);

  // Cleanup on unmount
  useEffect(() => () => { hangUp(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    remoteStreams,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handlePeerLeft,
    setMicEnabled,
    startScreenShare,
    stopScreenShare,
    hangUp,
  };
}
