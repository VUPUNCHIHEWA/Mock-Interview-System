import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Focus Interview (voice + camera mode)
//
// A distraction-free, keyboard-only interview screen:
//   * Nothing is shown on the screen except ONE small notification panel at
//     the TOP-CENTRE of the screen - the place closest to a laptop camera -
//     and the student's live camera view right under it, so the student
//     never has to look away from the camera to read it.
//   * Confidence (camera) measurement runs, for every question, from the
//     moment the question starts being read aloud until the answer is
//     submitted: (1) listening to the question, (2) thinking time after the
//     question before pressing Enter (so the student cannot look at a phone
//     or notes to prepare unseen), and (3) recording the answer. Saving an
//     answer, waiting for the next question, and paused time (Shift) are
//     NOT measured.
//   * Each question is READ ALOUD (browser text-to-speech).
//       Space = hear the question again, Enter = start answering,
//       Enter = submit the answer, Enter = next question.
//   * Answers are only SAVED during the interview. Gemini checks all the
//     answers together at the end (no waiting for Gemini between questions).
//   * No live scores are shown during the interview. Instead, whenever Head
//     Pose or Eye Contact is below 100 in the latest frame, a short live hint
//     says exactly what to do to get back to 100 (e.g. "Look up - at the
//     camera", "Turn your head a little to the right").
//   * Auto-replace: if the face is not detected for 30 seconds in a row while
//     a question is in progress (listening / thinking / answering), a
//     countdown is shown from the first moment the face is lost; at 0 that
//     question is dropped (its camera data and recording are discarded and
//     it does not count toward the 6) and a NEW question replaces it, which
//     the student answers after coming back and pressing Enter (e.g. the
//     student had to leave suddenly).
//   * Shift = pause / resume, allowed ONLY between questions (when "Answer
//     saved - press Enter for the next question" is shown). Once a question
//     has been heard it cannot be paused, so a student cannot pause to look
//     up an answer.
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

// Must match MAX_QUESTIONS_PER_SESSION in backend interview_service.py
// (used only to show "Question 2 of 6").
const TOTAL_QUESTIONS = 6;

// Gap (ms) between one camera frame's result arriving and the next frame
// being sent (frames never overlap, so they cannot queue up).
const VISUAL_CAPTURE_GAP_MS = 1000;

// Below this length an answer is too short for reliable speech-rate/pause/pitch
// metrics (same researcher-set threshold as the classic interview screen).
const MIN_RECORDING_SECONDS = 5;

// Auto-replace: if no face is detected for this many seconds IN A ROW while a
// question is in progress (listening / thinking / answering), that question
// is dropped and replaced with a new one. A countdown is shown from the first
// moment the face is lost; any detected face resets it.
// --- ASSUMPTION - not literature-derived --- researcher-set timeout.
const NO_FACE_TIMEOUT_SECONDS = 30;
// The countdown only finishes if "no face" results are still arriving (the
// last one within this time). If the server stops answering, the question is
// NOT replaced - a server problem must never throw away a student's question.
const NO_FACE_RESULT_FRESH_MS = 4000;

// Live coaching: shown the moment Head Pose or Eye Contact is below 100 in
// the latest frame, telling the student exactly what to do to get back to
// 100. Directions are from the student's own point of view.
const COACHING_TEXT = {
    HEAD_TURN_RIGHT: "↪ Turn your head a little to the right",
    HEAD_TURN_LEFT: "↩ Turn your head a little to the left",
    HEAD_CHIN_UP: "⬆ Lift your chin a little",
    HEAD_CHIN_DOWN: "⬇ Lower your chin a little",
    HEAD_STRAIGHTEN: "Keep your head upright - don't tilt it",
    EYES_UP: "👁 Look up - at the camera",
    EYES_DOWN: "👁 Look down a little - at the camera",
    EYES_LEFT: "👁 Look a little to the left - at the camera",
    EYES_RIGHT: "👁 Look a little to the right - at the camera",
    FACE_CAMERA: "Turn your face towards the camera",
};

