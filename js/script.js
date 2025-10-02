// ---------------- Utility RNG ----------------
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------- Map Setup ----------------
const map = L.map("map").setView([1.3521, 103.8198], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

let points = [];
let markers = [];
let routeLine = null;

// ---------------- Load Locations ----------------
let locationsData = [];
const regions = ["north", "south", "east", "west", "central"];
Promise.all(regions.map(r => fetch(`data/${r}.json`).then(res => res.json())))
  .then(dataArrays => { locationsData = dataArrays.flat(); })
  .catch(err => console.error("Failed to load locations:", err));

// ---------------- Autocomplete Search ----------------
const searchInput = document.getElementById("locationSearch");
const suggestionsList = document.getElementById("suggestions");

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  suggestionsList.innerHTML = "";
  if (!locationsData.length || query.length < 1) return;

  const matches = locationsData.filter(loc =>
    loc.SEARCHVAL.toLowerCase().includes(query) ||
    loc.ADDRESS.toLowerCase().includes(query)
  ).slice(0, 5);

  matches.forEach(loc => {
  const li = document.createElement("li");

  // Create separate divs for name and address
  const nameDiv = document.createElement("div");
  nameDiv.classList.add("suggestion-name");
  nameDiv.textContent = loc.SEARCHVAL;

  const addressDiv = document.createElement("div");
  addressDiv.classList.add("suggestion-address");
  addressDiv.textContent = loc.ADDRESS;

  li.appendChild(nameDiv);
  li.appendChild(addressDiv);

  li.addEventListener("click", () => {
    addDestination([parseFloat(loc.LATITUDE), parseFloat(loc.LONGITUDE)]);
    searchInput.value = loc.SEARCHVAL;
    suggestionsList.innerHTML = "";
  });

  suggestionsList.appendChild(li);
  });
});

// ---------------- Add Start / Destination ----------------
function addStart(latlng) {
  points[0] = { lat: latlng[0], lng: latlng[1] };
  const marker = L.marker(latlng).addTo(map).bindPopup("Start").openPopup();
  markers[0] = marker;
}

function addDestination(latlng) {
  points[1] = { lat: latlng[0], lng: latlng[1] };
  if (markers[1]) map.removeLayer(markers[1]);
  const marker = L.marker(latlng).addTo(map).bindPopup("Destination").openPopup();
  markers[1] = marker;

  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline([points[0], points[1]], { color: "blue" }).addTo(map);
  map.fitBounds(routeLine.getBounds());

  document.getElementById("ridesContent").classList.remove("hidden");
  randomizeRides(); // Show ride options after destination is selected
}

// ---------------- Auto-set Start Location ----------------
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      addStart([userLat, userLng]);
      map.setView([userLat, userLng], 14);
      searchInput.placeholder = "Search your destination...";
    },
    (error) => { console.warn("Geolocation error:", error); },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
} else {
  console.warn("Geolocation not supported.");
}

// ---------------- Randomize Rides ----------------
function randomizeRides() {
  const rides = document.querySelectorAll(".riders");
  rides.forEach((ride) => {
    const driversElement = ride.querySelector("p:nth-child(2)");
    const rateElement = ride.querySelector("p:nth-child(3)");

    const driverCount = getRandomInt(1, 5);
    driversElement.textContent = `Drivers: ${driverCount}`;

    const prices = [];
    for (let i = 0; i < driverCount; i++) {
      prices.push((Math.random() * 20 + 10).toFixed(2));
    }
    ride.dataset.prices = JSON.stringify(prices);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    rateElement.textContent = driverCount > 1 ? `Rate: $${minPrice} - $${maxPrice}` : `Rate: $${prices[0]}`;
  });
}

