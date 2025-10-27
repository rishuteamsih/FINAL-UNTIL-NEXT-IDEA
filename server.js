// Firebase.js (merged: Firestore + Auth + Storage + Realtime DB tests)
// Use as ES module in browser. (Works with <script type="module"> or bundler)
//
// Example import:
// import * as FB from "./Firebase.js";
// await FB.signInWithEmailAndPassword(email, pass);
// const tests = await FB.getTest("test123");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import {
    getStorage,
    ref as sRef,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

import {
    getDatabase,
    ref as rRef,
    set as rSet,
    get as rGet,
    child as rChild,
    push as rPush,
    onValue as rOnValue
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ----------------------
// Config (keep your project keys)
// ----------------------
const firebaseConfig = {
    apiKey: "AIzaSyAFKmM22FUSQPYy-eMsBzcZN3bmAxglXl0",
    authDomain: "smart-timetable-266fe.firebaseapp.com",
    projectId: "smart-timetable-266fe",
    storageBucket: "smart-timetable-266fe.appspot.com",
    databaseURL: "https://smart-timetable-266fe-default-rtdb.firebaseio.com",
    messagingSenderId: "843230713835",
    appId: "1:843230713835:web:b97d024f4fcf9a40ceabae",
    measurementId: "G-DDY9NVEK8R"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rdb = getDatabase(app);

// ----------------------
// AUTH HELPERS
// ----------------------
export {
    app,
    auth,
    db,
    storage,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    sRef,
    uploadBytesResumable,
    getDownloadURL
};

// Convenience: get current user (promise)
export function getCurrentUser() {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            resolve(user || null);
        });
    });
}

// Simple requireAuth wrapper
export function requireAuth(cb) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            alert("Session expired or not logged in. Please sign in again.");
            window.location.href = "index.html";
        } else {
            cb(user);
        }
    });
}

// ----------------------
// PROFILE HELPERS
// ----------------------
export async function getUserProfile(uid) {
    try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.error("Error fetching profile:", err);
        return null;
    }
}

export async function saveUserProfile(uid, data) {
    try {
        const refDoc = doc(db, "users", uid);
        await setDoc(refDoc, data, { merge: true });
        return true;
    } catch (err) {
        console.error("Error saving profile:", err);
        return false;
    }
}

// ----------------------
// CLASSROOM / ASSIGNMENT HELPERS (Firestore + Storage)
// ----------------------

