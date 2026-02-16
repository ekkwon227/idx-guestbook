
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- DOM Elements ---
const entriesDiv = document.getElementById('guestbook-entries');
const form = document.getElementById('guestbook-form');
const lengthFilter = document.getElementById('length-filter');

const imagePopup = document.getElementById('image-popup');
const popupImageContent = document.getElementById('popup-image-content');
const imagePopupCloseButton = document.querySelector('#image-popup .close-button');

const deleteModal = document.getElementById('delete-modal');
const deletePasswordInput = document.getElementById('delete-password-input');
const confirmDeleteButton = document.getElementById('confirm-delete');
const cancelDeleteButton = document.getElementById('cancel-delete');
const errorMessageDiv = document.getElementById('error-message'); // Error message div

let allEntries = [];

// --- Functions ---

function renderEntries(entries) {
    const minLength = parseInt(lengthFilter.value, 10) || 0;
    const filteredEntries = entries.filter(entry => entry.message && entry.message.length >= minLength);

    entriesDiv.innerHTML = filteredEntries.map(entry => {
        let imageUrl = entry.image_url;
        if (imageUrl && !imageUrl.startsWith('http')) {
            const { data: urlData } = supabaseClient.storage.from('images').getPublicUrl(entry.image_url);
            imageUrl = urlData.publicUrl;
        }

        return `
            <div class="guestbook-entry" id="entry-${entry.id}">
                <h3>${entry.name}</h3>
                <p>${entry.message}</p>
                ${imageUrl ? `<img src="${imageUrl}" alt="Thumbnail for ${entry.name}" class="thumbnail">` : ''}
                <div class="entry-actions">
                    <button class="like-button">Like (${entry.likes || 0})</button>
                    <button class="delete-button">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    filteredEntries.forEach(entry => {
        const entryElement = document.getElementById(`entry-${entry.id}`);
        entryElement.querySelector('.delete-button').addEventListener('click', () => showDeleteModal(entry.id));
        entryElement.querySelector('.like-button').addEventListener('click', () => handleLike(entry.id, entry.likes || 0));
        const thumbnail = entryElement.querySelector('.thumbnail');
        if (thumbnail) {
            thumbnail.addEventListener('click', () => openImagePopup(thumbnail.src));
        }
    });
}

async function fetchAndRenderGuestbook() {
    const { data, error } = await supabaseClient.from('guestbook').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching entries:', error); return; }
    allEntries = data;
    renderEntries(allEntries);
}

async function handleLike(id, currentLikes) {
    const newLikes = currentLikes + 1;
    const { error } = await supabaseClient.from('guestbook').update({ likes: newLikes }).eq('id', id);
    if (error) {
        console.error('Error updating likes:', error);
    } else {
        const entry = allEntries.find(e => e.id === id);
        if (entry) entry.likes = newLikes;
        document.querySelector(`#entry-${id} .like-button`).textContent = `Like (${newLikes})`;
    }
}

function showDeleteModal(id) {
    errorMessageDiv.textContent = ''; // Clear previous error messages
    deleteModal.style.display = 'flex';
    confirmDeleteButton.dataset.entryId = id;
}

function hideDeleteModal() {
    deleteModal.style.display = 'none';
    deletePasswordInput.value = '';
    errorMessageDiv.textContent = ''; // Also clear on cancel
}

async function handleDeleteConfirm() {
    const id = confirmDeleteButton.dataset.entryId;
    const enteredPassword = deletePasswordInput.value;
    errorMessageDiv.textContent = ''; // Clear previous error messages

    if (!enteredPassword) {
        errorMessageDiv.textContent = 'Please enter a password.';
        return;
    }

    const { data, error: fetchError } = await supabaseClient.from('guestbook').select('password').eq('id', id).single();

    if (fetchError || !data) {
        errorMessageDiv.textContent = 'Could not verify password. Please try again.';
        return;
    }

    if (data.password === enteredPassword) {
        const { error: deleteError } = await supabaseClient.from('guestbook').delete().eq('id', id);
        if (deleteError) {
            errorMessageDiv.textContent = 'Failed to delete entry.';
        } else {
            hideDeleteModal();
            fetchAndRenderGuestbook();
        }
    } else {
        errorMessageDiv.textContent = 'Incorrect password.'; // Display error in the modal
        deletePasswordInput.focus();
    }
}

function openImagePopup(imageUrl) {
    popupImageContent.src = imageUrl;
    imagePopup.style.display = 'flex';
}

function closeImagePopup() {
    imagePopup.style.display = 'none';
}

// --- Event Listeners ---

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const message = document.getElementById('content').value;
    const password = document.getElementById('password').value;
    const imageFile = document.getElementById('image').files[0];
    let image_path = null;
    if (imageFile) {
        const filePath = `guestbook/${Date.now()}_${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('images').upload(filePath, imageFile);
        if (uploadError) { console.error('Error uploading image:', uploadError); return; }
        image_path = uploadData.path;
    }
    const { error: insertError } = await supabaseClient.from('guestbook').insert([{ name, message, password, image_url: image_path }]);
    if (insertError) {
        console.error('Error inserting entry:', insertError);
    } else {
        form.reset();
        fetchAndRenderGuestbook();
    }
});

lengthFilter.addEventListener('input', () => renderEntries(allEntries));

imagePopupCloseButton.addEventListener('click', closeImagePopup);
imagePopup.addEventListener('click', (e) => { if (e.target === imagePopup) closeImagePopup(); });

cancelDeleteButton.addEventListener('click', hideDeleteModal);
confirmDeleteButton.addEventListener('click', handleDeleteConfirm);
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) hideDeleteModal(); });

// --- Initial Load ---
fetchAndRenderGuestbook();
