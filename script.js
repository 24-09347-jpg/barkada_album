// --- CLOUDINARY CONFIGURATION ---
const CLOUD_NAME = "oqfy8bpi";
const UPLOAD_PRESET = "unsigned_preset123";

let allPhotos = [];
let currentLightboxIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
  fetchPhotosFromCloudinary();
});

// Fetch all uploaded photos from Cloudinary using Tagging
async function fetchPhotosFromCloudinary() {
  try {
    const response = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/barkada_album.json`);
    
    if (response.ok) {
      const data = await response.json();
      allPhotos = data.resources.map(img => ({
        url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${img.version}/${img.public_id}.${img.format}`,
        title: img.context?.custom?.caption || "Barkada Memory",
        desc: img.context?.custom?.alt || "Mga alaala ng ating barkada",
        category: img.context?.custom?.category || "outings"
      }));
      renderGallery();
    } else {
      renderGallery(); // Render empty/local if no photos tagged yet
    }
  } catch (error) {
    console.log("Wala pang photos sa Cloudinary:", error);
    renderGallery();
  }
}

// Upload Photos directly to Cloudinary Cloud
async function addPhotos(event) {
  event.preventDefault();

  const fileInput = document.getElementById('photo-file');
  const titleInput = document.getElementById('photo-title').value;
  const descInput = document.getElementById('photo-desc').value;
  const categoryInput = document.getElementById('photo-category').value;
  const submitBtn = document.querySelector('.submit-btn');

  const files = Array.from(fileInput.files);
  if (files.length === 0) return;

  submitBtn.innerText = "Ina-upload sa Cloud...";
  submitBtn.disabled = true;

  try {
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('tags', 'barkada_album'); // Essential for grouping photos
      
      // Attach Metadata (Title, Desc, Category)
      const photoTitle = files.length > 1 ? `${titleInput} (${i + 1})` : titleInput;
      formData.append('context', `caption=${photoTitle}|alt=${descInput}|category=${categoryInput}`);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      
      // Add newly uploaded image to display grid
      allPhotos.unshift({
        url: data.secure_url,
        title: photoTitle,
        desc: descInput,
        category: categoryInput
      });
    }

    renderGallery();
    document.getElementById('upload-form').reset();
    document.getElementById('file-name-display').innerText = "I-click para mag-upload (Madamihan)";
    toggleUploadModal();
  } catch (err) {
    console.error("Upload Error:", err);
    alert("Nagkaroon ng problema sa pag-upload. Pakisuri ang Cloud Name/Preset.");
  } finally {
    submitBtn.innerText = "I-post sa Album";
    submitBtn.disabled = false;
  }
}

// --- Render & UI Gallery Controls ---

function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  galleryGrid.innerHTML = '';

  if (allPhotos.length === 0) {
    galleryGrid.innerHTML = '<p style="text-align:center; color:#a1a1aa; grid-column: 1/-1; padding: 50px;">Wala pang memories sa Cloud. Mag-add ka na!</p>';
    return;
  }

  allPhotos.forEach((photo, index) => {
    const cardHTML = `
      <div class="photo-card" data-category="${photo.category}" onclick="openLightbox(${index})">
        <img src="${photo.url}" alt="${photo.title}">
        <div class="photo-info">
          <h3>${photo.title}</h3>
          <p>${photo.desc}</p>
        </div>
      </div>
    `;
    galleryGrid.insertAdjacentHTML('beforeend', cardHTML);
  });
}

