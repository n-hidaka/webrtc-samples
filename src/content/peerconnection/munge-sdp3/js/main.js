/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

// const socket = io("http://34.146.59.68/signaling");
// console.log({socket});
const signaling = io("http://104.198.80.67/signaling");

signaling.on('chat message', function(msg) {
  // var item = document.createElement('li');
  // item.textContent = msg;
  // messages.appendChild(item);
  // window.scrollTo(0, document.body.scrollHeight);
  console.log('receive chat message: %s', msg)
});

signaling.on('sign:callme', async function(msg) {
  const msgJson = JSON.parse(msg);

  console.log('// receive sign:callme: %s %o', msg, msgJson);

  if (msgJson.from === signaling.id) return;
  console.group('// receive sign:callme');

  console.log({ localPeerConnection });

  createPeerConnection();
  await createOffer();
  await setOffer();

  const sdp = offerSdpTextarea.value;
  const offerJson = {
    to: msgJson.from,
    sdp: sdp
  }
  console.log('// send sign:offer');
  signaling.emit('sign:offer', JSON.stringify(offerJson));

  console.groupEnd();
});

signaling.on('sign:offer', async function(msg) {
  const msgJson = JSON.parse(msg);

  if (msgJson.from === signaling.id) return;
  console.group('// receive sign:offer');

  console.log('// receive sign:offer: %s %o', msg, msgJson);
  offerSdpTextarea.value = msgJson.sdp;


  const sdp = msgJson.sdp
    .split('\n')
    .map(l => l.trim())
    .join('\r\n');
  const offer = {
    type: 'offer',
    sdp: sdp
  };
  try {
    // eslint-disable-next-line no-unused-vars
    console.log({ localPeerConnection });
    const ignore = await localPeerConnection.setRemoteDescription(offer);
    onSetSessionDescriptionSuccess();
    createAnswerButton.disabled = false;
  } catch (e) {
    onSetSessionDescriptionError(e);
    return;
  }
  // createAnswer();
  try {
    const answer = await localPeerConnection.createAnswer();
    gotDescription2(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
  // setAnswer();
  const ansSdp = answerSdpTextarea.value
    .split('\n')
    .map(l => l.trim())
    .join('\r\n');
  const answer = {
    type: 'answer',
    sdp: ansSdp
  };

  try {
    // eslint-disable-next-line no-unused-vars
    const ignore = await localPeerConnection.setLocalDescription(answer);
    onSetSessionDescriptionSuccess();
    setAnswerButton.disabled = true;
  } catch (e) {
    onSetSessionDescriptionError(e);
    return;
  }

  const __sdp = answerSdpTextarea.value;
  const answerJson = {
    to: msgJson.from,
    sdp: __sdp
  }
  console.log('// send sign:answer');
  signaling.emit('sign:answer', JSON.stringify(answerJson));

  console.groupEnd();
});

signaling.on('sign:answer', async function(msg) {
  const msgJson = JSON.parse(msg);

  if (msgJson.from === signaling.id) return;
  console.group('// receive sign:answer');

  console.log('// receive sign:answer: %s %o', msg, msgJson);
  answerSdpTextarea.value = msgJson.sdp;

  const sdp = msgJson.sdp
    .split('\n')
    .map(l => l.trim())
    .join('\r\n');
  const answer = {
    type: 'answer',
    sdp: sdp
  };
  try {
    // eslint-disable-next-line no-unused-vars
    const ignore = await localPeerConnection.setRemoteDescription(answer);
    onSetSessionDescriptionSuccess();
  } catch (e) {
    onSetSessionDescriptionError(e);
    return;
  }

  console.groupEnd();
});

signaling.on('connect', function(e) {
  console.log({signaling});
  console.log('I am %s', signaling.id);
});

function startCall() {
  const callmeJson = {
    type: 'call me'
  }
  console.log('// send sign:callme');
  signaling.emit('sign:callme', JSON.stringify(callmeJson));
}

try {
  navigator.mediaDevices.enumerateDevices()
      .then(gotSources);
} catch (e) {
  console.log(e);
}

const getMediaButton = document.querySelector('button#getMedia');
const createPeerConnectionButton = document.querySelector('button#createPeerConnection');
const createOfferButton = document.querySelector('button#createOffer');
const setOfferButton = document.querySelector('button#setOffer');
const createAnswerButton = document.querySelector('button#createAnswer');
const setAnswerButton = document.querySelector('button#setAnswer');
const hangupButton = document.querySelector('button#hangup');
let dataChannelDataReceived;

getMediaButton.onclick = getMedia;
createPeerConnectionButton.onclick = createPeerConnection;
// createOfferButton.onclick = createOffer;
createOfferButton.onclick = startCall;
setOfferButton.onclick = setOffer;
createAnswerButton.onclick = createAnswer;
setAnswerButton.onclick = setAnswer;
hangupButton.onclick = hangup;

const offerSdpTextarea = document.querySelector('div#local textarea');
const answerSdpTextarea = document.querySelector('div#remote textarea');

const audioSelect = document.querySelector('select#audioSrc');
const videoSelect = document.querySelector('select#videoSrc');

audioSelect.onchange = videoSelect.onchange = getMedia;

const localVideo = document.querySelector('div#local video');
const remoteVideo = document.querySelector('div#remote video');

const selectSourceDiv = document.querySelector('div#selectSource');

let localPeerConnection;
let localStream;
let sendChannel;
let receiveChannel;
const dataChannelOptions = {ordered: true};
let dataChannelCounter = 0;
let sendDataLoop;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function gotSources(sourceInfos) {
  selectSourceDiv.classList.remove('hidden');
  let audioCount = 0;
  let videoCount = 0;
  for (let i = 0; i < sourceInfos.length; i++) {
    const option = document.createElement('option');
    option.value = sourceInfos[i].deviceId;
    option.text = sourceInfos[i].label;
    if (sourceInfos[i].kind === 'audioinput') {
      audioCount++;
      if (option.text === '') {
        option.text = `Audio ${audioCount}`;
      }
      audioSelect.appendChild(option);
    } else if (sourceInfos[i].kind === 'videoinput') {
      videoCount++;
      if (option.text === '') {
        option.text = `Video ${videoCount}`;
      }
      videoSelect.appendChild(option);
    } else {
      console.log('unknown', JSON.stringify(sourceInfos[i]));
    }
  }
}

async function getMedia() {
  getMediaButton.disabled = true;

  console.log('// send chat message');
  signaling.emit('chat message', 'get media');

  if (localStream) {
    localVideo.srcObject = null;
    localStream.getTracks().forEach(track => track.stop());
  }
  const audioSource = audioSelect.value;
  console.log(`Selected audio source: ${audioSource}`);
  const videoSource = videoSelect.value;
  console.log(`Selected video source: ${videoSource}`);

  const constraints = {
    audio: {
      optional: [{
        sourceId: audioSource
      }]
    },
    video: {
      optional: [{
        sourceId: videoSource
      }]
    }
  };
  console.log('Requested local stream');
  try {
    const userMedia = await navigator.mediaDevices.getUserMedia(constraints);
    gotStream(userMedia);
  } catch (e) {
    console.log('navigator.getUserMedia error: ', e);
  }
}

function gotStream(stream) {
  console.log('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
  createPeerConnectionButton.disabled = false;
}

function createPeerConnection() {
  createPeerConnectionButton.disabled = true;
  createOfferButton.disabled = false;
  console.log('Starting call');
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();

  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }

  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  const servers = null;

  localPeerConnection = new RTCPeerConnection(servers);
  console.log('Created local peer connection object localPeerConnection');

  console.log('"ontrack" in localPeerConnection: ', 'ontrack' in localPeerConnection);
  if ('ontrack' in localPeerConnection) {
    localPeerConnection.ontrack = function(event) {
      console.log('-- localPeerConnection.ontrack()');
      let stream = event.streams[0];
      playVideo(remoteVideo, stream);
    };
  }
  else {
    localPeerConnection.onaddstream = function(event) {
      console.log('-- localPeerConnection.onaddstream()');
      let stream = event.stream;
      playVideo(remoteVideo, stream);
    };
  }

  // localPeerConnection.onicecandidate = e => onIceCandidate(localPeerConnection, e);
  localPeerConnection.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log(evt.candidate);

      // Trickle ICE の場合は、ICE candidateを相手に送る
      // Vanilla ICE の場合には、何もしない
    } else {
      console.log('empty ice event');

      // Trickle ICE の場合は、何もしない
      // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
      //sendSdp(localPeerConnection.localDescription);
    }
  };

  // --- when need to exchange SDP ---
  localPeerConnection.onnegotiationneeded = function(evt) {
    console.log('-- onnegotiationneeded() ---');
  };

  // --- other events ----
  localPeerConnection.onicecandidateerror = function (evt) {
    console.error('ICE candidate ERROR:', evt);
  };

  localPeerConnection.onsignalingstatechange = function() {
    console.log('== signaling status=' + localPeerConnection.signalingState);
  };

  localPeerConnection.oniceconnectionstatechange = function() {
    console.log('== ice connection status=' + localPeerConnection.iceConnectionState);
    if (localPeerConnection.iceConnectionState === 'disconnected') {
      console.log('-- disconnected --');
      hangUp();
    }
  };

  localPeerConnection.onicegatheringstatechange = function() {
    console.log('==***== ice gathering state=' + localPeerConnection.iceGatheringState);
  };
  
  localPeerConnection.onconnectionstatechange = function() {
    console.log('==***== connection state=' + localPeerConnection.connectionState);
  };


  sendChannel = localPeerConnection.createDataChannel('sendDataChannel', dataChannelOptions);
  sendChannel.onopen = onSendChannelStateChange;
  sendChannel.onclose = onSendChannelStateChange;
  sendChannel.onerror = onSendChannelStateChange;

  localStream.getTracks()
      .forEach(track => localPeerConnection.addTrack(track, localStream));
  console.log('Adding Local Stream to peer connection');
}