// Create classroom
export async function createClassroom(uid, name, code) {
    const docRef = await addDoc(collection(db, "classes"), {
        name,
        code,
        creator: uid,
        members: [uid],
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

// Get classrooms where user is a member
export async function getUserClassrooms(uid) {
    const q = query(collection(db, "classes"), where("members", "array-contains", uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Post class notice with optional file
export async function postClassNotice(classId, facultyUid, title, message, file = null) {
    let fileURL = "", fileName = "";
    if (file) {
        try {
            const path = `classroom_notices/${classId}/${Date.now()}_${file.name}`;
            const ref = sRef(storage, path);
            const uploadTask = await uploadBytesResumable(ref, file);
            fileURL = await getDownloadURL(uploadTask.ref);
            fileName = file.name;
        } catch (err) {
            console.error("Notice upload failed:", err);
        }
    }

    return await addDoc(collection(db, "classroom_notices", classId, "notices"), {
        facultyUid,
        title,
        message,
        fileURL,
        fileName,
        createdAt: serverTimestamp()
    });
}

export async function getClassNotices(classId) {
    const q = query(collection(db, "classroom_notices", classId, "notices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Post assignment with optional file
export async function postAssignment(classId, facultyUid, title, description, file = null, dueDate = null) {
    let fileURL = "", fileName = "";
    if (file) {
        try {
            const path = `assignments/${classId}/${Date.now()}_${file.name}`;
            const ref = sRef(storage, path);
            const uploadTask = await uploadBytesResumable(ref, file);
            fileURL = await getDownloadURL(uploadTask.ref);
            fileName = file.name;
        } catch (err) {
            console.error("Assignment upload failed:", err);
        }
    }

    return await addDoc(collection(db, "assignments", classId, "list"), {
        facultyUid,
        title,
        description,
        fileURL,
        fileName,
        dueDate,
        createdAt: serverTimestamp()
    });
}

export async function getAssignments(classId) {
    const q = query(collection(db, "assignments", classId, "list"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Submit assignment (student file)
export async function submitAssignment(classId, assignmentId, studentUid, file = null) {
    let fileURL = "", fileName = "";
    if (file) {
        try {
            const path = `assignment_submissions/${classId}/${assignmentId}/${Date.now()}_${file.name}`;
            const ref = sRef(storage, path);
            const uploadTask = await uploadBytesResumable(ref, file);
            fileURL = await getDownloadURL(uploadTask.ref);
            fileName = file.name;
        } catch (err) {
            console.error("Submission upload failed:", err);
        }
    }

    return await addDoc(
        collection(db, "assignments", classId, "list", assignmentId, "submissions"),
        {
            studentUid,
            fileURL,
            fileName,
            submittedAt: serverTimestamp()
        }
    );
}

export async function getAssignmentSubmissions(classId, assignmentId) {
    const q = query(
        collection(db, "assignments", classId, "list", assignmentId, "submissions"),
        orderBy("submittedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----------------------
// REALTIME DB: Tests (migrated server logic to client functions)
// ----------------------

// Create or update test
export async function createOrUpdateTest({ testId, title, duration, questions }) {
    if (!testId || !title || !duration || !Array.isArray(questions)) {
        throw new Error("Invalid payload: require testId, title, duration, questions[]");
    }
    await rSet(rRef(rdb, "tests/" + testId), { testId, title, duration, questions });
    return { ok: true, testId };
}

// Get test by id
export async function getTest(testId) {
    const snap = await rGet(rRef(rdb, `tests/${testId}`));
    if (!snap.exists()) return null;
    return snap.val();
}

// Submit answers (client-side auto-grading for MCQ & fill; long answers left for manual grading)
export async function submitTest({ testId, studentName, studentId, answers = [], startedAt = null, submittedAt = null }) {
    const testSnap = await rGet(rRef(rdb, `tests/${testId}`));
    if (!testSnap.exists()) throw new Error("Test not found");
    const test = testSnap.val();

    let score = 0;
    let maxAuto = 0;

    const results = (test.questions || []).map((q, i) => {
        const ans = answers?.[i] ?? null;
        const item = { index: i, type: q.type, marks: q.marks, response: ans, correct: null, awarded: 0 };

        if (q.type === "mcq") {
            maxAuto += q.marks || 0;
            const correct = (ans ?? "") === q.answer;
            item.correct = correct;
            item.awarded = correct ? q.marks || 0 : 0;
        } else if (q.type === "fill") {
            maxAuto += q.marks || 0;
            const norm = s => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, "");
            const correct = norm(ans) === norm(q.answer);
            item.correct = correct;
            item.awarded = correct ? q.marks || 0 : 0;
        } else if (q.type === "long") {
            item.correct = null;
            item.awarded = 0;
        }

        score += item.awarded;
        return item;
    });

    const record = {
        studentName,
        studentId,
        testId,
        score,
        maxAuto,
        startedAt: startedAt || Date.now(),
        submittedAt: submittedAt || Date.now(),
        answers,
        results
    };

    const newSubRef = rPush(rRef(rdb, `submissions/${testId}`));
    await rSet(newSubRef, record);

    return { ok: true, score, maxAuto, results };
}

// List all submissions for a test
export async function listTestSubmissions(testId) {
    const snap = await rGet(rRef(rdb, `submissions/${testId}`));
    if (!snap.exists()) return [];
    return Object.values(snap.val());
}

// Optional: realtime listener for test updates
export function onTestChange(testId, callback) {
    // callback receives snapshot.val()
    const ref = rRef(rdb, `tests/${testId}`);
    return rOnValue(ref, (snap) => {
        callback(snap.val());
    });
}

// ----------------------
// Utility helpers
// ----------------------

// upload single file to Storage path and return downloadURL
export async function uploadFile(path, file, onProgress = null) {
    const ref = sRef(storage, path);
    const uploadTask = uploadBytesResumable(ref, file);
    return new Promise((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            snapshot => {
                if (onProgress && snapshot.totalBytes) {
                    onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                }
            },
            error => reject(error),
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
            }
        );
    });
}

// ----------------------
// END
// ----------------------
