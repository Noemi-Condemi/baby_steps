const submitBtn = document.getElementById('submitBtn');
const usernameInput = document.getElementById('username');
const submitEntryBtn = document.getElementById('submitEntryBtn');
const weekInput = document.getElementById('week');
const moodInput = document.getElementById('mood');
const weightInput = document.getElementById('weight');
const unitInput = document.getElementById('unit');
const notesInput = document.getElementById('notes');
const journalList = document.getElementById('journalList');
const continueBtn = document.getElementById('continueBtn');
const addEntryBtn = document.getElementById('addEntryBtn');
const viewAllBtn = document.getElementById('viewAllBtn');
const showProgressBtn = document.getElementById('showProgressBtn');
const backFromAddBtn = document.getElementById('backFromAddBtn');
const backFromViewBtn = document.getElementById('backFromViewBtn');
const backFromProgressBtn = document.getElementById('backFromProgressBtn');
const startDateInput = document.getElementById('startDate');
const toggleBtn = document.getElementById('toggleSymptoms');
const extraSymptoms = document.getElementById('extraSymptoms');

const today = new Date().toISOString().split('T')[0];
startDateInput.max = today;


let journalEntries = [];
let editingEntryId = null;
let pendingDeleteId = null;
let openEntryId = null;

// -------- HELPER FUNCTIONS -------- 

