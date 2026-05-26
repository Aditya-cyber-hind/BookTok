import sounddevice as sd
import numpy as np
import vosk
import json
import ollama
import pyttsx3
import os
import cv2

# ===== SYSTEM PROMPT =====
SYSTEM_PROMPT = (
    "You are ARix, a friendly autonomous robot created by Aditya. "
    "Keep responses brief (1-3 sentences), warm, and helpful. "
    "If the user asks anything related to seeing, looking, describing, or using your camera, "
    "do NOT apologise or say you can't see. Instead, tell them: "
    "'If you want me to use my vision, please say vision mode.'"
)

# ===== FACES =====
FACES = {
    "idle":       "[o_o]  [Ready]",
    "listening":  "[O_O]  [Listening...]",
    "thinking":   "[-_-]  [Thinking...]",
    "speaking":   "[^_^]  [Speaking...]",
    "confused":   "[?_?]  [Didn't catch that]",
}

# ===== CHAT HISTORY =====
CHAT_FILE = "chat_history.json"

def load_chat():
    if os.path.exists(CHAT_FILE):
        with open(CHAT_FILE, "r") as f:
            return json.load(f)
    return []

def save_chat(chat):
    with open(CHAT_FILE, "w") as f:
        json.dump(chat, f)

chat_history = load_chat()

# ===== MODE =====
mode = "talk"

# ===== LEGACY MEMORY =====
MEMORY_FILE = "arix_memory.json"

def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {}

def save_memory(m):
    with open(MEMORY_FILE, "w") as f:
        json.dump(m, f)

memory = load_memory()

# ===== VOSK SETUP =====
vosk_model = vosk.Model("model")          # <-- the folder you just created
vosk_recognizer = vosk.KaldiRecognizer(vosk_model, 16000)

# ===== PYTTSX3 TTS =====
tts_engine = pyttsx3.init()
tts_engine.setProperty('rate', 180)

# ===== HELPER FUNCTIONS =====
def show_face(state):
    print(FACES.get(state, FACES["idle"]))

def listen_once(duration=5, samplerate=16000):
    show_face("listening")
    recording = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='int16')
    sd.wait()
    audio_bytes = recording.tobytes()
    vosk_recognizer.AcceptWaveform(audio_bytes)
    result = json.loads(vosk_recognizer.Result())
    return result.get("text", "").strip()

def speak(text):
    if not text or not text.strip():
        text = "I'm not sure what to say."
    show_face("speaking")
    try:
        tts_engine.say(text)
        tts_engine.runAndWait()
    except Exception as e:
        print(f"TTS error: {e}")

def capture_photo():
    cam = cv2.VideoCapture(0)
    ret, frame = cam.read()
    cam.release()
    if not ret:
        raise Exception("Webcam not accessible")
    _, buffer = cv2.imencode('.jpg', frame)
    path = "temp_vision.jpg"
    with open(path, "wb") as f:
        f.write(buffer)
    return path

def local_vision_query(prompt):
    try:
        img_path = capture_photo()
        response = ollama.chat(
            model='moondream:1.8b-v2-q4_1',
            messages=[{
                'role': 'user',
                'content': prompt,
                'images': [img_path]
            }]
        )
        return response['message']['content']
    except Exception as e:
        return f"Vision error: {str(e)[:80]}"

def check_movement(text):
    cmd = text.lower()
    if any(w in cmd for w in ["forward","go straight","move ahead"]): return "FORWARD"
    if any(w in cmd for w in ["backward","reverse","go back","move back"]): return "BACKWARD"
    if any(w in cmd for w in ["turn left","go left","move left","left"]): return "LEFT"
    if any(w in cmd for w in ["turn right","go right","move right","right"]): return "RIGHT"
    if any(w in cmd for w in ["stop","halt","freeze"]): return "STOP"
    return None

