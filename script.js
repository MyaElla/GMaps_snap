let map;
let autocomplete;
let drawingManager;
let placeIdArray = [];
let polylines = [];
let snappedCoordinates = [];
const apiBaseUrl = "https://maps.googleapis.com/maps/api/js?libraries=drawing,places&key="
let locked = true;
const button = document.querySelectorAll("button")[0];
// @TODO Overlay login/logout button
// const bigButton = document.querySelectorAll("button")[1];
// const overlay = document.querySelectorAll(".overlay")[0];

console.log('javascript')

function getIsLocked() {
  return locked;
}

function setIsLocked(isLocked) {
  locked = isLocked;
}

function getApiKeyFromStorage() {
  return localStorage.getItem("apiKey");
}

function setApiKeyInStorage(apiKey) {
  localStorage.setItem("apiKey", apiKey);
}

function removeApiKeyInStorage() {
  localStorage.removeItem("apiKey");
}

// @TODO Overlay login/logout button
// function hideOverlay() {
//   overlay.style.display = "none";
//   bigButton.style.display = "none";
//   // overlay.style.position = "inline";
//   // bigButton.style.position = "inline";
// }

// function showOverlay() {
//   overlay.style.display = "block";
//   bigButton.style.display = "block";
//   // overlay.style.position = "absolute";
//   // bigButton.style.position = "absolute";
// }

function lock() {
  removeApiKeyInStorage()
  setIsLocked(true)
  button.innerText = "Login";
  // @TODO Overlay login/logout button
  // hideOverlay()
}

function unlock(apiKey) {
  setApiKeyInStorage(apiKey)
  setIsLocked(false)
  button.innerText = "Logout";
  // @TODO Overlay login/logout button
  // showOverlay()
}

// https://blog.codepen.io/2017/08/10/window-prompt-localstorage-api-keys/
button.addEventListener("click", function() {
  let apiKeyStorage = getApiKeyFromStorage();
  let apiKeyPrompt;
  if (getIsLocked()) {
    apiKeyPrompt = prompt("Enter Google Maps API Key:") || null;
    if (!apiKeyPrompt || apiKeyPrompt === "") {
      alert("No key entered")
      return
    }
    unlock(apiKeyPrompt)
    loadApi().then(() => {
      initialize()
    })
  } else {
    // @TODO unload api on lock
    unLoadApi()
    lock();
  }
});

// @TODO Overlay login/logout button
// bigButton.addEventListener("click", function() {
//   button.click();
// });

// @TODO Auto unlock if key in localstorage
// function getApiKey() {
//   console.log('getApiKey()')

//   return new Promise(function(resolve, reject) {
//    const apiKey = localStorage.getItem("apiKey")
//    if (apiKey) {
//       resolve(apiKey);
//    }
//    else {
//       throw new Error("No key in localstorage");
//    }
//   });
// }

// Function to load a script
// https://stackoverflow.com/a/45218814/3469524
function loadApi(){
  console.log('loadApi()');
  return new Promise( (resolve) => {
    console.log('loadApi() api loaded');
    const script = document.createElement( "script" );
    script.id = "api"
    script.src = apiBaseUrl+localStorage.getItem("apiKey");
    script.onload = resolve;
    script.onerror = () => {
      throw new Error('error loading Api')
    };
    document.head.appendChild(script);
  });
}

function unLoadApi() {
  const elem = (document.getElementById("api"))
  elem && elem.parentNode.removeChild(elem);
  lock();
}

function initialize() {
  console.log('initialize')

  var mapOptions = {
    zoom: 17,
    center: {lat: -33.8667, lng: 151.1955}
  };

  // Display map
  // https://developers.google.com/maps/documentation/roads/snap
  map = new google.maps.Map(document.getElementById('map'), mapOptions);

  // Adds a Places search box. Searching for a place will center the map on that
  // location.
  map.controls[google.maps.ControlPosition.RIGHT_TOP].push(
      document.getElementById('bar'));
  autocomplete = new google.maps.places.Autocomplete(
      document.getElementById('autoc'));
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(17);
    }
  });

  // Enables the polyline drawing control. Click on the map to start drawing a
  // polyline. Each click will add a new vertice. Double-click to stop drawing.
  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYLINE,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYLINE
      ]
    },
    polylineOptions: {
      strokeColor: '#696969',
      strokeWeight: 2
    }
  });
  drawingManager.setMap(map);

  // Snap-to-road when the polyline is completed.
  drawingManager.addListener('polylinecomplete', function(poly) {
    var path = poly.getPath();
    polylines.push(poly);
    placeIdArray = [];
    runSnapToRoad(path);
  });

  // Clear button. Click to remove all polylines.
  $('#clear').click(function(ev) {
    for (var i = 0; i < polylines.length; ++i) {
      polylines[i].setMap(null);
    }
    polylines = [];
    ev.preventDefault();
    return false;
  });
}

