// ---------------- Utility RNG ----------------
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------- Map Setup ----------------
const mapEl = document.getElementById("map");
let map, points = [], markers = [], routeLine = null;
if (mapEl) {
  map = L.map("map").setView([1.3521, 103.8198], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);
}

// ---------------- Load Locations ----------------
let locationsData = [];
const regions = ["north", "south", "east", "west", "central"];

const startInputEl = document.getElementById("startSearch");
const endInputEl = document.getElementById("endSearch");

if (startInputEl) startInputEl.placeholder = "Loading locations...";
if (endInputEl) endInputEl.placeholder = "Loading locations...";

Promise.all(
  regions.map(r => fetch(`data/${r}.json`).then(res => res.json()))
).then(dataArrays => {
  locationsData = dataArrays.flat();
  console.log("Loaded locations:", locationsData.length);

  if (startInputEl && endInputEl) {
    setupSearch("startSearch", "startSuggestions", (latlng, loc) => addStart(latlng));
    setupSearch("endSearch", "endSuggestions", (latlng, loc) => addDestination(latlng));

    startInputEl.placeholder = "Search starting point...";
    endInputEl.placeholder = "Search destination...";
  }
}).catch(err => {
  console.error("Failed to load locations:", err);
  if (startInputEl) startInputEl.placeholder = "Error loading data";
  if (endInputEl) endInputEl.placeholder = "Error loading data";
});

Promise.all(
  regions.map(r => fetch(`data/${r}.json`).then(res => res.json()))
).then(dataArrays => {

  locationsData = dataArrays.flat();

  console.log("Loaded locations:", locationsData.length);

  setupSearch("startSearch", "startSuggestions", (latlng, loc) => addStart(latlng));
  setupSearch("endSearch", "endSuggestions", (latlng, loc) => addDestination(latlng));

  // update placeholder back
  document.getElementById("startSearch").placeholder = "Search starting point...";
  document.getElementById("endSearch").placeholder = "Search destination...";
}).catch(err => {
  console.error("Failed to load locations:", err);
  document.getElementById("startSearch").placeholder = "Error loading data";
  document.getElementById("endSearch").placeholder = "Error loading data";
});


// ---------------- Autocomplete Search for Start & Destination ----------------
const startInput = document.getElementById("startSearch");
const endInput = document.getElementById("endSearch");
const startSuggestions = document.getElementById("startSuggestions");
const endSuggestions = document.getElementById("endSuggestions");