function filterGallery(category) {
  const cards = document.querySelectorAll('.photo-card');
  const buttons = document.querySelectorAll('.filter-btn');

  buttons.forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  cards.forEach(card => {
    if (category === 'all' || card.dataset.category === category) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function toggleUploadModal() {
  const modal = document.getElementById('upload-modal');
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

function closeModalOutside(e) {
  if (e.target.id === 'upload-modal') toggleUploadModal();
}

function updateFileName(input) {
  const fileNameDisplay = document.getElementById('file-name-display');
  const files = input.files;
  if (files.length === 1) {
    fileNameDisplay.innerText = files[0].name;
  } else if (files.length > 1) {
    fileNameDisplay.innerText = `${files.length} na larawan ang napili`;
  }
}

function openLightbox(index) {
  currentLightboxIndex = index;
  updateLightboxContent();
  document.getElementById('lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function updateLightboxContent() {
  const photo = allPhotos[currentLightboxIndex];
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');

  lightboxImg.src = photo.url;
  lightboxCaption.innerText = `${photo.title} — ${photo.desc}`;
}

function changeImage(direction) {
  if (allPhotos.length <= 1) return;
  currentLightboxIndex += direction;

  if (currentLightboxIndex >= allPhotos.length) currentLightboxIndex = 0;
  if (currentLightboxIndex < 0) currentLightboxIndex = allPhotos.length - 1;

  updateLightboxContent();
}

function closeLightbox(event) {
  if (event.target.id === 'lightbox' || event.target.classList.contains('close-btn')) {
    closeLightboxForce();
  }
}

function closeLightboxForce() {
  document.getElementById('lightbox').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  const lightbox = document.getElementById('lightbox');
  if (lightbox.style.display === 'flex') {
    if (e.key === 'Escape') closeLightboxForce();
    if (e.key === 'ArrowRight') changeImage(1);
    if (e.key === 'ArrowLeft') changeImage(-1);
  }
});

// --- LIVE CAMERA FEATURE ---
let mediaStream = null;
let capturedBlob = null;

// Open Camera Stream
async function openCameraModal() {
  const modal = document.getElementById('camera-modal');
  modal.style.display = 'flex';
  retakePhoto();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' }, // Use front camera (change to 'environment' for back camera)
      audio: false 
    });
    const video = document.getElementById('webcam');
    video.srcObject = mediaStream;
  } catch (err) {
    console.error("Camera Error:", err);
    alert("Hindi mabuksan ang camera. Siguraduhing pinayagan mo ang Camera Access sa browser settings.");
    closeCameraModal();
  }
}

// Snap Frame to Canvas
function snapPhoto() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('camera-canvas');
  const preview = document.getElementById('captured-preview');

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    capturedBlob = blob;
    preview.src = URL.createObjectURL(blob);
    
    video.style.display = 'none';
    preview.style.display = 'block';

    document.getElementById('snap-btn').style.display = 'none';
    document.getElementById('retake-btn').style.display = 'block';
    document.getElementById('camera-details').style.display = 'flex';
  }, 'image/jpeg');
}

// Reset camera to take another shot
function retakePhoto() {
  const video = document.getElementById('webcam');
  const preview = document.getElementById('captured-preview');

  video.style.display = 'block';
  preview.style.display = 'none';

  document.getElementById('snap-btn').style.display = 'block';
  document.getElementById('retake-btn').style.display = 'none';
  document.getElementById('camera-details').style.display = 'none';
  capturedBlob = null;
}

// Close modal and stop hardware camera feed
function closeCameraModal() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('camera-modal').style.display = 'none';
}

function closeCameraOutside(e) {
  if (e.target.id === 'camera-modal') closeCameraModal();
}

// Upload Snapshot to Cloudinary
async function uploadCapturedPhoto() {
  if (!capturedBlob) return;

  const titleInput = document.getElementById('cam-title').value || "Camera Selfie";
  const descInput = document.getElementById('cam-desc').value || "Kinuha sa live camera";
  const categoryInput = document.getElementById('cam-category').value;
  const saveBtn = document.getElementById('save-cam-btn');

  saveBtn.innerText = "Ina-upload...";
  saveBtn.disabled = true;

  const formData = new FormData();
  formData.append('file', capturedBlob, `cam_${Date.now()}.jpg`);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('tags', 'barkada_album');
  formData.append('context', `caption=${titleInput}|alt=${descInput}|category=${categoryInput}`);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    allPhotos.unshift({
      url: data.secure_url,
      title: titleInput,
      desc: descInput,
      category: categoryInput
    });

    renderGallery();
    closeCameraModal();
  } catch (err) {
    console.error("Upload Error:", err);
    alert("Nagkaroon ng problema sa pag-save ng larawan sa Cloud.");
  } finally {
    saveBtn.innerText = "I-save sa Album";
    saveBtn.disabled = false;
  }
}
const downloadBtn = document.getElementById('downloadBtn');

if (downloadBtn) {
  downloadBtn.addEventListener('click', async function() {
    // ⚠️ MAHALAGA: Palitan ang 'lightboxImage' sa ibaba 
    // kung iba ang ID ng pinalaking picture sa HTML mo (hal. 'enlargedPhoto')
    const imgElement = document.getElementById('Enlarged photo'); 

    if (!imgElement || !imgElement.src) {
      alert('Walang larawang mahanap!');
      return;
    }

    try {
      // Magpalit ng text para alam ng user na nagse-save na
      downloadBtn.innerText = '⌛ Dinadownload...';
      downloadBtn.disabled = true;

      // Kuhanin ang mismong image file
      const response = await fetch(imgElement.src);
      const blob = await response.blob();

      // Gumawa ng temporary link para idownload ang file
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = `Barkada-Memory-${Date.now()}.jpg`;
      
      document.body.appendChild(tempLink);
      tempLink.click();

      // Linisin ang temporary link
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: Kung i-block ng browser, bubuksan sa bagong window para ma-long press/save
      window.open(imgElement.src, '_blank');
    } finally {
      downloadBtn.innerText = 'Download';
      downloadBtn.disabled = false;
    }
  });
}