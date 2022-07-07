import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

// --- prefix -----
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia || navigator.msGetUserMedia;
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;

export class Room {
  constructor(roomName) {
    // - 利用者から設定、利用者へ提供するのパラメータ
    this.roomName = roomName;

    this.localStream = null;
    this.peerConnections = {};


    this.onConnect = () => {};
    this.onStartVideo = (stream) => {};
    this.onStopVideo = () => {};
    this.onCallme = (from) => {};
    this.onClose = (to) => {};
    this.onOffer = (from) => {};
    this.onTrack = (userId, stream) => {};

    // - SDK提供者起因のパラメータ
    this.signaling_srv = undefined;
    // - シグナリングサーバのアドレスをgitに入れたくないから、URLパラメータで渡す
    const args = {};
    document.location.href.split('?')[1]?.split('&').forEach((p) => {
      const [k, v] = p.split('=');
      args[k] = v;
    });
    console.log(args);

    this.signaling_srv = args['signaling'];

    if (this.signaling_srv === undefined || roomName === undefined) document.body.innerHTML = '';
    if (this.signaling_srv === undefined) document.body.innerHTML += '・URLパラメータでシグナリングサーバを指定してください<br />';
    if (roomName === undefined) document.body.innerHTML += '・new Room()時にルーム名を渡してください<br />';

    this.signaling = io("https://" + this.signaling_srv + "/signaling");

    // - シグナリングプロトコル実装
    this.signaling.on('connect', (e) => {
      console.log(this.signaling);
      console.log('I am %s', this.signaling.id);
      this.onConnect();
      this.joinRoom(this.roomName);
    });

    this.signaling.on('sign:callme', async (msg) => {
      const msgJson = JSON.parse(msg);

      console.log('// receive sign:callme: %s %o', msg, msgJson);

      if (msgJson.from === this.signaling.id) return;
      console.group('// receive sign:callme');

      // Create Video Element for Answer-side in Offer-side
      this.onCallme(msgJson.from);
  
      this.connect(msgJson.from);

      console.groupEnd();
    });

    this.signaling.on('sign:offer', async (msg) => {
      const msgJson = JSON.parse(msg);

      console.log('// receive sign:offer: %s %o', msg, msgJson);

      if (msgJson.from === this.signaling.id) return;
      console.group('// receive sign:offer');

      // Create Video Element for Offer-side in Answer-side
      this.onOffer(msgJson.from);

      this.onSdpText(msgJson.sdp, msgJson.from);

      console.groupEnd();
    });

    this.signaling.on('sign:answer', async (msg) => {
      const msgJson = JSON.parse(msg);

      console.log('// receive sign:answer: %s %o', msg, msgJson);

      if (msgJson.from === signaling.id) return;
      console.group('// receive sign:answer');


      console.groupEnd();
    });

    this.signaling.on('sign:template', async (msg) => {
      const msgJson = JSON.parse(msg);

      console.log('// receive sign:template: %s %o', msg, msgJson);

      if (msgJson.from === this.signaling.id) return;
      console.group('// receive sign:template');


      console.groupEnd();
    });
  }

  // ---------------------- media handling ----------------------- 
  // start local video
  startVideo() {
    this.getDeviceStream({ video: true, audio: false })
      .then((stream) => { // success
        this.localStream = stream;
        this.onStartVideo(stream);
      }).catch((error) => { // error
        console.error('getUserMedia error:', error);
        return;
      });
  }

  // stop local video
  stopVideo() {
    this.onStopVideo();
    this.stopLocalStream(this.localStream);
    this.localStream = null;
  }

  stopLocalStream(stream) {
    let tracks = stream.getTracks();
    if (!tracks) {
      console.warn('NO tracks');
      return;
    }

    for (let track of tracks) {
      track.stop();
    }
  }

  getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
      console.log('navigator.mediaDevices.getUserMadia');
      return navigator.mediaDevices.getUserMedia(option);
    }
    else {
      console.log('wrap navigator.getUserMadia with Promise');
      return new Promise(function (resolve, reject) {
        navigator.getUserMedia(option,
          resolve,
          reject
        );
      });
    }
  }

  playVideo(element, stream) {
    if ('srcObject' in element) {
      element.srcObject = stream;
    }
    else {
      element.src = window.URL.createObjectURL(stream);
    }
    element.play();
    element.volume = 0;
  }

  pauseVideo(element) {
    element.pause();
    if ('srcObject' in element) {
      element.srcObject = null;
    }
    else {
      if (element.src && (element.src !== '')) {
        window.URL.revokeObjectURL(element.src);
      }
      element.src = '';
    }
  }

  // ----- hand signaling ----
  onSdpText(text, userId) {
    if (this.peerConnections[userId] !== undefined) {
      console.log('Received answer text...');
      let answer = new RTCSessionDescription({
        type: 'answer',
        sdp: text,
      });
      this.setAnswer(answer, userId);
    }
    else {
      console.log('Received offer text...');
      let offer = new RTCSessionDescription({
        type: 'offer',
        sdp: text,
      });
      this.setOffer(offer, userId);
    }
  }

  sendSdp(sessionDescription, userId) {
    console.log('---sending sdp ---');

    const offerJson = {
      to: userId,
      sdp: sessionDescription.sdp
    }
    console.log('// send sign:offer');
    this.signaling.emit('sign:offer', JSON.stringify(offerJson));
  }

  // ---------------------- connection handling -----------------------
  prepareNewConnection(userId) {
    let pc_config = { "iceServers": [] };
    let peer = new RTCPeerConnection(pc_config);

    // --- on get remote stream ---
    if ('ontrack' in peer) {
      peer.ontrack = (event) => {
        console.log('-- peer.ontrack()');
        let stream = event.streams[0];
        this.onTrack(userId, stream);
      };
    }
    else {
      peer.onaddstream = (event) => {
        console.log('-- peer.onaddstream()');
        let stream = event.stream;
        this.onTrack(userId, stream);
      };
    }

    // --- on get local ICE candidate
    peer.onicecandidate = (evt) => {
      if (evt.candidate) {
        console.log(evt.candidate);

        // Trickle ICE の場合は、ICE candidateを相手に送る
        // Vanilla ICE の場合には、何もしない
      } else {
        console.log('empty ice event');

        // Trickle ICE の場合は、何もしない
        // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
        this.sendSdp(peer.localDescription, userId);
      }
    };

    // --- when need to exchange SDP ---
    peer.onnegotiationneeded = (evt) => {
      console.log('-- onnegotiationneeded() ---');
    };

    // --- other events ----
    peer.onicecandidateerror = (evt) => {
      console.error('ICE candidate ERROR:', evt);
    };

    peer.onsignalingstatechange = () => {
      console.log('== signaling status=' + peer.signalingState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log('== ice connection status=' + peer.iceConnectionState);
      if (peer.iceConnectionState === 'disconnected') {
        console.log('-- disconnected --');
        this.close(userId);
      }
    };

    peer.onicegatheringstatechange = () => {
      console.log('==***== ice gathering state=' + peer.iceGatheringState);
    };

    peer.onconnectionstatechange = () => {
      console.log('==***== connection state=' + peer.connectionState);
    };

    peer.onremovestream = (event) => {
      console.log('-- peer.onremovestream()');
      pauseVideo(remoteVideo);
    };


    // -- add local stream --
    if (this.localStream) {
      console.log('Adding local stream...');
      peer.addStream(this.localStream);
    }
    else {
      console.warn('no local stream, but continue.');
    }

    return peer;
  }

  makeOffer(userId) {
    this.peerConnections[userId] = this.prepareNewConnection(userId);
    this.peerConnections[userId].createOffer()
      .then((sessionDescription) => {
        console.log('createOffer() succsess in promise');
        return this.peerConnections[userId].setLocalDescription(sessionDescription);
      }).then(() => {
        console.log('setLocalDescription() succsess in promise');

        // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
        // -- Vanilla ICE の場合には、まだSDPは送らない --
        //this.sendSdp(this.peerConnections[userId].localDescription, userId);
      }).catch((err) => {
        console.error(err);
      });
  }

  setOffer(sessionDescription, userId) {
    if (this.peerConnections[userId] !== undefined) {
      console.error('peerConnection alreay exist!');
    }
    this.peerConnections[userId] = this.prepareNewConnection(userId);
    this.peerConnections[userId].setRemoteDescription(sessionDescription)
      .then(() => {
        console.log('setRemoteDescription(offer) succsess in promise');
        this.makeAnswer(userId);
      }).catch((err) => {
        console.error('setRemoteDescription(offer) ERROR: ', err);
      });
  }

  makeAnswer(userId) {
    console.log('sending Answer. Creating remote session description...');
    if (this.peerConnections[userId] === undefined) {
      console.error('peerConnection NOT exist!');
      return;
    }

    this.peerConnections[userId].createAnswer()
      .then((sessionDescription) => {
        console.log('createAnswer() succsess in promise');
        return this.peerConnections[userId].setLocalDescription(sessionDescription);
      }).then(() => {
        console.log('setLocalDescription() succsess in promise');

        // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
        // -- Vanilla ICE の場合には、まだSDPは送らない --
        //this.sendSdp(this.peerConnections[userId].localDescription, userId);
      }).catch((err) => {
        console.error(err);
      });
  }

  setAnswer(sessionDescription, userId) {
    if (this.peerConnections[userId] === undefined) {
      console.error('peerConnection NOT exist!');
      return;
    }

    this.peerConnections[userId].setRemoteDescription(sessionDescription)
      .then(() => {
        console.log('setRemoteDescription(answer) succsess in promise');
      }).catch((err) => {
        console.error('setRemoteDescription(answer) ERROR: ', err);
      });
  }

  joinRoom(roomName) {
    const joinRoomJson = {
      type: 'join',
      room: roomName
    }
    console.log('// send sign:joinRoom');
    this.signaling.emit('sign:joinRoom', JSON.stringify(joinRoomJson));
  }

  call() {
    // call meの時に必要
    // TODO: - localStreamがなくてもまずは繋げるようにする？:wq
    if (this.localStream === null) return;

    const callmeJson = {
      type: 'call me'
    }
    console.log('// send sign:callme');
    this.signaling.emit('sign:callme', JSON.stringify(callmeJson));
  }

  // start PeerConnection
  connect(userId) {

    // call meの時に必要
    if (this.localStream === null) return;

    if (this.peerConnections[userId] === undefined) {
      console.log('make Offer');
      this.makeOffer(userId);
    }
    else {
      console.warn('peer already exist.');
    }
  }

  // close PeerConnection
  close(userId) {
    if (this.peerConnections[userId]) {
      console.log('Hang up %s.', userId);
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
      this.onClose(userId);
    }
    else {
      console.warn('peer NOT exist.');
    }
  }

  hangUp() {
    for (let userId in this.peerConnections) {
      this.close(userId);
    }
  }
}