🧠 WebRTC Voice AI Bot with Twilio, Deepgram, and OpenAI
🚀 Real-Time AI-Powered Voice Assistant

📌 Overview
The WebRTC Voice AI Bot is a real-time conversational voice assistant that allows users to call a phone number and have a dynamic conversation with an AI. It integrates:
✅ Twilio – for inbound call handling and audio streaming
✅ Deepgram – for real-time speech-to-text transcription
✅ OpenAI – for generating AI-driven responses
✅ WebRTC – for handling peer-to-peer voice communication

Inspired by the Daisy O2 Bot, the project replicates a seamless, natural voice interaction by enabling real-time transcription and AI-generated responses.

🎯 Key Features
✔️ Accepts real-time inbound calls using Twilio
✔️ Handles live audio streaming over WebRTC
✔️ Transcribes speech-to-text in real-time with Deepgram
✔️ Generates AI responses using OpenAI GPT-3.5 Turbo
✔️ Responds with real-time speech using Twilio TTS
✔️ Maintains conversation context across multiple exchanges
✔️ Smart handling for vague inputs and user silence
✔️ Automatic error recovery and reconnection


🚀 Architecture
🎯 High-Level Workflow:
User calls a Twilio number
Twilio streams audio over WebRTC to the server
Audio is transcribed in real-time by Deepgram
Transcription sent to OpenAI for response generation
AI response converted to speech via Twilio TTS
AI responds to the user in real-time
Maintains memory of conversation context across exchanges


🛠️ Tech Stack
Technology	Purpose
Node.js	Backend framework
Twilio	Inbound calls, audio streaming, and TTS
Deepgram	Speech-to-text transcription
OpenAI (GPT-3.5)	AI-driven response generation
WebRTC	Real-time voice streaming
Express.js	Server framework
GitHub	Version control
Heroku	Deployment