function formatDateForInput(ddmmyyyy) {
    if (!ddmmyyyy) return "";
    const parts = ddmmyyyy.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatDateForDB(yyyymmdd){
    if (!yyyymmdd) return "";
    const parts = yyyymmdd.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function animateIn(element, animationClass = 'fade-in-up'){
    // Reset animation
    element.classList.remove(animationClass);
    void element.offsetWidth;

    // Trigger animation
    element.classList.add(animationClass);
}

function hideAllScreens(){
    document.getElementById('welcomeScreen').style.display = "none";
    document.getElementById('greetingScreen').style.display = "none";
    document.getElementById('mainMenu').style.display = "none";
    document.getElementById('addJournal').style.display = "none";
    document.getElementById('journal').style.display = "none";
    document.getElementById('progress').style.display = "none";
}

function clearEntryForm() {
    updateWeekDisplay();
    moodInput.value = '';
    weightInput.value = '';
    notesInput.value = '';
    document.querySelectorAll('input[name="symptoms"]').forEach(cb => cb.checked = false);
}

function updateWeekDisplay(value = null) {
    const week = value ?? calculateCurrentWeek();
    document.getElementById('weekDisplay').textContent = week || '-';
}

function calculateCurrentWeek(){
    if (!startDateInput.value) return 0;

    const startDate = new Date(startDateInput.value);
    const differenceInMs = new Date() - startDate; 
    const differenceInDays = differenceInMs / (1000 * 60 * 60 *24);
    
    return Math.max(Math.floor(differenceInDays / 7) +1, 0); 
}


// -------- USER FUNCTIONS -------- 

async function checkUser(){
    const response = await fetch("/user");
    const data = await response.json();
    const greetingScreen = document.getElementById('greetingScreen');

    if (data.username) {
        hideAllScreens();
        greetingScreen.style.display = 'flex';
        animateIn(greetingScreen);

        // Set greeting text
        document.getElementById('welcomeText').textContent = "✨ Welcome Back ✨";
        document.getElementById('greetingTitle').textContent = data.username + "!";
        
        // set unit selector
        if (data.unit) unitInput.value = data.unit;

        // fill start date if saved
        if (data.start_date) {
            startDateInput.value = formatDateForInput(data.start_date);
        }
    } 
}


async function handleNameSubmit(){
    const username = usernameInput.value.trim();
    const unit = unitInput.value;
    const start_date = formatDateForDB(startDateInput.value);
    const greetingScreen = document.getElementById('greetingScreen');


    // Clear error messages
    document.getElementById('nameError').textContent ='';
    document.getElementById('dateError').textContent ='';

    if (!username) {
        document.getElementById('nameError').textContent ="Please enter your name.";
        return;
    }

    if (!startDateInput.value) {
        document.getElementById('dateError').textContent = "Please select the date of your last period.";
        return
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (startDateInput.value > todayStr) {
        document.getElementById('dateError').textContent = "Start date cannot be in the future";
        return;
    }

    // Send username and unit to Flask 
    await fetch("/user", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body:JSON.stringify({ username, unit, start_date})
    });

    hideAllScreens();
    greetingScreen.style.display ='flex';
    animateIn(greetingScreen);

    document.getElementById('welcomeText').textContent = "✨ Hello ✨";  
    document.getElementById('greetingTitle').textContent = username + "!";
}


// -------- JOURNAL FUNCTIONS  -------- 

async function loadEntries(){
    const response = await fetch("/entries");
    journalEntries = await response.json();
    renderEntries();
}


function renderEntries(){
    journalList.innerHTML = '';
    journalEntries.forEach(displayEntry);
}

function displayEntry(entry){
    const li = document.createElement('li')
    li.classList.add('entry-card')

    const summaryMood = entry.mood || "No mood";
    const summarySymptoms = entry.symptoms.length ? entry.symptoms.join(', ') : "No symptoms";
    const showDeleteConfirm = pendingDeleteId === entry.id;
    const isEntryOpen = openEntryId === entry.id || showDeleteConfirm;

    const actionSection = showDeleteConfirm
        ? `
        <div class="delete-confirmation">
            <span>Delete this entry?</span>
            <div class="delete-confirm-buttons">
                <button class="cancel-delete-btn" type="button">Cancel</button>
                <button class="confirm-delete-btn" type="button">Delete</button>
            </div>
        </div>
        `
        :`
        <div class="entry-actions">
            <button class="edit-btn" type="button">Edit</button>
            <button class="delete-btn" type="button">Delete</button>
        </div>
        `;

    li.innerHTML=`
        <div class="entry-top">
            <div class="entry-main-line">
                <span class="entry-header">Week ${entry.week}</span>
                <span class="entry-datetime">${entry.date} • ${entry.time}</span>
            </div>

            <button class="toggle-btn" type="button">View</button>
        </div>

        <div class="entry-summary">${summaryMood} • ${summarySymptoms}</div>
                    
        <div class="entry-body">
            <p><strong>Mood:</strong> ${entry.mood || "-"}</p>
            <p><strong>Symptoms:</strong> ${entry.symptoms.join(', ') || "-"}</p>
            <p><strong>Weight:</strong> ${entry.weight !=null ? entry.weight + ' ' + entry.unit : "-"}</p>
            <p><strong>Notes:</strong> ${entry.notes || "-"}</p>
        
            ${actionSection}
        </div>
    `;

    const toggleBtn = li.querySelector('.toggle-btn');
    const entryBody = li.querySelector('.entry-body');

    toggleBtn.addEventListener('click', () => {
        if (openEntryId === entry.id) {
            openEntryId = null;
        } else {
            openEntryId = entry.id;
        }
        renderEntries();
    });

    if (isEntryOpen) {
        entryBody.classList.add('open');
        toggleBtn.textContent = 'Hide';
    }

    if (showDeleteConfirm) {
        li.querySelector('.cancel-delete-btn').addEventListener('click', () => {
            pendingDeleteId = null;
            openEntryId = entry.id;
            renderEntries();
        });
        
        li.querySelector(".confirm-delete-btn").addEventListener('click', async () => {
            pendingDeleteId = null;
            openEntryId = null;
            await deleteEntry(entry.id);
        });
    } else {
        li.querySelector(".edit-btn").addEventListener('click', () => editEntry(entry));

        li.querySelector(".delete-btn").addEventListener('click', () => { 
            pendingDeleteId = entry.id;
            openEntryId = entry.id;
            renderEntries();
        });
    };

    journalList.appendChild(li);   
}

function editEntry(entry) {
    showAddJournal();

    editingEntryId = entry.id;
    submitEntryBtn.textContent = "Update";

    updateWeekDisplay(entry.week);
    moodInput.value = entry.mood || "";
    weightInput.value = entry.weight || "";
    notesInput.value = entry.notes || "";
    unitInput.value = entry.unit;

    document.querySelectorAll('input[name="symptoms"]').forEach(cb => { 
        cb.checked = entry.symptoms.includes(cb.value);
    });
}


async function updateEntry(id){
    const weekText = document.getElementById('weekDisplay').textContent;
    const week = parseInt(weekText, 10) || 0;

    const entry = {
        week,
        mood: moodInput.value,
        weight: weightInput.value,
        unit: unitInput.value,
        symptoms: Array.from(document.querySelectorAll('input[name="symptoms"]:checked')).map(cb => cb.value),
        notes: notesInput.value
    };

    await fetch(`/update_entry/${id}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(entry)
     });


    await loadEntries();
    clearEntryForm();
}


async function handleEntrySubmit() {
    if (editingEntryId) {
        await updateEntry(editingEntryId);
        editingEntryId = null;
        submitEntryBtn.textContent = "Submit";
        showJournal();
        return;
    }

    const weekText = document.getElementById('weekDisplay').textContent;
    const week = parseInt(weekText, 10) || 0;

    if (week == 0) {
        document.getElementById('dateError').textContent = "Please select the date of your last period.";
        return;
    }

    document.getElementById('dateError').textContent = '';

    const entry = {
        week,
        mood: moodInput.value,
        weight: weightInput.value,
        unit: unitInput.value,
        symptoms: Array.from(document.querySelectorAll('input[name="symptoms"]:checked')).map(cb => cb.value),
        notes: notesInput.value
    };

    // Send entry to Flask
    await fetch("/add_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(entry)
    });

    // Fetch updated list of entries from Flask
    await loadEntries();

    //Fetch update progress
    const progressResponse = await fetch("/progress");
    const progressData = await progressResponse.json();
    displayProgress(progressData);

    clearEntryForm();
    showMenu();
}


async function deleteEntry(id){
    await fetch(`/delete_entry/${id}`, { method: "DELETE" });
    await loadEntries();
}


// -------- NAVIGATION  -------- 

function showAddJournal() {
    hideAllScreens();
    document.getElementById('addJournal').style.display = 'flex';
    updateWeekDisplay();
}


function goBackAdd() {
    hideAllScreens();

    if (editingEntryId){
        editingEntryId = null;
        submitEntryBtn.textContent = "Submit";
        document.getElementById('journal').style.display = 'flex';
    } else{
        document.getElementById('mainMenu').style.display = 'flex';
    }    
}


function showJournal() {
    hideAllScreens();
    document.getElementById('journal').style.display = 'flex';
    renderEntries();
}


function goBackView() {
    hideAllScreens();
    document.getElementById('mainMenu').style.display = 'flex';
}


async function showProgress(){
    hideAllScreens();
    document.getElementById('progress').style.display ='flex';

    const response = await fetch("/progress");
    const data = await response.json();
    displayProgress(data);
}


function displayProgress(data){
    document.getElementById("progressTotal").textContent = `Total entries: ${data.total}`;
    document.getElementById("progressWeek").textContent = `Latest week: ${data.latest_week}`;
    document.getElementById("progressSymptom").textContent = `Most common symptom: ${data.most_common_symptom}`;
    document.getElementById("progressMood").textContent = `Most frequent mood: ${data.average_mood}`;
}


function goBackProgress() {
    hideAllScreens();
    document.getElementById('mainMenu').style.display = 'flex';
}


function showMenu(){
    hideAllScreens();
    document.getElementById('mainMenu').style.display = 'flex';
}


// -------- EVENT LISTENERS --------

window.addEventListener('DOMContentLoaded', async() => { 
    await checkUser(); 
    await loadEntries();

    const response = await fetch("/progress");
    const data = await response.json();
    displayProgress(data);
});


submitBtn.addEventListener('click', handleNameSubmit );
continueBtn.addEventListener('click', showMenu);
submitEntryBtn.addEventListener('click', handleEntrySubmit);
addEntryBtn.addEventListener('click', showAddJournal);
toggleBtn.addEventListener('click', () => {
    const isHidden = extraSymptoms.style.display ==='none';

    extraSymptoms.style.display = isHidden ? 'grid' : 'none';
    toggleBtn.textContent = isHidden ? '- Show less' : '+ More symptoms';
});
backFromAddBtn.addEventListener('click', goBackAdd);
viewAllBtn.addEventListener('click', showJournal);
backFromViewBtn.addEventListener('click', goBackView);
showProgressBtn.addEventListener('click', showProgress);
backFromProgressBtn.addEventListener('click', goBackProgress);

weightInput.addEventListener('input', () => {
    const value = parseFloat(weightInput.value);

    if (!isNaN(value) && value > 660.99) {
        weightInput.value = 660.99;
    }
});
