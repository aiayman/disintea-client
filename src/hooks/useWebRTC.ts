import { useCallback, useEffect, useRef, useState } from "react";
import { getTurnCredentials } from "../lib/tauri-compat";
import { useAppStore } from "../store/appStore";

/** Map of peerId → remote MediaStream */
export type RemoteStreams = Map<string, MediaStream>;

export function useWebRTC() {
  const { audioDeviceId, setScreenSharing } = useAppStore();

  // Local audio stream (mic)
  const localStreamRef = useRef<MediaStream | null>(null);
  // Screen share stream
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Peer connections: peerId → RTCPeerConnection
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidates queued because PC didn't exist or remote desc wasn't set yet
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Per-peer composite streams (accumulate audio + video tracks from remote)
  const remoteCompositeRef = useRef<Map<string, MediaStream>>(new Map());

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
    // Start mic enabled. PTT (Tauri) or the mute button will disable it.
    stream.getAudioTracks().forEach((t) => { t.enabled = true; });
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

    // Handle incoming remote tracks — accumulate into a composite stream
    // so adding a video track mid-call doesn't wipe the existing audio track.
    pc.ontrack = (evt) => {
      let composite = remoteCompositeRef.current.get(peerId);
      if (!composite) {
        composite = new MediaStream();
        remoteCompositeRef.current.set(peerId, composite);
      }
      if (!composite.getTrackById(evt.track.id)) {
        composite.addTrack(evt.track);
      }
      const cs = composite;
      evt.track.onended = () => {
        cs.removeTrack(evt.track);
        setRemoteStreams((prev) => new Map(prev).set(peerId, cs));
      };
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(peerId, cs);
        return next;
      });
    };

    // Mid-call renegotiation (e.g. adding screen-share video/audio track).
    // Skip the very first onnegotiationneeded — the initial offer is sent
    // explicitly by startCall(); subsequent triggers fire when new tracks
    // are added and an established SDP already exists.
    pc.onnegotiationneeded = async () => {
      if (!pc.currentLocalDescription) return; // still in initial setup
      if (pc.signalingState !== "stable") return; // already negotiating
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: "call_offer", sdp: offer.sdp, to: peerId });
      } catch (e) {
        console.warn("[renego] onnegotiationneeded failed:", e);
      }
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

  /** Drain any ICE candidates queued for `peerId` into `pc`. */
  const flushCandidateQueue = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueueRef.current.get(peerId) ?? [];
    iceCandidateQueueRef.current.delete(peerId);
    for (const init of queue) {
      try { await pc.addIceCandidate(init); }
      catch (e) { console.warn("[ice] queued addIceCandidate failed:", e); }
    }
  }, []);

  /** Called when a new peer joins — we are the offerer */
  const startCall = useCallback(async (peerId: string, sendSignal: (msg: object) => void) => {
    const pc = await getOrCreatePc(peerId, sendSignal);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: "call_offer", sdp: offer.sdp, to: peerId });
  }, [getOrCreatePc]);

  /** Handle an incoming offer — we are the answerer */
  const handleOffer = useCallback(async (sdp: string, from: string, sendSignal: (msg: object) => void) => {
    const pc = await getOrCreatePc(from, sendSignal);
    await pc.setRemoteDescription({ type: "offer", sdp });
    // Flush any ICE candidates that arrived before remote desc was set
    await flushCandidateQueue(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({ type: "call_answer", sdp: answer.sdp, to: from });
  }, [getOrCreatePc, flushCandidateQueue]);

  /** Handle an incoming answer */
  const handleAnswer = useCallback(async (sdp: string, from: string) => {
    const pc = pcsRef.current.get(from);
    if (!pc) return;
    await pc.setRemoteDescription({ type: "answer", sdp });
    // Flush any ICE candidates that arrived before remote desc was set
    await flushCandidateQueue(from, pc);
  }, [flushCandidateQueue]);

  /** Handle an incoming ICE candidate — queue it if PC isn't ready yet */
  const handleIceCandidate = useCallback(async (
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
    from: string,
  ) => {
    const init: RTCIceCandidateInit = {
      candidate,
      sdpMid: sdpMid ?? undefined,
      sdpMLineIndex: sdpMLineIndex ?? undefined,
    };
    const pc = pcsRef.current.get(from);
    if (!pc || !pc.remoteDescription) {
      // PC not created yet (or remote desc not set) — queue for later
      const q = iceCandidateQueueRef.current.get(from) ?? [];
      q.push(init);
      iceCandidateQueueRef.current.set(from, q);
      return;
    }
    try { await pc.addIceCandidate(init); }
    catch (e) { console.warn("[ice] addIceCandidate failed:", e); }
  }, []);

  /** Remove a peer connection when a peer leaves */
  const handlePeerLeft = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    pc?.close();
    pcsRef.current.delete(peerId);
    iceCandidateQueueRef.current.delete(peerId);
    remoteCompositeRef.current.delete(peerId);
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

  /** Start screen sharing — sends video (and system audio if captured) to all peers */
  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true, // capture tab / system audio where browser supports it
    });
    screenStreamRef.current = stream;
    const [videoTrack] = stream.getVideoTracks();
    const localMicStream = localStreamRef.current;

    for (const pc of pcsRef.current.values()) {
      // Video: replace existing video sender or add a new one
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(videoTrack);
      } else {
        // Attach to the mic stream so the receiver sees a single unified stream
        pc.addTrack(videoTrack, localMicStream ?? stream);
      }
      // System audio from screen capture
      const [audioTrack] = stream.getAudioTracks();
      if (audioTrack) {
        pc.addTrack(audioTrack, localMicStream ?? stream);
      }
    }

    setScreenSharing(true);
    // Auto-stop when user dismisses via browser UI
    videoTrack.onended = () => { void stopScreenShare(); };
  }, [setScreenSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Stop screen sharing */
  const stopScreenShare = useCallback(async () => {
    const screenStream = screenStreamRef.current;
    if (!screenStream) return;

    const screenTrackIds = new Set(screenStream.getTracks().map((t) => t.id));
    screenStream.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && screenTrackIds.has(sender.track.id)) {
          if (sender.track.kind === "video") {
            await sender.replaceTrack(null); // remove video cleanly
          } else {
            pc.removeTrack(sender); // remove screen audio sender
          }
        }
      }
    }

    setScreenSharing(false);
  }, [setScreenSharing]);

  /** Close all peer connections and release streams */
  const hangUp = useCallback(() => {
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    iceCandidateQueueRef.current.clear();
    remoteCompositeRef.current.clear();
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