// --- Improved autocomplete for start/end with keyboard navigation ---
function setupSearch(inputId, suggestionsId, onSelectCallback) {
  const input = document.getElementById(inputId);
  const suggestionsEl = document.getElementById(suggestionsId);
  if (!input || !suggestionsEl) return;

  let activeIndex = -1;
  let currentResults = [];
  let debounceTimer = null;

  function clearSuggestions() {
    suggestionsEl.innerHTML = "";
    activeIndex = -1;
    currentResults = [];
  }

  function renderResults(results) {
    suggestionsEl.innerHTML = "";
    currentResults = results;
    activeIndex = -1;

    results.forEach((loc, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.index = i;
      li.dataset.lat = loc.LATITUDE;
      li.dataset.lng = loc.LONGITUDE;

      const nameDiv = document.createElement("div");
      nameDiv.className = "suggestion-name";
      nameDiv.textContent = loc.SEARCHVAL;

      const addrDiv = document.createElement("div");
      addrDiv.className = "suggestion-address";
      addrDiv.textContent = loc.ADDRESS;

      li.appendChild(nameDiv);
      li.appendChild(addrDiv);

      li.addEventListener("mousedown", (ev) => {
        // use mousedown to avoid blur before click
        ev.preventDefault();
        selectSuggestion(i);
      });

      suggestionsEl.appendChild(li);
    });
  }

  function selectSuggestion(index) {
    if (index < 0 || index >= currentResults.length) return;
    const loc = currentResults[index];
    input.value = loc.SEARCHVAL;
    clearSuggestions();
    onSelectCallback([parseFloat(loc.LATITUDE), parseFloat(loc.LONGITUDE)], loc);
    input.focus();
  }

  // Debounced search
  function doSearch(q) {
    if (!locationsData || !locationsData.length) return clearSuggestions();
    const query = q.trim().toLowerCase();
    if (!query) return clearSuggestions();

    // filter and limit
    const matches = locationsData.filter(loc =>
      (loc.SEARCHVAL && loc.SEARCHVAL.toLowerCase().includes(query)) ||
      (loc.ADDRESS && loc.ADDRESS.toLowerCase().includes(query))
    )

    if (matches.length) renderResults(matches);
    else clearSuggestions();
  }

  // Input handler with small debounce
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(input.value), 160);
  });

  function updateActive(items) {
    items.forEach((it, idx) => {
      if (idx === activeIndex) it.classList.add("suggestion-active");
      else it.classList.remove("suggestion-active");
    });

    // ensure active is visible
    const el = items[activeIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  // Close suggestions on blur (allow short timeout for clicks)
  input.addEventListener("blur", () => {
    setTimeout(() => clearSuggestions(), 150);
  });

  // click outside closes suggestions
  document.addEventListener("click", (ev) => {
    if (!input.contains(ev.target) && !suggestionsEl.contains(ev.target)) {
      clearSuggestions();
    }
  });
}

// Attach searches (call this after locationsData has been loaded so suggestions work)
setupSearch("startSearch", "startSuggestions", (latlng, loc) => {
  addStart(latlng);
  // optional: you can store the start selection in sessionStorage if needed:
  // sessionStorage.setItem('selectedStart', JSON.stringify(loc));
});

setupSearch("endSearch", "endSuggestions", (latlng, loc) => {
  addDestination(latlng);
  // sessionStorage.setItem('selectedDest', JSON.stringify(loc));
});


// ---------------- Add Start / Destination ----------------
function addStart(latlng) {
  points[0] = { lat: latlng[0], lng: latlng[1] };
  if (!map) return;
  const marker = L.marker(latlng).addTo(map).bindPopup("Start").openPopup();
  markers[0] = marker;
}

function addDestination(latlng) {
  points[1] = { lat: latlng[0], lng: latlng[1] };
  if (!map) return;
  if (markers[1]) map.removeLayer(markers[1]);
  const marker = L.marker(latlng).addTo(map).bindPopup("Destination").openPopup();
  markers[1] = marker;

  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline([points[0], points[1]], { color: "blue" }).addTo(map);
  map.fitBounds(routeLine.getBounds());

  const ridesContent = document.getElementById("ridesContent");
  if (ridesContent) {
    ridesContent.classList.remove("hidden");
    randomizeRides();
  }
}

// ---------------- Randomize Rides ----------------
function randomizeRides() {
  const rides = document.querySelectorAll(".riders");
  rides.forEach(ride => {
    const driversElement = ride.querySelector("p:nth-child(2)");
    const rateElement = ride.querySelector("p:nth-child(3)");

    const driverCount = getRandomInt(1, 5);
    driversElement.textContent = `Drivers: ${driverCount}`;

    const prices = Array.from({length: driverCount}, () => (Math.random()*20+10).toFixed(2));
    ride.dataset.prices = JSON.stringify(prices);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    rateElement.textContent = driverCount > 1 ? `Rate: $${minPrice} - $${maxPrice}` : `Rate: $${prices[0]}`;

    // Click handler to ride page
    ride.onclick = () => {
      if (points.length === 2) {
        const start = points[0], dest = points[1];
        const encodedPrices = encodeURIComponent(ride.dataset.prices);
        window.location.href = `ride.html?startLat=${start.lat}&startLng=${start.lng}&destLat=${dest.lat}&destLng=${dest.lng}&prices=${encodedPrices}`;
      }
    };
  });
}

// ---------------- Ride Page ----------------
document.addEventListener("DOMContentLoaded", () => {
  const carsDiv = document.getElementById("cars");
  const rideMapEl = document.getElementById("rideMap");
  if (!carsDiv || !rideMapEl) return;

  const params = new URLSearchParams(window.location.search);
  const startLat = parseFloat(params.get("startLat")) || 1.3521;
  const startLng = parseFloat(params.get("startLng")) || 103.8198;
  const destLat  = parseFloat(params.get("destLat"))  || 1.3521;
  const destLng  = parseFloat(params.get("destLng"))  || 103.8198;

  // Safe parsing of prices
  let prices = [];
  try {
    prices = JSON.parse(decodeURIComponent(params.get("prices") || "[]"));
  } catch (e) {
    console.warn("Failed to parse prices:", e);
  }
  if (!prices.length) prices = [(Math.random()*20+10).toFixed(2),(Math.random()*20+10).toFixed(2),(Math.random()*20+10).toFixed(2)];

  // Initialize map
  const rideMap = L.map("rideMap").setView([startLat, startLng], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(rideMap);

  L.marker([startLat, startLng]).addTo(rideMap).bindPopup("Start").openPopup();
  L.marker([destLat, destLng]).addTo(rideMap).bindPopup("Destination");
  L.polyline([[startLat,startLng],[destLat,destLng]],{color:"blue"}).addTo(rideMap);

  // Drivers
  const drivers = prices.map(p => ({ price: parseFloat(p), eta: getRandomInt(2,12) }));
  const carImages = ["https://img.icons8.com/color/48/car.png","https://img.icons8.com/color/48/taxi.png","https://img.icons8.com/color/48/suv.png"];

  function renderDrivers(sortBy="time") {
    if(sortBy==="price") drivers.sort((a,b)=>a.price-b.price);
    else drivers.sort((a,b)=>a.eta-b.eta);
    carsDiv.innerHTML = "";

    drivers.forEach((driver,i) => {
      const carImg = carImages[getRandomInt(0,carImages.length-1)];
      const car = document.createElement("div");
      car.classList.add("car-card");
      car.innerHTML = `<img src="${carImg}" alt="car"><p>Driver ${i+1} - $${driver.price.toFixed(2)} - ETA: ${driver.eta} mins</p>`;
      carsDiv.appendChild(car);

      // Marker on map for visual effect
      const offsetLat = (Math.random() - 0.5) * 0.01;
      const offsetLng = (Math.random() - 0.5) * 0.01;
      L.marker([startLat+offsetLat, startLng+offsetLng], { icon: L.icon({ iconUrl: carImg, iconSize:[40,40], iconAnchor:[20,40] }) })
        .addTo(rideMap)
        .bindPopup(`Driver ${i+1} - $${driver.price.toFixed(2)} - ETA: ${driver.eta} mins`);

      // Click to Accepted page
      car.onclick = () => {
        window.location.href = `accepted.html?startLat=${startLat}&startLng=${startLng}&destLat=${destLat}&destLng=${destLng}&driver=${i+1}&eta=${driver.eta}`;
      };
    });
  }

  renderDrivers();
  const sortBySelect = document.getElementById("sortBy");
  if(sortBySelect) sortBySelect.onchange = (e)=>renderDrivers(e.target.value);
});



// ---------------- Accepted Page ----------------
document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("acceptedMap");
  if (mapEl) {
    const params = new URLSearchParams(window.location.search);
    const startLat = parseFloat(params.get("startLat"));
    const startLng = parseFloat(params.get("startLng"));
    const destLat = parseFloat(params.get("destLat"));
    const destLng = parseFloat(params.get("destLng"));
    const driverChosen = params.get("driver");
    let countdown = parseInt(params.get("eta")) * 60 || 300;

    // Initialize map
    const acceptedMap = L.map("acceptedMap").setView([startLat, startLng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(acceptedMap);

    // Start & Destination markers
    L.marker([startLat, startLng]).addTo(acceptedMap).bindPopup("Start").openPopup();
    L.marker([destLat, destLng]).addTo(acceptedMap).bindPopup("Destination");
    L.polyline([[startLat, startLng], [destLat, destLng]], { color: "blue" }).addTo(acceptedMap);

    // Driver marker
    const carIcon = L.icon({
      iconUrl: "https://img.icons8.com/color/48/car.png",
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
    L.marker([startLat, startLng], { icon: carIcon }).addTo(acceptedMap)
      .bindPopup(`Driver ${driverChosen} is coming!`);

    // Countdown timer
    const timerEl = document.getElementById("timer");
    const interval = setInterval(() => {
      if (countdown <= 0) {
        clearInterval(interval);
        timerEl.textContent = "Driver has arrived!";
      } else {
        const mins = Math.floor(countdown / 60);
        const secs = countdown % 60;
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")} remaining`;
        countdown--;
      }
    }, 1000);

    // Driver details
    const driverNames = ["John","Marvin","Bautista","Llamas","Naufal","Shukran","Omar", "Fern"];
    const carModels = ["Lamborghini Sesto Elemento","Nissan Skyline GT-R R34","Lamborghini Countach","Pagani Zonda","Ferrari Enzo","Porsche Carrera GT"];
    const driverImages = [
      "driver.png",
      "driver1.png",
      "driver2.png"
    ];

    function generateCarPlate() {
      const l = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return "S" + l.charAt(getRandomInt(0, 25)) + l.charAt(getRandomInt(0, 25)) + getRandomInt(1000, 9999) + l.charAt(getRandomInt(0, 25));
    }

    function generateRating() {
      return (Math.random() * 1.5 + 3.5).toFixed(1);
    }

    function loadDriver() {
      const randomDriver = driverNames[getRandomInt(0, driverNames.length - 1)];
      const randomCar = carModels[getRandomInt(0, carModels.length - 1)];
      const randomPlate = generateCarPlate();
      const randomRating = generateRating();
      const randomImage = driverImages[getRandomInt(0, driverImages.length - 1)];

      document.getElementById("driverName").textContent = randomDriver;
      document.getElementById("carModel").textContent = randomCar;
      document.getElementById("carPlate").textContent = randomPlate;
      document.getElementById("driverRating").textContent = randomRating;

      const driverImgEl = document.querySelector(".driver-photo");
      if (driverImgEl) driverImgEl.src = `images/${randomImage}`;
    }

    loadDriver();

    // Cancel booking button
    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        if (confirm("Are you sure you want to cancel this booking? A penalty fee will apply?")) {
          alert("Your booking has been cancelled. A cancellation penalty of $5 will be charged.");
          window.location.href = "index.html";
        }
      };
    }
  }
});