def check_memory_command(text):
    t = text.lower().replace("favourite","favorite").replace("colour","color")
    question_starters = ("what","who","where","when","why","how",
                         "tell","can","could","would","do","does","did","is","are")
    if t.split() and t.split()[0] in question_starters:
        return None
    if "my name is" in t:
        name = text.split("is")[-1].strip().rstrip(".")
        memory["user_name"] = name
        save_memory(memory)
        return f"Got it, {name}!"
    if "my favorite" in t and " is " in t:
        key_part = t.split("my favorite")[-1].split(" is ")[0].strip().replace(" ","_")
        value = text.split(" is ")[-1].strip().rstrip(".")
        memory["favorite_"+key_part] = value
        save_memory(memory)
        return f"Got it! I'll remember your favorite {key_part}."
    if " is " in t:
        left = t.split(" is ")[0].strip()
        if any(w in left for w in ["favorite","favourite"]):
            thing = left.replace("favorite","").replace("favourite","").strip() or "thing"
            value = t.split(" is ")[-1].strip().rstrip(".")
            memory["favorite_"+thing.replace(" ","_")] = value
            save_memory(memory)
            return f"Got it! I'll remember your favorite {thing} is {value}."
    return None

def answer_memory(text):
    t = text.lower().replace("favourite","favorite").replace("colour","color")
    if "my name" in t and ("what" in t or "who" in t):
        if "user_name" in memory:
            return f"Your name is {memory['user_name']}!"
    if "favorite" in t and ("what" in t or "which" in t or "tell me" in t):
        for k,v in memory.items():
            if k.startswith("favorite_"):
                item = k[9:].replace("_"," ")
                return f"Your favorite {item} is {v}!"
    return None

# ===== MAIN LOOP =====
show_face("idle")
print("ARix: Hello! I'm ready. Say 'vision mode' to see, 'talk mode' to chat.")

while True:
    user_text = listen_once()
    if not user_text:
        show_face("confused")
        print("ARix: Sorry, didn't catch that.")
        show_face("idle")
        continue

    print(f"You: {user_text}")

    if user_text.lower() in ["exit","quit","goodbye","bye"]:
        speak("Goodbye!")
        break

    if user_text.lower() == "vision mode":
        mode = "vision"
        speak("Switching to vision mode, please wait.")
        speak("Vision mode ready. Please remember it's only for vision, not for general talking.")
        show_face("idle")
        continue

    if user_text.lower() == "talk mode":
        mode = "talk"
        speak("Talk mode ready. Please speak.")
        show_face("idle")
        continue

    if mode == "vision":
        show_face("thinking")
        result = local_vision_query(user_text)
        print(f"ARix Vision: {result}")
        speak(result)
        chat_history.append({"role":"user","content":user_text})
        chat_history.append({"role":"assistant","content":result})
        save_chat(chat_history)
        show_face("idle")
        continue

    movement = check_movement(user_text)
    if movement:
        print(f"[MOTOR] ARix would: {movement}")
        response_text = f"Okay, moving {movement.lower()}!"
        speak(response_text)
        chat_history.append({"role":"user","content":user_text})
        chat_history.append({"role":"assistant","content":response_text})
        save_chat(chat_history)
        show_face("idle")
        continue

    mem_save = check_memory_command(user_text)
    if mem_save:
        speak(mem_save)
        chat_history.append({"role":"user","content":user_text})
        chat_history.append({"role":"assistant","content":mem_save})
        save_chat(chat_history)
        show_face("idle")
        continue

    mem_ans = answer_memory(user_text)
    if mem_ans:
        speak(mem_ans)
        chat_history.append({"role":"user","content":user_text})
        chat_history.append({"role":"assistant","content":mem_ans})
        save_chat(chat_history)
        show_face("idle")
        continue

    show_face("thinking")
    chat_history.append({"role":"user","content":user_text})
    messages = [{"role":"system","content":SYSTEM_PROMPT}] + chat_history.copy()
    ai_message = ""
    try:
        response = ollama.chat(
            model='qwen2.5:0.5b',
            messages=messages
        )
        ai_message = response['message']['content']
    except Exception as e:
        ai_message = f"Local LLM error: {str(e)[:60]}"
        print(ai_message)

    if not ai_message or not ai_message.strip():
        ai_message = "I'm not sure what to say."
    print(f"ARix: {ai_message}")
    speak(ai_message)

    chat_history.append({"role":"assistant","content":ai_message})
    save_chat(chat_history)
    show_face("idle")