// Snap a user-created polyline to roads and draw the snapped path
function runSnapToRoad(path) {
  var pathValues = [];
  for (var i = 0; i < path.getLength(); i++) {
    pathValues.push(path.getAt(i).toUrlValue());
  }

  $.get('https://roads.googleapis.com/v1/snapToRoads', {
    interpolate: true,
    key: getApiKeyFromStorage(),
    path: pathValues.join('|')
  }, function(data) {
    processSnapToRoadResponse(data);
    drawSnappedPolyline();
    // getAndDrawSpeedLimits();
  });
}

// Store snapped polyline returned by the snap-to-road service.
function processSnapToRoadResponse(data) {
  snappedCoordinates = [];
  placeIdArray = [];
  for (var i = 0; i < data.snappedPoints.length; i++) {
    var latlng = new google.maps.LatLng(
        data.snappedPoints[i].location.latitude,
        data.snappedPoints[i].location.longitude);
    snappedCoordinates.push(latlng);
    placeIdArray.push(data.snappedPoints[i].placeId);
  }
}

// Draws the snapped polyline (after processing snap-to-road response).
function drawSnappedPolyline() {
  var snappedPolyline = new google.maps.Polyline({
    path: snappedCoordinates,
    strokeColor: 'black',
    strokeWeight: 3
  });

  snappedPolyline.setMap(map);
  polylines.push(snappedPolyline);
}

// Gets speed limits (for 100 segments at a time) and draws a polyline
// color-coded by speed limit. Must be called after processing snap-to-road
// response.
function getAndDrawSpeedLimits() {
  for (var i = 0; i <= placeIdArray.length / 100; i++) {
    // Ensure that no query exceeds the max 100 placeID limit.
    var start = i * 100;
    var end = Math.min((i + 1) * 100 - 1, placeIdArray.length);

    drawSpeedLimits(start, end);
  }
}

// Gets speed limits for a 100-segment path and draws a polyline color-coded by
// speed limit. Must be called after processing snap-to-road response.
function drawSpeedLimits(start, end) {
    var placeIdQuery = '';
    for (var i = start; i < end; i++) {
      placeIdQuery += '&placeId=' + placeIdArray[i];
    }

    $.get('https://roads.googleapis.com/v1/speedLimits',
        'key=' + getApiKeyFromStorage() + placeIdQuery,
        function(speedData) {
          processSpeedLimitResponse(speedData, start);
        }
    );
}

// // Draw a polyline segment (up to 100 road segments) color-coded by speed limit.
function processSpeedLimitResponse(speedData, start) {
  var end = start + speedData.speedLimits.length;
  for (var i = 0; i < speedData.speedLimits.length - 1; i++) {
    var speedLimit = speedData.speedLimits[i].speedLimit;
    var color = getColorForSpeed(speedLimit);

    // Take two points for a single-segment polyline.
    var coords = snappedCoordinates.slice(start + i, start + i + 2);

    var snappedPolyline = new google.maps.Polyline({
      path: coords,
      strokeColor: color,
      strokeWeight: 6
    });
    snappedPolyline.setMap(map);
    polylines.push(snappedPolyline);
  }
}

function getColorForSpeed(speed_kph) {
  if (speed_kph <= 40) {
    return 'purple';
  }
  if (speed_kph <= 50) {
    return 'blue';
  }
  if (speed_kph <= 60) {
    return 'green';
  }
  if (speed_kph <= 80) {
    return 'yellow';
  }
  if (speed_kph <= 100) {
    return 'orange';
  }
  return 'red';
}

// @TODO Auto unlock if key in localstorage
// getApiKey()
//   .then((apiKey) => {
//     console.log("apiKey:", apiKey)
//     if (apiKey) loadApi().then(initialize())
//   })
//   .catch((err) => {
//     console.log(err.message);
//     lock();
//     // button.click()
// })
// if (getApiKeyFromStorage()) loadApi().then(initialize())

function gm_authFailure() {
  alert("Invalid key");
  unLoadApi();
  lock();
};
