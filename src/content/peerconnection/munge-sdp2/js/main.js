/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const {
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayMediaDevices,
  SkyWayRoom,
  LocalAudioStream,
  LocalVideoStream,
  uuidV4,
} = skyway_room;

try {
  navigator.mediaDevices.enumerateDevices()
      .then(gotSources);
} catch (e) {
  console.log(e);
}

const getMediaButton = document.querySelector('button#getMedia');
const joinSkyWayBetaButton = document.querySelector('button#joinSkyWayBeta');
const leaveSkyWayBetaButton = document.querySelector('button#leaveSkyWayBeta');
const publishAudioButton = document.querySelector('button#publishAudio');
const publishVideoButton = document.querySelector('button#publishVideo');
const unpublishAudioButton = document.querySelector('button#unpublishAudio');
const unpublishVideoButton = document.querySelector('button#unpublishVideo');
const subscribeAudioButton = document.querySelector('button#subscribeAudio');
const subscribeVideoButton = document.querySelector('button#subscribeVideo');
const unsubscribeAudioButton = document.querySelector('button#unsubscribeAudio');
const unsubscribeVideoButton = document.querySelector('button#unsubscribeVideo');

getMediaButton.onclick = getMedia;
joinSkyWayBetaButton.onclick = joinSkyWayBeta;
leaveSkyWayBetaButton.onclick = leaveSkyWayBeta;
publishAudioButton.onclick = publishAudio;
publishVideoButton.onclick = publishVideo;
unpublishAudioButton.onclick = unpublishAudio;
unpublishVideoButton.onclick = unpublishVideo;
subscribeAudioButton.onclick = subscribeAudio;
subscribeVideoButton.onclick = subscribeVideo;
unsubscribeAudioButton.onclick = unsubscribeAudio;
unsubscribeVideoButton.onclick = unsubscribeVideo;

const audioSelect = document.querySelector('select#audioSrc');
const videoSelect = document.querySelector('select#videoSrc');

audioSelect.onchange = videoSelect.onchange = getMedia;

const localVideo = document.querySelector('div#local video');
const remoteVideo = document.querySelector('div#remote video');
const remoteAudio = document.querySelector('div#remote audio');

const selectSourceDiv = document.querySelector('div#selectSource');

let room, me;

let localStream;

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
  joinSkyWayBetaButton.disabled = false;
}