// ---------------- Ride Page ----------------
document.addEventListener("DOMContentLoaded", () => {
  const carsDiv = document.getElementById("cars");
  const rideMapEl = document.getElementById("rideMap");
  if(carsDiv && rideMapEl){
    const params = new URLSearchParams(window.location.search);
    const startLat = parseFloat(params.get("startLat"))||1.3521;
    const startLng = parseFloat(params.get("startLng"))||103.8198;
    const destLat = parseFloat(params.get("destLat"))||1.3521;
    const destLng = parseFloat(params.get("destLng"))||103.8198;
    const prices = JSON.parse(params.get("prices")||"[]");

    const rideMap = L.map("rideMap").setView([startLat,startLng],14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, attribution:"© OpenStreetMap"}).addTo(rideMap);
    L.marker([startLat,startLng]).addTo(rideMap).bindPopup("Start").openPopup();
    L.marker([destLat,destLng]).addTo(rideMap).bindPopup("Destination");
    L.polyline([[startLat,startLng],[destLat,destLng]],{color:"blue"}).addTo(rideMap);

    // Drivers
    let drivers = prices.map(p=>({price:parseFloat(p), eta:getRandomInt(2,12)}));
    const carIcon = L.icon({iconUrl:"https://img.icons8.com/color/48/car.png",iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-40]});
    drivers.forEach((driver,i)=>{
      const offsetLat = (Math.random()-0.5)*0.01;
      const offsetLng = (Math.random()-0.5)*0.01;
      L.marker([startLat+offsetLat, startLng+offsetLng], {icon:carIcon})
        .addTo(rideMap)
        .bindPopup(`Driver ${i+1} - $${driver.price} - ETA: ${driver.eta} mins`);
    });

    const carImages = ["https://img.icons8.com/color/48/car.png","https://img.icons8.com/color/48/taxi.png","https://img.icons8.com/color/48/suv.png"];

    function renderDrivers(sortBy="time"){
      if(sortBy==="price") drivers.sort((a,b)=>a.price-b.price);
      else drivers.sort((a,b)=>a.eta-b.eta);
      carsDiv.innerHTML="";
      drivers.forEach((driver,i)=>{
        const carImg = carImages[getRandomInt(0,carImages.length-1)];
        const car = document.createElement("div");
        car.classList.add("car-card");
        car.innerHTML = `<img src="${carImg}" alt="car"><p>Driver ${i+1} - $${driver.price} - ETA: ${driver.eta} mins</p>`;
        carsDiv.appendChild(car);
        car.addEventListener("click",()=>window.location.href=`accepted.html?startLat=${startLat}&startLng=${startLng}&destLat=${destLat}&destLng=${destLng}&driver=${i+1}&eta=${driver.eta}`);
      });
    }
    renderDrivers();

    const sortBySelect = document.getElementById("sortBy");
    if(sortBySelect) sortBySelect.addEventListener("change",(e)=>renderDrivers(e.target.value));
  }
});

// ---------------- Accepted Page ----------------
document.addEventListener("DOMContentLoaded",()=>{
  const mapEl = document.getElementById("acceptedMap");
  if(mapEl){
    const params = new URLSearchParams(window.location.search);
    const startLat = parseFloat(params.get("startLat"));
    const startLng = parseFloat(params.get("startLng"));
    const destLat = parseFloat(params.get("destLat"));
    const destLng = parseFloat(params.get("destLng"));
    const driverChosen = params.get("driver");
    let countdown = parseInt(params.get("eta"))*60||300;

    const acceptedMap = L.map("acceptedMap").setView([startLat,startLng],14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, attribution:"© OpenStreetMap"}).addTo(acceptedMap);
    L.marker([startLat,startLng]).addTo(acceptedMap).bindPopup("Start").openPopup();
    L.marker([destLat,destLng]).addTo(acceptedMap).bindPopup("Destination");
    L.polyline([[startLat,startLng],[destLat,destLng]],{color:"blue"}).addTo(acceptedMap);

    const carIcon = L.icon({iconUrl:"https://img.icons8.com/color/48/car.png",iconSize:[40,40],iconAnchor:[20,40],popupAnchor:[0,-40]});
    L.marker([startLat,startLng],{icon:carIcon}).addTo(acceptedMap).bindPopup(`Driver ${driverChosen} is coming!`);

    // Countdown
    const timerEl = document.getElementById("timer");
    const interval = setInterval(()=>{
      if(countdown<=0){clearInterval(interval);timerEl.textContent="Driver has arrived!";}
      else {const mins=Math.floor(countdown/60);const secs=countdown%60; timerEl.textContent=`${mins}:${secs.toString().padStart(2,"0")} remaining`; countdown--;}
    },1000);

    // Driver Info
    const driverNames = ["John","Marvin","Bautista","Llamas","Naufal","Shukran","Omar"];
    const carModels = ["Lamborghini Sesto Elemento","Nissan Skyline GT-R R34","Lamborghini Countach","Pagani Zonda","Ferrari Enzo","Porsche Carrera GT"];
    function generateCarPlate(){const l="ABCDEFGHIJKLMNOPQRSTUVWXYZ"; return "S"+l.charAt(getRandomInt(0,25))+l.charAt(getRandomInt(0,25))+getRandomInt(1000,9999)+l.charAt(getRandomInt(0,25));}
    function generateRating(){return (Math.random()*1.5+3.5).toFixed(1);}
    function loadDriver(){
      const randomDriver=driverNames[getRandomInt(0,driverNames.length-1)];
      const randomCar=carModels[getRandomInt(0,carModels.length-1)];
      const randomPlate=generateCarPlate();
      const randomRating=generateRating();
      document.getElementById("driverName").textContent=randomDriver;
      document.getElementById("carModel").textContent=randomCar;
      document.getElementById("carPlate").textContent=randomPlate;
      document.getElementById("driverRating").textContent=randomRating;
    }
    loadDriver();

    // Cancel button
    const cancelBtn = document.getElementById("cancelBtn");
    if(cancelBtn) cancelBtn.addEventListener("click",()=>{
      if(confirm("Are you sure you want to cancel this booking? A penalty fee will apply.")){
        alert("Your booking has been cancelled. A cancellation penalty of $5 will be charged.");
        window.location.href="index.html";
      }
    });
  }
});