function onSetSessionDescriptionSuccess() {
  console.log('Set session description success.');
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

async function createOffer() {
  try {
    const offer = await localPeerConnection.createOffer(offerOptions);
    gotDescription1(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

async function setOffer() {
  // Restore the SDP from the textarea. Ensure we use CRLF which is what is generated
  // even though https://tools.ietf.org/html/rfc4566#section-5 requires
  // parsers to handle both LF and CRLF.
  const sdp = offerSdpTextarea.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
  const offer = {
    type: 'offer',
    sdp: sdp
  };
  console.log(`Modified Offer from localPeerConnection\n${sdp}`);

  try {
    // eslint-disable-next-line no-unused-vars
    const ignore = await localPeerConnection.setLocalDescription(offer);
    onSetSessionDescriptionSuccess();
    setOfferButton.disabled = true;
  } catch (e) {
    onSetSessionDescriptionError(e);
    return;
  }
}

function gotDescription1(description) {
  offerSdpTextarea.disabled = false;
  offerSdpTextarea.value = description.sdp;
  createOfferButton.disabled = true;
  setOfferButton.disabled = false;
}

async function createAnswer() {
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
}

async function setAnswer() {
  setAnswerButton.disabled = false;
  // Restore the SDP from the textarea. Ensure we use CRLF which is what is generated
  // even though https://tools.ietf.org/html/rfc4566#section-5 requires
  // parsers to handle both LF and CRLF.
  const sdp = answerSdpTextarea.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
  const answer = {
    type: 'answer',
    sdp: sdp
  };

  try {
    // eslint-disable-next-line no-unused-vars
    const ignore = await localPeerConnection.setRemoteDescription(answer);
    onSetSessionDescriptionSuccess();
  } catch (e) {
    onSetSessionDescriptionError(e);
    return;
  }
  hangupButton.disabled = false;
  createOfferButton.disabled = false;
}

function gotDescription2(description) {
  answerSdpTextarea.disabled = false;
  answerSdpTextarea.value = description.sdp;
  createAnswerButton.disabled = true;
  setAnswerButton.disabled = false;
}

function sendData() {
  if (sendChannel.readyState === 'open') {
    sendChannel.send(dataChannelCounter);
    console.log(`DataChannel send counter: ${dataChannelCounter}`);
    dataChannelCounter++;
  }
}

function hangup() {
  remoteVideo.srcObject = null;
  console.log('Ending call');
  localStream.getTracks().forEach(track => track.stop());
  sendChannel.close();
  if (receiveChannel) {
    receiveChannel.close();
  }
  localPeerConnection.close();
  localPeerConnection = null;
  offerSdpTextarea.disabled = true;
  answerSdpTextarea.disabled = true;
  getMediaButton.disabled = false;
  createPeerConnectionButton.disabled = true;
  createOfferButton.disabled = true;
  setOfferButton.disabled = true;
  createAnswerButton.disabled = true;
  setAnswerButton.disabled = true;
  hangupButton.disabled = true;
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('Received remote stream');
  }
}

function getOtherPc(pc) {
  return (pc === localPeerConnection) ? undefined : localPeerConnection;
}

function getName(pc) {
  return (pc === localPeerConnection) ? 'localPeerConnection' : 'remotePeerConnection';
}

async function onIceCandidate(pc, event) {
  // try {
  //   // eslint-disable-next-line no-unused-vars
  //   const ignore = await getOtherPc(pc).addIceCandidate(event.candidate);
  //   onAddIceCandidateSuccess(pc);
  // } catch (e) {
  //   onAddIceCandidateError(pc, e);
  // }

  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess() {
  console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  console.log(`Failed to add Ice Candidate: ${error.toString()}`);
}

function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
  dataChannelDataReceived = event.data;
  console.log(`DataChannel receive counter: ${dataChannelDataReceived}`);
}

function onSendChannelStateChange() {
  const readyState = sendChannel.readyState;
  console.log(`Send channel state is: ${readyState}`);
  if (readyState === 'open') {
    sendDataLoop = setInterval(sendData, 1000);
  } else {
    clearInterval(sendDataLoop);
  }
}

function onReceiveChannelStateChange() {
  const readyState = receiveChannel.readyState;
  console.log(`Receive channel state is: ${readyState}`);
}

function playVideo(element, stream) {
  if ('srcObject' in element) {
    element.srcObject = stream;
  }
  else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
}