function joinSkyWayBeta() {
  if (localStorage.getItem('appId') === null) {
    const _appId = prompt('[Initial setting 1/2] Input appId');
    if (_appId === null || _appId === '') return;
    localStorage.setItem('appId', _appId);
  }
  const appId = localStorage.getItem('appId');
  console.log('%o', { appId });


  if (localStorage.getItem('skey') === null) {
    const _skey = prompt('[Initial setting 2/2] Input secret key');
    if (_skey === null || _skey === '') return;
    console.log('%o', { _skey });
    localStorage.setItem('skey', _skey);
  }
  const skey = localStorage.getItem('skey');
  console.log('%o', { skey });

  const roomType = localStorage.getItem('roomType') || "p2p";
  if (roomType !== "p2p" && roomType !== "sfu") {
    alert('localStorage roomType must be "p2p" or "sfu"');
    return;
  }

  const roomId = prompt('Input room ID');
  if (roomId === null || roomId === '') return;
  console.log('%o', { roomId });


  joinSkyWayBetaButton.disabled = true;


  const testToken = new SkyWayAuthToken({
    jti: uuidV4(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
    scope: {
      app: {
        id: appId,
        turn: true,
        actions: ["read"],
        channels: [
          {
            id: "*",
            name: "*",
            actions: ["write"],
            members: [
              {
                id: "*",
                name: "*",
                actions: ["write"],
                publication: {
                  actions: ["write"],
                },
                subscription: {
                  actions: ["write"],
                },
              },
            ],
            sfuBots: [
              {
                actions: ["write"],
                forwardings: [
                  {
                    actions: ["write"]
                  }
                ]
              }
            ]
          },
        ],
      },
    },
  });
  const tokenString = testToken.encode(skey);
  console.log('%o', { tokenString });


  (async () => {

    const context = await SkyWayContext.Create(tokenString);

    room = await SkyWayRoom.FindOrCreate(context, {
      type: roomType,
      name: roomId,
    });

    // - debug log for room events
    room.onClosed.add(async (e) => { console.debug('room.onClosed: %o', { e }); });
    room.onMemberJoined.add(async (e) => { console.debug('room.onMemberJoined: %o', { e }); });
    room.onMemberLeft.add(async (e) => { console.debug('room.onMemberLeft: %o', { e }); });
    room.onMemberMetadataUpdated.add(async (e) => { console.debug('room.onMemberMetadataUpdated: %o', { e }); });
    room.onMembershipChanged.add(async (e) => { console.debug('room.onMembershipChanged: %o', { e }); });
    room.onMetadataUpdated.add(async (e) => { console.debug('room.onMetadataUpdated: %o', { e }); });
    room.onPublicationChanged.add(async (e) => { console.debug('room.onPublicationChanged: %o', { e }); });
    room.onPublicationMetadataUpdated.add(async (e) => { console.debug('room.onPublicationMetadataUpdated: %o', { e }); });
    room.onStreamPublished.add(async (e) => { console.debug('room.onStreamPublished: %o', { e }); });
    room.onStreamSubscribed.add(async (e) => { console.debug('room.onStreamSubscribed: %o', { e }); });
    room.onStreamUnpublished.add(async (e) => { console.debug('room.onStreamUnpublished: %o', { e }); });
    room.onStreamUnsubscribed.add(async (e) => { console.debug('room.onStreamUnsubscribed: %o', { e }); });
    room.onSubscriptionChangedEvent.add(async (e) => { console.debug('room.onSubscriptionChangedEvent: %o', { e }); });

    me = await room.join();

    // - debug log for localMember events
    me.onLeft.add(async (e) => { console.debug('me.onLeft: %o', { e }); });
    me.onMetadataUpdated.add(async (e) => { console.debug('me.onMetadataUpdated: %o', { e }); });
    me.onPublicationChanged.add(async (e) => { console.debug('me.onPublicationChanged: %o', { e }); });
    me.onStreamPublished.add(async (e) => { console.debug('me.onStreamPublished: %o', { e }); });
    me.onStreamSubscribed.add(async (e) => { console.debug('me.onStreamSubscribed: %o', { e }); });
    me.onStreamUnpublished.add(async (e) => { console.debug('me.onStreamUnpublished: %o', { e }); });
    me.onStreamUnsubscribed.add(async (e) => { console.debug('me.onStreamUnsubscribed: %o', { e }); });
    me.onSubscriptionChanged.add(async (e) => { console.debug('me.onSubscriptionChanged: %o', { e }); });

    // - change enable/disabled of pub/unpub button
    // - TODO: update room info
    me.onStreamPublished.add(async ({publication}) => {
      switch (publication.contentType) {
        case "audio":
          publishAudioButton.disabled = true;
          unpublishAudioButton.disabled = false;
          break;
        case "video":
          publishVideoButton.disabled = true;
          unpublishVideoButton.disabled = false;
          break;
        default:
          break;
      }
    });

    // - change enable/disabled of pub/unpub button
    // - TODO: update room info
    me.onStreamUnpublished.add(async ({publication}) => {
      switch (publication.contentType) {
        case "audio":
          publishAudioButton.disabled = false;
          unpublishAudioButton.disabled = true;
          break;
        case "video":
          publishVideoButton.disabled = false;
          unpublishVideoButton.disabled = true;
          break;
        default:
          break;
      }
    });

    // - change enable/disabled of sub/unsub button
    // - apply stream of subscription
    // - TODO: update room info
    me.onStreamSubscribed.add(async (e) => {
      // console.log("me.onStreamSubscribed: ", { e });
      // console.group(e.subscription.subscriber.id);
      // console.log("===== %o", e.subscription);
      // console.log("===== %o", e.subscription.stream);
      // console.log("===== %o", e.stream);
      
      const stream = new MediaStream([e.stream.track]);
      switch (e.subscription.contentType) {
        case "audio":
          _gotRemoteAudioStream(stream);          
          subscribeAudioButton.disabled = true;
          unsubscribeAudioButton.disabled = false;
          break;      
        case "video":
          _gotRemoteVideoStream(stream);          
          subscribeVideoButton.disabled = true;
          unsubscribeVideoButton.disabled = false;
          break;      
        default:
          break;
      }
    });

    // - change enable/disabled of sub/unsub button
    // - TODO: detouch stream of subscription
    // - TODO: update room info
    me.onStreamUnsubscribed.add(async (e) => {
      switch (e.subscription.contentType) {
        case "audio":
          subscribeAudioButton.disabled = false;
          unsubscribeAudioButton.disabled = true;
          break;      
        case "video":
          subscribeVideoButton.disabled = false;
          unsubscribeVideoButton.disabled = true;
          break;      
        default:
          break;
      }
    });

    // - auto subscribe for publication after join
    // - change enable/disabled of sub/unsub button
    // - TODO: update room info
    room.onStreamPublished.add(async (e) => {
      if (e.publication.publisher.id === me.id) return;

      // other publication
      switch (e.publication.contentType) {
        case "audio":
          subscribeAudioButton.disabled = false;
          unsubscribeAudioButton.disabled = true;
          subscribeAudio();
          break;
        case "video":
          subscribeVideoButton.disabled = false;
          unsubscribeVideoButton.disabled = true;
          subscribeVideo();
          break;
        default:
          break;
      }
    });

    // - change enable/disabled of sub/unsub button
    // - TODO: update room info
    room.onStreamUnpublished.add(async (e) => {
      if (e.publication.publisher.id === me.id) return;

      // other publication
      switch (e.publication.contentType) {
        case "audio":
          subscribeAudioButton.disabled = true;
          unsubscribeAudioButton.disabled = true;
          break;
        case "video":
          subscribeVideoButton.disabled = true;
          unsubscribeVideoButton.disabled = true;
          break;
        default:
          break;
      }
    });

    // - TODO: update room info
    room.onStreamSubscribed.add(async (e) => {
      // console.log("room.onStreamSubscribed: ", { e });

      // if (e.subscription.subscriber.id !== me.id) {
      //   console.log("other's subscription")
      //   //return;
      // }

      // console.group(e.subscription.subscriber.id)
      // console.log("=====");
      // console.log("me.id:                                 %s", me.id);
      // console.log("subscription.publication.publisher.id: %s", e.subscription.publication.publisher.id);
      // console.log("subscription.subscriber.id:            %s", e.subscription.subscriber.id);
      // console.log("=====");

      // console.log("===== %o", e.subscription);
      // console.log("===== %o", e.subscription.stream);
      // console.groupEnd();
    });

    // - auto subscribe for publications before join
    subscribeAudio();
    subscribeVideo();

    // - auto publish
    publishAudio();
    publishVideo();
  })();

  console.log('Starting join');
  leaveSkyWayBetaButton.disabled = false;
}

function leaveSkyWayBeta() {
  me.leave();

  leaveSkyWayBetaButton.disabled = true;
  joinSkyWayBetaButton.disabled = false;
  publishAudioButton.disabled = true;
  unpublishAudioButton.disabled = true;
  publishVideoButton.disabled = true;
  unpublishVideoButton.disabled = true;
}

function _gotRemoteVideoStream(stream) {
  console.log("_gotRemoteVideoStream(%o)", stream)
  if (remoteVideo.srcObject !== stream) {
    remoteVideo.srcObject = stream;
    console.log('Received remote video stream');
  }
}

function _gotRemoteAudioStream(stream) {
  console.log("_gotRemoteAudioStream(%o)", stream)
  if (remoteAudio.srcObject !== stream) {
    remoteAudio.srcObject = stream;
    console.log('Received remote audio stream');
  }
}

function publishAudio() {
  const [audioTrack] = localStream.getAudioTracks();
  const localAudioStream = new LocalAudioStream('label', audioTrack);
  me.publish(localAudioStream);
}

function publishVideo() {
  const [videoTrack] = localStream.getVideoTracks();
  const localVideoStream = new LocalVideoStream('label', videoTrack);
  me.publish(localVideoStream);
}

function unpublishAudio() {
  unpublishMedia("audio");
}

function unpublishVideo() {
  unpublishMedia("video");
}

function unpublishMedia(contentType) {
  // - 現状、1User 1Video/1Audioの前提のため、filter結果すべてをunpublish
  me.publications
  .filter(publication => publication.contentType === contentType)
  .forEach(publication => me.unpublish(publication.id));
}

function subscribeAudio() {
  subscribeAudioButton.disabled = true;
  subscribeMedia("audio");
}

function subscribeVideo() {
  subscribeVideoButton.disabled = true;
  subscribeMedia("video")
}

function subscribeMedia(contentType) {
  // - 現状、他１Userは1Userの前提のため、filter結果すべてをsubscribe
  // - room利用だから、publication.publisher.member.typeは見なくていい
  room.publications
  .filter(publication => publication.publisher.member.id !== me.id)
  .filter(publication => publication.contentType === contentType)
  .forEach(publication => {
    console.log('subscribe %s, %s from %s', publication.id, publication.contentType, publication.publisher.member.id);
    me.subscribe(publication.id);
  });
}

function unsubscribeAudio() {
  console.log('unsubscribeMedia("audio");');
  unsubscribeAudioButton.disabled = true;
  unsubscribeMedia("audio")
}

function unsubscribeVideo() {
  console.log('unsubscribeMedia("video");');
  unsubscribeVideoButton.disabled = true;
  unsubscribeMedia("video")
}

function unsubscribeMedia(contentType) {
  me.subscriptions
  .filter(subscription => subscription.contentType === contentType)
  .forEach(subscription => {
    console.log('unsubscribe %s, %s from %s', subscription.id, subscription.contentType, subscription.subscriber.member.id);
    me.unsubscribe(subscription.id);
  });
}