const PHASE = {
    READY: 'READY',               // waiting for Enter to start
    SPEAKING: 'SPEAKING',         // question is being read aloud
    AWAIT_ANSWER: 'AWAIT_ANSWER', // Space = repeat, Enter = answer
    RECORDING: 'RECORDING',       // Enter = submit
    SAVING: 'SAVING',             // answer being uploaded / transcribed
    AWAIT_NEXT: 'AWAIT_NEXT',     // Enter = next question
    EVALUATING: 'EVALUATING',     // all answers being checked
    REPLACING: 'REPLACING',       // no face for 30 s: question being replaced
    QUESTION_REPLACED: 'QUESTION_REPLACED', // Enter = hear the new question
    ERROR: 'ERROR',               // Enter = try again
};

const Key = ({ children }) => (
    <kbd className="inline-block min-w-[3.2rem] text-center px-2 py-0.5 mx-0.5 rounded-md bg-slate-700 border border-slate-500 text-white text-[11px] font-black tracking-wider shadow">
        {children}
    </kbd>
);

const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const FocusInterviewSession = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { sessionId, firstQuestion, gazeBaseline, role, totalQuestions: stateTotal } = location.state || { sessionId: "demo_session", firstQuestion: null };
    // Custom Practice asks all of the student's questions; standard = 6.
    const totalQuestions = stateTotal || TOTAL_QUESTIONS;
    const isCustomPractice = role === 'Custom Practice';

    const [phase, setPhase] = useState(PHASE.READY);
    const [questionNumber, setQuestionNumber] = useState(1);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [faceWarning, setFaceWarning] = useState(null);
    const [coaching, setCoaching] = useState([]); // live "what to fix" hints
    const [noFaceCountdown, setNoFaceCountdown] = useState(null); // seconds left, or null
    const [noFaceCheckStalled, setNoFaceCheckStalled] = useState(false); // server not answering
    const [replacedCount, setReplacedCount] = useState(0);       // questions replaced this interview
    const inFlightFrameRef = useRef(Promise.resolve());          // latest camera request
    const noFaceSinceRef = useRef(null);        // time the face was first lost (ms)
    const lastNoFaceResultAtRef = useRef(0);     // time of the latest "no face" result (ms)
    const [deviceError, setDeviceError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [shortAnswerWarning, setShortAnswerWarning] = useState(false);
    const [ttsSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const captureTimerRef = useRef(null);
    const measuringRef = useRef(false);
    const [measuring, setMeasuring] = useState(false);
    const [devicesOff, setDevicesOff] = useState(false); // camera + mic switched off

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const transcriptRef = useRef("");
    const recordingTimerRef = useRef(null);
    const recordingSecondsRef = useRef(0);

    const currentQuestionRef = useRef(firstQuestion || "");
    const nextQuestionRef = useRef(null);
    const speakTokenRef = useRef(0);
    const visualAccRef = useRef({ total: 0, count: 0 });
    const retryActionRef = useRef(null);
    const busyRef = useRef(false);

    // Pause / resume (Shift key).
    const [paused, setPaused] = useState(false);

    // ------------------------------------------------------------------
    // Camera + microphone (opened on load so permission is asked BEFORE
    // the interview starts; nothing is measured until Enter is pressed).
    // ------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 400, height: 400, facingMode: "user" },
                    audio: true,
                });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("Error accessing camera/microphone:", err);
                setDeviceError("Camera and microphone access is needed. Please allow access and reload the page.");
            }
        })();

        return () => {
            cancelled = true;
            measuringRef.current = false;
            if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
            try { recognitionRef.current?.stop(); } catch { /* ignore */ }
            try {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
            } catch { /* ignore */ }
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
        };
    }, []);

    // ------------------------------------------------------------------
    // Camera confidence measurement loop (runs only while `measuring`).
    // ------------------------------------------------------------------
    const captureVisualFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return Promise.resolve();

        canvas.width = video.videoWidth || 400;
        canvas.height = video.videoHeight || 400;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Frame = canvas.toDataURL('image/jpeg', 0.6);
        const capturedAt = Date.now();

        const request = axios.post(`${API}/api/analyze-visual`, {
            sessionId,
            image_base64: base64Frame,
            // Personal "looking at the camera" calibration from the camera check.
            gazeBaseline: gazeBaseline || null,
        }).then(response => {
            if (!measuringRef.current) return;
            const data = response.data;
            if (data.status === "FACE_DETECTED") {
                setFaceWarning(null);
                setCoaching(Array.isArray(data.coaching) ? data.coaching : []);
                // Face is back -> reset the auto-close countdown.
                noFaceSinceRef.current = null;
                setNoFaceCountdown(null);
                if (data.visual_confidence_score !== null && data.visual_confidence_score !== undefined) {
                    visualAccRef.current.total += data.visual_confidence_score;
                    visualAccRef.current.count += 1;
                }
            } else if (data.status === "NO_FACE_DETECTED") {
                setFaceWarning(data.warning_message || "Face not detected - please sit in front of the camera.");
                setCoaching([]); // the face warning / countdown says what to do
                // Auto-close countdown starts from the moment the face was lost
                // (the capture time of the first "no face" frame).
                if (noFaceSinceRef.current === null) noFaceSinceRef.current = capturedAt;
                lastNoFaceResultAtRef.current = Date.now();
                // Face not visible while answering counts as 0 (same as the
                // backend) - hiding the face must not raise the score.
                visualAccRef.current.count += 1;
            }
        }).catch(err => console.error("Visual API Error:", err));
        inFlightFrameRef.current = request;
        return request;
    };

    useEffect(() => {
        if (!measuring) return;
        let cancelled = false;
        const loop = async () => {
            if (cancelled) return;
            await captureVisualFrame();
            if (!cancelled) captureTimerRef.current = setTimeout(loop, VISUAL_CAPTURE_GAP_MS);
        };
        captureTimerRef.current = setTimeout(loop, 300);
        return () => {
            cancelled = true;
            if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measuring]);

    // ------------------------------------------------------------------
    // Measurement window: camera confidence is measured while the question
    // is being read aloud (SPEAKING), during the thinking time before the
    // student presses Enter to answer (AWAIT_ANSWER - otherwise a student
    // could prepare the answer on a phone unseen), and while the answer is
    // recorded (RECORDING); never while paused. Saving the answer, waiting
    // for the next question and checking answers are not measured.
    // ------------------------------------------------------------------
    const MEASURED_PHASES = [PHASE.SPEAKING, PHASE.AWAIT_ANSWER, PHASE.RECORDING];
    useEffect(() => {
        if (!paused && MEASURED_PHASES.includes(phase)) startMeasuring();
        else stopMeasuring();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, paused]);

    const startMeasuring = () => {
        measuringRef.current = true;
        setMeasuring(true);
    };

    const stopMeasuring = () => {
        measuringRef.current = false;
        setMeasuring(false);
        setFaceWarning(null);
        setCoaching([]);
        noFaceSinceRef.current = null;
        setNoFaceCountdown(null);
        setNoFaceCheckStalled(false);
    };

    // ------------------------------------------------------------------
    // Auto-close countdown (ticks every 250 ms while measuring).
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!measuring) return;
        const timer = setInterval(() => {
            const since = noFaceSinceRef.current;
            if (since === null) return;
            const elapsed = (Date.now() - since) / 1000;
            const left = Math.max(0, Math.ceil(NO_FACE_TIMEOUT_SECONDS - elapsed));
            const resultsStillArriving = Date.now() - lastNoFaceResultAtRef.current < NO_FACE_RESULT_FRESH_MS;
            if (left <= 0 && resultsStillArriving) {
                clearInterval(timer);
                runOnce(replaceQuestion);
                return;
            }
            setNoFaceCheckStalled(!resultsStillArriving);
            setNoFaceCountdown(Math.max(1, left));
        }, 250);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measuring]);

    // No face for NO_FACE_TIMEOUT_SECONDS: drop this question (discard its
    // camera data and any recording) and get a NEW question in its place.
    const replaceQuestion = async () => {
        stopMeasuring();
        stopSpeaking();
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        stopRecognition();
        try {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== "inactive") { recorder.onstop = null; recorder.stop(); }
        } catch { /* ignore */ }
        audioChunksRef.current = [];
        transcriptRef.current = "";
        visualAccRef.current = { total: 0, count: 0 };
        setShortAnswerWarning(false);
        setPhase(PHASE.REPLACING);

        // Let the last camera request finish first, so it is deleted together
        // with the rest of this question's frames (not counted on the new one).
        try { await inFlightFrameRef.current; } catch { /* ignore */ }

        try {
            const response = await axios.post(`${API}/api/replace-question`, { sessionId });
            if (!response.data.success || !response.data.nextQuestion) throw new Error("replace failed");
            nextQuestionRef.current = response.data.nextQuestion;
            setReplacedCount(n => n + 1);
            setPhase(PHASE.QUESTION_REPLACED);
        } catch (err) {
            console.error("Could not replace the question:", err);
            retryActionRef.current = () => replaceQuestion();
            setErrorMessage("The question could not be replaced (connection problem).");
            setPhase(PHASE.ERROR);
        }
    };

    const takeVisualAverage = () => {
        const { total, count } = visualAccRef.current;
        visualAccRef.current = { total: 0, count: 0 };
        if (count === 0) return null;
        return Math.round((total / count) * 10) / 10;
    };

    // ------------------------------------------------------------------
    // Text-to-speech: read the question aloud.
    // ------------------------------------------------------------------
    const speakQuestion = () => {
        const text = currentQuestionRef.current;
        if (!ttsSupported || !text) {
            setPhase(PHASE.AWAIT_ANSWER);
            return;
        }
        const synth = window.speechSynthesis;
        const token = ++speakTokenRef.current;
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        const voices = synth.getVoices();
        const voice = voices.find(v => v.lang === 'en-US' && /Google|Microsoft/i.test(v.name))
            || voices.find(v => v.lang && v.lang.startsWith('en'));
        if (voice) utterance.voice = voice;

        const done = () => {
            // Ignore the "end" of an older utterance that was cancelled by a repeat.
            if (token === speakTokenRef.current) setPhase(PHASE.AWAIT_ANSWER);
        };
        utterance.onend = done;
        utterance.onerror = done;

        setPhase(PHASE.SPEAKING);
        synth.speak(utterance);
    };

    const stopSpeaking = () => {
        speakTokenRef.current++;
        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };

    // ------------------------------------------------------------------
    // Recording an answer.
    // ------------------------------------------------------------------
    const startRecording = () => {
        const stream = streamRef.current;
        if (!stream || stream.getAudioTracks().length === 0) {
            setErrorMessage("Microphone not available.");
            setPhase(PHASE.ERROR);
            return;
        }
        stopSpeaking();
        audioChunksRef.current = [];
        transcriptRef.current = "";
        setShortAnswerWarning(false);

        const audioOnly = new MediaStream(stream.getAudioTracks());
        let options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/ogg;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

        const recorder = new MediaRecorder(audioOnly, options);
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);

        startRecognition();

        recordingSecondsRef.current = 0;
        setRecordingSeconds(0);
        startRecordingTimer();

        setPhase(PHASE.RECORDING);
    };

    // Browser speech-to-text - only a BACKUP for the server transcription.
    // Text already collected is kept (new results are appended), so it can
    // be stopped on pause and started again on resume.
    const startRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) transcriptRef.current += event.results[i][0].transcript + " ";
                }
            };
            recognition.onerror = (e) => console.warn("Speech recognition:", e.error);
            recognition.start();
            recognitionRef.current = recognition;
        } catch (err) {
            console.warn("Speech recognition failed to start:", err);
        }
    };

    const stopRecognition = () => {
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
    };

    // Counts on from recordingSecondsRef, so a resumed answer keeps its time.
    const startRecordingTimer = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => {
            recordingSecondsRef.current += 1;
            setRecordingSeconds(recordingSecondsRef.current);
        }, 1000);
    };

    const stopRecording = () => new Promise((resolve) => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;

        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") {
            resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
            return;
        }
        recorder.onstop = () => {
            resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
    });

    // ------------------------------------------------------------------
    // Saving an answer (no Gemini here - evaluation happens at the end).
    // ------------------------------------------------------------------
    const saveAnswer = async (audioBlob, transcript, visualAvg) => {
        setPhase(PHASE.SAVING);
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("message", "");
        formData.append("audio_file", audioBlob, `vocal_${sessionId}.webm`);
        formData.append("deferEvaluation", "true");
        formData.append("fallbackTranscript", transcript);
        if (visualAvg !== null) formData.append("visualConfidenceScore", visualAvg);

        try {
            const response = await axios.post(`${API}/api/chat-interview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (!response.data.success) throw new Error(response.data.message || "Answer could not be saved.");

            if (response.data.sessionComplete || !response.data.nextQuestion) {
                await finishInterview();
            } else {
                nextQuestionRef.current = response.data.nextQuestion;
                setPhase(PHASE.AWAIT_NEXT);
            }
        } catch (err) {
            console.error("Failed to save answer:", err);
            retryActionRef.current = () => saveAnswer(audioBlob, transcript, visualAvg);
            setErrorMessage("Your answer could not be saved (connection problem).");
            setPhase(PHASE.ERROR);
        }
    };

    const submitAnswer = async () => {
        stopMeasuring(); // answer finished -> stop measuring until the next answer
        const audioBlob = await stopRecording();
        const transcript = transcriptRef.current.trim();
        const visualAvg = takeVisualAverage();
        await saveAnswer(audioBlob, transcript, visualAvg);
    };

    // ------------------------------------------------------------------
    // End: stop measuring, check all answers, show the report.
    // ------------------------------------------------------------------
    // Switch the camera and microphone OFF (the browser's camera light goes off).
    const stopDevices = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setDevicesOff(true);
    };

    const finishInterview = async () => {
        stopMeasuring();
        // The last answer is in, so nothing more is recorded: turn the camera
        // and mic off now - not after the answers are checked (that can take a
        // while, and if checking fails they would otherwise stay on).
        stopDevices();
        setPhase(PHASE.EVALUATING);
        try {
            const response = await axios.post(`${API}/api/end-interview`, { sessionId });
            if (!response.data.success) throw new Error("End interview failed");
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
            navigate('/interview-results', { state: { results: response.data } });
        } catch (err) {
            console.error("Failed to end interview:", err);
            retryActionRef.current = () => finishInterview();
            setErrorMessage("Your answers could not be checked (connection problem).");
            setPhase(PHASE.ERROR);
        }
    };

    // ------------------------------------------------------------------
    // Keyboard control (Enter / Space).
    // ------------------------------------------------------------------
    const startInterview = () => {
        if (deviceError || !streamRef.current) return;
        try { document.documentElement.requestFullscreen?.().catch(() => { }); } catch { /* ignore */ }
        setQuestionNumber(1);
        speakQuestion();
    };

    // ------------------------------------------------------------------
    // Pause / resume (Shift).
    // ------------------------------------------------------------------
    // Pause is allowed ONLY between questions. After a question has been
    // heard (listening / thinking / answering) it cannot be paused, otherwise
    // a student could pause and look up the answer.
    const PAUSABLE = [PHASE.AWAIT_NEXT, PHASE.QUESTION_REPLACED];

    const pauseInterview = () => {
        // 1) Stop the camera confidence measurement.
        stopMeasuring();
        // 2) Freeze whatever the interview was doing.
        if (phase === PHASE.SPEAKING) {
            stopSpeaking(); // the question is read again on resume
        } else if (phase === PHASE.RECORDING) {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            stopRecognition();
            const recorder = mediaRecorderRef.current;
            try {
                if (recorder && recorder.state === "recording") recorder.pause();
            } catch (err) {
                console.warn("Recorder pause failed:", err);
            }
        }
        setPaused(true);
    };

    const resumeInterview = () => {
        setPaused(false);
        // Continue the interview from the same point (camera measurement
        // restarts automatically - see the measurement-window effect).
        if (phase === PHASE.SPEAKING) {
            speakQuestion();
        } else if (phase === PHASE.RECORDING) {
            const recorder = mediaRecorderRef.current;
            try {
                if (recorder && recorder.state === "paused") recorder.resume();
            } catch (err) {
                console.warn("Recorder resume failed:", err);
            }
            startRecognition();
            startRecordingTimer();
        }
    };

    const runOnce = async (action) => {
        if (busyRef.current) return;
        busyRef.current = true;
        try { await action(); } finally { busyRef.current = false; }
    };

    const handleKey = (e) => {
        if (e.key === 'Shift') {
            if (e.repeat) return;
            if (paused) resumeInterview();
            else if (PAUSABLE.includes(phase) && !busyRef.current) pauseInterview();
            return;
        }

        const isEnter = e.key === 'Enter';
        const isSpace = e.key === ' ' || e.code === 'Space';
        if (!isEnter && !isSpace) return;
        e.preventDefault();
        if (e.repeat) return;
        if (paused) return; // only Shift works while paused

        switch (phase) {
            case PHASE.READY:
                if (isEnter) startInterview();
                break;
            case PHASE.SPEAKING:
            case PHASE.AWAIT_ANSWER:
                if (isSpace) speakQuestion();
                else startRecording();
                break;
            case PHASE.RECORDING:
                if (!isEnter) break;
                if (recordingSecondsRef.current < MIN_RECORDING_SECONDS && !shortAnswerWarning) {
                    setShortAnswerWarning(true);
                    break;
                }
                runOnce(submitAnswer);
                break;
            case PHASE.AWAIT_NEXT:
                if (isEnter && nextQuestionRef.current) {
                    currentQuestionRef.current = nextQuestionRef.current;
                    nextQuestionRef.current = null;
                    setQuestionNumber(n => n + 1);
                    speakQuestion();
                }
                break;
            case PHASE.QUESTION_REPLACED:
                // Same question number - the new question takes the old one's place.
                if (isEnter && nextQuestionRef.current) {
                    currentQuestionRef.current = nextQuestionRef.current;
                    nextQuestionRef.current = null;
                    speakQuestion();
                }
                break;
            case PHASE.ERROR:
                if (isEnter && retryActionRef.current) {
                    const retry = retryActionRef.current;
                    retryActionRef.current = null;
                    setErrorMessage(null);
                    runOnce(retry);
                }
                break;
            default:
                break;
        }
    };

    const handleKeyRef = useRef(handleKey);
    handleKeyRef.current = handleKey;
    useEffect(() => {
        const listener = (e) => handleKeyRef.current(e);
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []);

    // ------------------------------------------------------------------
    // The notification panel content for each phase.
    // ------------------------------------------------------------------
    const qLabel = `Question ${Math.min(questionNumber, totalQuestions)} of ${totalQuestions}`;
    let title = null;
    let hint = null;
    let tone = 'blue';

    switch (phase) {
        case PHASE.READY:
            title = deviceError || "Ready when you are";
            hint = deviceError ? null : <>Press <Key>Enter</Key> to start the interview</>;
            tone = deviceError ? 'red' : 'blue';
            break;
        case PHASE.SPEAKING:
            title = <>🔊 {qLabel} - listen</>;
            hint = <><Key>Space</Key> hear again · <Key>Enter</Key> start answering</>;
            break;
        case PHASE.AWAIT_ANSWER:
            title = <>🎧 {qLabel}</>;
            hint = <><Key>Space</Key> hear again · <Key>Enter</Key> start answering</>;
            break;
        case PHASE.RECORDING:
            title = <><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-2 align-middle"></span>Recording your answer · {formatTime(recordingSeconds)}</>;
            hint = shortAnswerWarning
                ? <>Very short answer. Keep talking, or press <Key>Enter</Key> again to submit</>
                : <>Press <Key>Enter</Key> to submit your answer</>;
            tone = 'red';
            break;
        case PHASE.SAVING:
            title = "Saving your answer...";
            hint = null;
            break;
        case PHASE.AWAIT_NEXT:
            title = "✅ Answer saved";
            hint = <>Press <Key>Enter</Key> for the next question</>;
            tone = 'green';
            break;
        case PHASE.EVALUATING:
            title = "All questions done - checking your answers...";
            hint = <span className="text-slate-400">This can take a little while. Please wait.</span>;
            tone = 'green';
            break;
        case PHASE.ERROR:
            title = errorMessage || "Something went wrong.";
            hint = retryActionRef.current ? <>Press <Key>Enter</Key> to try again</> : null;
            tone = 'red';
            break;
        case PHASE.REPLACING:
            title = "Face not detected for 30 seconds";
            hint = <span className="text-slate-400">Replacing this question...</span>;
            tone = 'red';
            break;
        case PHASE.QUESTION_REPLACED:
            title = <>🔁 {qLabel} was replaced</>;
            hint = (
                <>
                    Your face was not detected for {NO_FACE_TIMEOUT_SECONDS} seconds, so that question was removed
                    (it does not count). When you are ready, press <Key>Enter</Key>{' '}
                    {isCustomPractice ? 'to hear the same question again.' : 'for a new question.'}
                </>
            );
            tone = 'amber';
            break;
        default:
            break;
    }

    if (paused) {
        title = <>⏸ Interview paused{phase === PHASE.RECORDING ? ` · answer at ${formatTime(recordingSeconds)}` : ''}</>;
        hint = <>Press <Key>Shift</Key> to continue</>;
        tone = 'amber';
    }

    const canPause = !paused && PAUSABLE.includes(phase);

    const toneClasses = {
        blue: 'border-blue-500/40',
        red: 'border-red-500/60',
        green: 'border-green-500/50',
        amber: 'border-amber-400/70',
    }[tone];

    const showQuestionText = !ttsSupported && (phase === PHASE.SPEAKING || phase === PHASE.AWAIT_ANSWER || phase === PHASE.RECORDING);

    return (
        <div className="fixed inset-0 bg-slate-950 text-slate-100 select-none cursor-default">
            {/* Hidden canvas used to grab camera frames for analysis. */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Notification panel + live camera view, both at top-centre next to the camera. */}
            <div className="fixed top-2 left-1/2 -translate-x-1/2 w-[min(92vw,30rem)] z-50">
                <div className={`bg-slate-900/95 border-2 ${toneClasses} rounded-2xl px-5 py-3 text-center shadow-2xl`}>
                    <div className="text-sm font-black tracking-wide text-slate-100">{title}</div>
                    {hint && <div className="mt-1.5 text-[12px] font-semibold text-slate-300">{hint}</div>}

                    {phase === PHASE.READY && !deviceError && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={startInterview}
                            className="mt-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest"
                        >
                            Start Interview
                        </button>
                    )}

                    {showQuestionText && (
                        <div className="mt-2 text-[12px] text-slate-200 font-medium leading-snug">
                            {currentQuestionRef.current}
                        </div>
                    )}

                    {canPause && (
                        <div className="mt-2 pt-2 border-t border-slate-700/70 text-[10px] font-semibold text-slate-500 text-right">
                            <Key>Shift</Key> pause
                        </div>
                    )}

                    {measuring && !faceWarning && coaching.length > 0 && (
                        <div className="mt-2 rounded-xl bg-amber-500/15 border border-amber-400/60 px-3 py-1.5 space-y-0.5">
                            {coaching.map(code => (
                                <div key={code} className="text-[12px] font-black text-amber-200">
                                    {COACHING_TEXT[code] || code}
                                </div>
                            ))}
                        </div>
                    )}

                    {measuring && faceWarning && noFaceCountdown === null && (
                        <div className="mt-2 text-[11px] font-bold text-orange-300">
                            ⚠️ {faceWarning}
                        </div>
                    )}

                    {measuring && noFaceCountdown !== null && (
                        <div className="mt-2 rounded-xl bg-red-600/20 border border-red-500/60 px-3 py-2">
                            <div className="text-[12px] font-black text-red-300">
                                {noFaceCheckStalled
                                    ? '⚠️ Face not detected - countdown on hold (connection problem)'
                                    : `⚠️ Face not detected - this question will be replaced in ${noFaceCountdown}s`}
                            </div>
                            <div className="text-[10px] font-semibold text-red-200/80 mt-0.5">
                                Look at the camera to keep this question.
                            </div>
                        </div>
                    )}
                </div>

                {/* Live camera view - placed right under the panel (close to the
                    laptop camera) so looking at it keeps the eyes near the camera.
                    Mirrored like a normal selfie view; the frames sent for
                    analysis are not affected by this CSS mirroring. */}
                <div className={`mt-2 mx-auto w-[min(60vw,15rem)] aspect-square rounded-2xl overflow-hidden border-2 bg-slate-900 shadow-2xl ${measuring && faceWarning ? 'border-orange-400/70' : 'border-slate-700'} ${deviceError || devicesOff ? 'hidden' : ''}`}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                    />
                </div>
            </div>
        </div>
    );
};

export default FocusInterviewSession;