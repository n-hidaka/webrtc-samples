/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Put variables in global scope to make them available to the browser console.
const constraints = window.constraints = {
  audio: true,
  video: false
};

function handleSuccess(stream, i) {
  const audio = document.getElementById(`gum-local${i}`);
  const audioTracks = stream.getAudioTracks();
  console.log('Got stream with constraints:', constraints);
  console.log(`Using audio device: ${audioTracks[0].label}`);
  window[`stream${i}`] = stream; // make variable available to browser console
  audio.srcObject = stream;
}

function handleError(error) {
  if (error.name === 'OverconstrainedError') {
    const v = constraints.video;
    errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
  } else if (error.name === 'NotAllowedError') {
    errorMsg('Permissions have not been granted to use your camera and ' +
      'microphone, you need to allow the page access to your devices in ' +
      'order for the demo to work.');
  }
  errorMsg(`getUserMedia error: ${error.name}`, error);
}

function errorMsg(msg, error) {
  const errorElement = document.querySelector('#errorMsg');
  errorElement.innerHTML += `<p>${msg}</p>`;
  if (typeof error !== 'undefined') {
    console.error(error);
  }
}

async function init(e, i) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream, i);
    e.target.disabled = true;
  } catch (e) {
    handleError(e);
  }
}

document.querySelector('#openAudio1').addEventListener('click', e => init(e, 1));
document.querySelector('#openAudio2').addEventListener('click', e => init(e, 2));
document.querySelector('#openAudio3').addEventListener('click', e => init(e, 3));
